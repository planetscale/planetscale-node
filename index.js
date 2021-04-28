const mysql = require('mysql2')
const tls = require('tls');

class PSDB {
  constructor(branch = 'main') {
    this.branch = branch;
    this._cert = process.env.PSDB_CERT
    this._ca = process.env.PSDB_CA
    this._key = process.env.PSDB_PRIVATE_KEY
    var dbOrg = process.env.PSDB_DB.split('/')
    this._org = dbOrg[0]
    this._db = dbOrg[1]

    this._host = `${this.branch}.${this._db}.${this._org}.us-east-1.psdb.cloud`
    this._port = 3307
  }

  async query(data, params) {
    if (this._connection == null) {
      await this.createConnection()
    }
    return this._connection.promise().query(data, params)
  }

  async createConnection() {
    this._connection = mysql.createConnection({
      user: 'root',
      database: this._db,
      stream: tls.connect(this._port, this._host, this.sslOpts())
    })

    return this._connection
  }

  sslOpts() {
    return {
      servername: this._host,
      cert: this._cert,
      //  ca: this._ca,
      key: this._key,
      rejectUnauthorized: false //todo(nickvanw) this should be replaced by a validation method
    }
  }
}

module.exports = PSDB;
