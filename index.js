const https = require('https')
const tls = require('tls')
const forge = require('node-forge')
const mysql = require('mysql2')

class PSDB {
  constructor(branch = 'main') {
    this.branch = branch
    this._tokenname = process.env.PSDB_TOKEN_NAME
    this._token = process.env.PSDB_TOKEN
    const dbOrg = process.env.PSDB_DB_NAME.split('/')
    this._org = dbOrg[0]
    this._db = dbOrg[1]
    this._baseURL = 'https://api.planetscale.com'
    this._headers = { Authorization: `${this._tokenname}:${this._token}` }
  }

  async query(data, params) {
    if (this._connection == null) {
      await this.createConnection()
    }
    return this._connection.promise().query(data, params)
  }

  async createConnection() {
    const keys = forge.pki.rsa.generateKeyPair(2048)
    const csr = this.getCSR(keys)
    const fullURL = new URL(
      `${this._baseURL}/v1/organizations/${this._org}/databases/${this._db}/branches/${this.branch}/create-certificate`
    )
    const { response, body } = await postJSON(fullURL, this._headers, { csr })

    if (response.statusCode < 200 || response.statusCode > 299) {
      throw new Error(`HTTP ${response.statusCode}`)
    }

    const addr = `${this.branch}.${this._db}.${this._org}.${body.remote_addr}`

    const sslOpts = {
      servername: addr,
      cert: body.certificate,
      ca: body.certificate_chain,
      key: forge.pki.privateKeyToPem(keys.privateKey),
      rejectUnauthorized: false //todo(nickvanw) this should be replaced by a validation method
    }

    this._connection = mysql.createConnection({
      user: 'root',
      database: this._db,
      stream: tls.connect(body.ports['proxy'], addr, sslOpts)
    })

    return this._connection
  }

  getCSR(keys) {
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

function postJSON(url, headers, body) {
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

module.exports = PSDB
