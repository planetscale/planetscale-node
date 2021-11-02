import * as https from 'https'
import * as mysql from 'mysql2'
import type { Connection } from 'mysql2'
import type { IncomingMessage } from 'http'
import { customAlphabet } from 'nanoid'
import * as crypto from 'crypto'
import { Crypto as webCryptoPolyfill } from '@peculiar/webcrypto'
import * as x509 from '@peculiar/x509'

// Define interface for webcrypto. This is not available (yet)
// in TypeScript for the native webcrypto so we need this to
// satisfy the rest of the type checks.
//
// This definition is the same as what @peculiar/webcrypto uses
// which functions as a polyfill for Node versions earlier than Node 15
// which don't provide webcrypto.
interface WebCrypto {
  readonly subtle: SubtleCrypto
  getRandomValues<T extends ArrayBufferView | null>(array: T): T
}

let webcrypto = crypto.webcrypto as unknown as WebCrypto
// Need to cast here first to unknown and then to WebCrypto since
// TypeScript doesn't know about WebCrypto as a specific type.
if (crypto.webcrypto == undefined) {
  console.warn(
    'No native webcrypto available, using @peculiar/webcrypto polyfill. Please upgrade to Node 15 or later to avoid this warning.'
  )
  webcrypto = new webCryptoPolyfill()
}

x509.cryptoProvider.set(webcrypto)
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12)
const nodeBtoa = (str: string): string => Buffer.from(str, 'binary').toString('base64')
const base64encode = typeof btoa !== 'undefined' ? btoa : nodeBtoa

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

  private async createConnection(): Promise<Connection> {
    const alg = {
      name: 'ECDSA',
      namedCurve: 'P-256',
      hash: 'SHA-256'
    }

    const keyPair = await webcrypto.subtle.generateKey(alg, true, ['sign', 'verify'])

    if (!keyPair.privateKey) {
      throw new Error('Failed to generate keypair')
    }

    const csr = await x509.Pkcs10CertificateRequestGenerator.create({
      keys: keyPair,
      signingAlgorithm: alg
    })

    const fullURL = new URL(
      `${this._baseURL}/v1/organizations/${this._org}/databases/${this._db}/branches/${this.branch}/certificates`
    )

    const displayName = `pscale-node-${nanoid()}`

    type CertData = { id: string; certificate: string; database_branch: { access_host_url: string } }
    const { response, body } = await postJSON<CertData>(fullURL, this._headers, {
      csr: csr.toString(),
      display_name: displayName
    })

    const status = response.statusCode || 0
    if (status < 200 || status > 299) {
      throw new Error(`HTTP ${status}`)
    }

    const addr = body.database_branch.access_host_url

    const exportPrivateKey = await webcrypto.subtle.exportKey('pkcs8', keyPair.privateKey)
    const exportedAsString = String.fromCharCode.apply(null, Array.from(new Uint8Array(exportPrivateKey)))
    const exportedAsBase64 = base64encode(exportedAsString)
    const pemExported = `-----BEGIN PRIVATE KEY-----\n${exportedAsBase64}\n-----END PRIVATE KEY-----`

    return mysql.createConnection({
      user: body.id,
      host: addr,
      database: this._db,
      ssl: {
        key: pemExported,
        cert: body.certificate,
        rejectUnauthorized: true
      }
    })
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
