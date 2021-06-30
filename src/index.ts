import * as https from 'https'
import * as tls from 'tls'
import * as forge from 'node-forge'
import * as mysql from 'mysql2'
import type { Connection, RowDataPacket, OkPacket, ResultSetHeader, FieldPacket, QueryOptions } from 'mysql2'
import type { IncomingMessage } from 'http'

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

  public async query<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[] | ResultSetHeader>(
    sql: string | QueryOptions,
    values?: any | any[] | { [param: string]: any }
  ): Promise<[T, FieldPacket[]]> {
    if (!this._connection) {
      this._connection = await this.createConnection()
    }
    // we can cheat by using `as any` rather than spelling out each overload instance
    return this._connection.promise().query<T>(sql as any, values)
  }

  public async execute<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[] | ResultSetHeader>(
    sql: string | QueryOptions,
    values?: any | any[] | { [param: string]: any }
  ): Promise<[T, FieldPacket[]]> {
    if (!this._connection) {
      this._connection = await this.createConnection()
    }
    // we can cheat by using `as any` rather than spelling out each overload instance
    return this._connection.promise().execute<T>(sql as any, values)
  }

  private async createConnection(): Promise<Connection> {
    const keys = forge.pki.rsa.generateKeyPair(2048)
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
      key: forge.pki.privateKeyToPem(keys.privateKey),
      rejectUnauthorized: false //todo(nickvanw) this should be replaced by a validation method
    }

    return mysql.createConnection({
      user: 'root',
      database: this._db,
      stream: tls.connect(body.ports['proxy'], addr, sslOpts)
    })
  }

  private getCSR(keys: any): any {
    const csr = forge.pki.createCertificationRequest()
    csr.publicKey = keys.publicKey
    csr.setSubject([
      {
        name: 'commonName',
        value: `${this._org}/${this._db}/${this.branch}`
      }
    ])
    csr.version = 1
    csr.siginfo.algorithmOid = 'sha256'
    csr.sign(keys.privateKey)
    return forge.pki.certificationRequestToPem(csr)
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
