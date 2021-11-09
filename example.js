const { PSDB } = require('./dist/index.js')
const conn = new PSDB('main')

async function main() {
  const [rows, fields] = await conn.execute('select * from likes')
  console.log(rows, fields)
}

main()
