# planetscale-node

⚠️ Do not use this package. It is from PlanetScale's early beta and no longer necessary. To use PlanetScale with a Node.js application, follow our [Node.js guide](https://planetscale.com/docs/tutorials/connect-nodejs-app). PlanetScale is MySQL compatible and you can expect it to work with any MySQL node compatible library. For applications that require edge (http) connectivity, we recommend [database.js](https://github.com/planetscale/database-js) ⚠️

## Installation

```
$ npm install planetscale-node
```

## Setup

This code uses the PlanetScale API to provision a TLS certificate, and then connects to the database. It uses Service Tokens for authentication, so you'll need to create one for the app:

```bash
~> pscale service-token create
  NAME           TOKEN
 -------------- ------------------------------------------
  nyprhd2z6bd3   [REDACTED]

~> pscale service-token add-access nyprhd2z6bd3 connect_production_branch --database [YOUR DB]
  DATABASE   ACCESSES
 ---------- ---------------------------
  [YOUR DB]       connect_production_branch
```

## Usage

Set the following environment variables in your application.

```bash
export PLANETSCALE_TOKEN='[REDACTED]'
export PLANETSCALE_TOKEN_NAME='nyprhd2z6bd3'
export PLANETSCALE_ORG='[YOUR ORG]'
export PLANETSCALE_DB='[YOUR DB NAME]'
```

```javascript
const { PSDB } = require('planetscale-node')
const conn = new PSDB('main')

async function main() {
  const [rows, fields] = await conn.query('select * from reminders')
  console.log(rows, fields)
}

main()
```

### Using prepared statements

```javascript
const { PSDB } = require('planetscale-node')
const conn = new PSDB('main')

async function main() {
  const [rows, fields] = await conn.execute('select * from reminders where id > ?', [10])
  console.log(rows, fields)
}

main()
```
