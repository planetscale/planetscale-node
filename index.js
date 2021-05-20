const got = require('got')
const tls = require('tls')
const forge = require('node-forge')
const mysql = require('mysql2')

class PSDB {
  constructor(branch = 'development') {
    this.branch = branch;
    this._tokenname = process.env.PSDB_TOKEN_NAME;
    this._token = process.env.PSDB_TOKEN;
    var dbOrg = process.env.PSDB_DB_NAME.split('/')
    this._org = dbOrg[0]
    this._db = dbOrg[1]
    this._baseURL = 'https://api.planetscaledb.io'
    this._headers = {'Authorization': `${this._tokenname}:${this._token}`}
  }

  async query(data, params) {
    if (this._connection == null) {
      await this.createConnection()
    }
    return this._connection.promise().query(data, params)
  }

  async createConnection() {
    var keys = forge.pki.rsa.generateKeyPair(2048)
    var csr = this.getCSR(keys)
    var data = {'csr': csr}
    var fullURL = `${this._baseURL}/v1/organizations/${this._org}/databases/${this._db}/branches/${this.branch}/create-certificate`
    const {body} = await got.post(fullURL, {
      json: data,
      responseType: 'json',
      headers: this._headers
    });

    const hostPort = body.remote_addr.split(':')

    var sslOpts = {
      servername: `${this._org}/${this._db}/${this.branch}`,
      cert: body.certificate,
      ca: body.certificate_chain,
      key: forge.pki.privateKeyToPem(keys.privateKey),
      rejectUnauthorized: false //todo(nickvanw) this should be replaced by a validation method
    }

    this._connection = mysql.createConnection({
      user: 'root',
      database: this._db,
      password: await this.getPassword(),
      stream: tls.connect(hostPort[1], hostPort[0], sslOpts)
    })

    return this._connection
  }

  async getPassword() {
    var pwURL = `${this._baseURL}/v1/organizations/${this._org}/databases/${this._db}/branches/${this.branch}/status`
    const {body} = await got.get(pwURL, {
      responseType: 'json',
      headers: this._headers
    })

    return body.mysql_gateway_pass
  }

  getCSR(keys) {
    var csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey
    csr.setSubject([{
      name: 'commonName',
      value: `${this._org}/${this._db}/${this.branch}`
    }])
    csr.version = 1
    csr.siginfo.algorithmOid = 'sha256'
    csr.sign(keys.privateKey)
    return forge.pki.certificationRequestToPem(csr)
  }
}

module.exports = PSDB;
