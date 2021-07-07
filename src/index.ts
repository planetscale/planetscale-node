import * as https from 'https'
import * as tls from 'tls'
import * as x509 from "@peculiar/x509";
import * as mysql from 'mysql2'
import type { Connection } from 'mysql2'
import type { IncomingMessage } from 'http'

const crypto = require('crypto')
const { subtle } = crypto.webcrypto
x509.cryptoProvider.set({subtle: subtle});

const alg = {
  name: "ECDSA",
  namedCurve: "P-256",
  hash: "SHA-256",
}

export class PSDB {
  private branch: string
  private _tokenname: string | undefined
  private _token: string | undefined
  private _org: string | undefined
  private _db: string | undefined
  private _baseURL: string
  private _headers: { Authorization: string }
  private _connection: Connection | null = null

  constructor(branch = 'main') {
    this.branch = branch
    this._tokenname = process.env.PLANETSCALE_TOKEN_NAME
    this._token = process.env.PLANETSCALE_TOKEN
    this._org = process.env.PLANETSCALE_ORG
    this._db = process.env.PLANETSCALE_DB
    this._baseURL = 'https://api.planetscale.com'
    this._headers = { Authorization: `${this._tokenname}:${this._token}` }
  }

  async query(data: any, params: any): Promise<any> {
    if (!this._connection) {
      this._connection = await this.createConnection()
    }
    return this._connection.promise().query(data, params)
  }

  async execute(sql: string, values: any | any[] | { [param: string]: any }): Promise<any> {
    if (!this._connection) {
      this._connection = await this.createConnection()
    }
    return this._connection.promise().execute(sql, values)
  }

  private async privateKeyToPem(privateKey: any): Promise<String> {
    const exported = await crypto.subtle.exportKey(
      "pkcs8",
      privateKey
    );

    const exportedAsString = String.fromCharCode.apply(null, new Uint8Array(exported))
    const exportedAsBase64 = Buffer.from(exportedAsString, 'binary').toString('base64')
    const pemExported = `-----BEGIN PRIVATE KEY-----\n${exportedAsBase64}\n-----END PRIVATE KEY-----`;

    return pemExported
  }

  private async createConnection(): Promise<Connection> {
    const keys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
    const csr = this.getCSR(keys)
    const fullURL = new URL(
      `${this._baseURL}/v1/organizations/${this._org}/databases/${this._db}/branches/${this.branch}/create-certificate`
    )
    type CertData = { certificate: string; certificate_chain: string; ports: { proxy: number }; remote_addr: string }
    const { response, body } = await postJSON<CertData>(fullURL, this._headers, { csr })

    const status = response.statusCode || 0
    if (status < 200 || status > 299) {
      throw new Error(`HTTP ${status}`)
    }

    const addr = `${this.branch}.${this._db}.${this._org}.${body.remote_addr}`

    const sslOpts = {
      servername: addr,
      cert: body.certificate,
      ca: body.certificate_chain,
      key: privateKeyToPem(keys.privateKey),
      rejectUnauthorized: false //todo(nickvanw) this should be replaced by a validation method
    }

    return mysql.createConnection({
      user: 'root',
      database: this._db,
      stream: tls.connect(body.ports['proxy'], addr, sslOpts)
    })
  }

  private async getCSR(keys: any): Promise<string> {
    const csr = await x509.Pkcs10CertificateRequestGenerator.create({
      name: `CN=${this._org}/${this._db}/${this.branch}`,
      keys,
      signingAlgorithm: alg,
      extensions: [
        new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyEncipherment),
      ],
    })

    return csr.toString("pem")
  }
}

function postJSON<T>(
  url: URL,
  headers: Record<string, string>,
  body: any
): Promise<{ response: IncomingMessage; body: T }> {
  const json = JSON.stringify(body)
  const options = {
    hostname: url.host,
    port: 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': json.length,
      ...headers
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let body = ''
      response.on('data', (chunk) => (body += chunk))
      response.on('end', () => resolve({ response, body: JSON.parse(body) }))
    })

    req.on('error', (e) => reject(e))
    req.write(json)
    req.end()
  })
}
