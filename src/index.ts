import * as mysql from 'mysql2'
import type { Connection, ConnectionOptions } from 'mysql2'
import { customAlphabet } from 'nanoid'

import { HttpClient } from './lib/httpClient'
import { generateKeys } from './lib/webcrypto'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12)

type CertificateData = { id: string; certificate: string; database_branch: { access_host_url: string } }

export class PSDB {
  private branch: string
  private connectionOptions: ConnectionOptions
  private _tokenname: string | undefined
  private _token: string | undefined
  private _org: string | undefined
  private _db: string | undefined
  private _baseURL: string
  private _headers: { Authorization: string }
  private _connection: Connection | null = null
  private _httpClient: HttpClient

  constructor(branch = 'main', connectionOptions = {}) {
    this.branch = branch
    this._tokenname = process.env.PLANETSCALE_TOKEN_NAME
    this._token = process.env.PLANETSCALE_TOKEN
    this._org = process.env.PLANETSCALE_ORG
    this._db = process.env.PLANETSCALE_DB
    this._baseURL = 'https://api.planetscale.com'
    this.connectionOptions = connectionOptions
    this._headers = { Authorization: `${this._tokenname}:${this._token}` }
    this._httpClient = new HttpClient({ headers: this._headers })
  }

  async query(data: any, params: any): Promise<any> {
    if (!this._connection) {
      this._connection = await this._createConnection()
    }

    return this._connection.promise().query(data, params)
  }

  async execute(sql: string, values: any | any[] | { [param: string]: any }): Promise<any> {
    if (!this._connection) {
      this._connection = await this._createConnection()
    }

    return this._connection.promise().execute(sql, values)
  }

  private async _generateCertificate(_certificateString: string): Promise<CertificateData> {
    const displayName = `pscale-node-${nanoid()}`
    const requestUrl = new URL(
      `${this._baseURL}/v1/organizations/${this._org}/databases/${this._db}/branches/${this.branch}/certificates`
    )
    const { response, body } = await this._httpClient.post<CertificateData>(requestUrl, {
      csr: _certificateString,
      display_name: displayName
    })

    const status = response.statusCode || 0
    if (status < 200 || status > 299) {
      throw new Error(`HTTP ${status}`)
    }

    return body
  }

  private async _createConnection(): Promise<Connection> {
    const { certificateString, sslKey } = await generateKeys()
    const certificateResponse = await this._generateCertificate(certificateString)

    const addr = certificateResponse.database_branch.access_host_url

    return mysql.createConnection({
      ...this.connectionOptions,
      user: certificateResponse.id,
      host: addr,
      database: this._db,
      ssl: {
        key: sslKey,
        cert: certificateResponse.certificate,
        rejectUnauthorized: true
      }
    })
  }
}
