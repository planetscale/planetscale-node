const path = require('path');
const os = require('os');
const childProcess = require("child_process");
const pscalePath = path.resolve(__dirname, 'pscale-'+os.platform())

exports.startProxy = function(branch) {
  var tokenName = process.env.PSDB_TOKEN_NAME
  var token = process.env.PSDB_TOKEN
  var dbInfo = process.env.PSDB_DB_NAME.split('/')
  var runnable = childProcess.spawn(pscalePath, ['--service-token-name', tokenName, '--service-token', token, 'connect', dbInfo[1], branch], {
    detached: false
  })
  
  runnable.stdout.on('data', function(data) {
    console.log(data.toString());
  })
}

exports.dbPass = function(branch) {
  var tokenName = process.env.PSDB_TOKEN_NAME
  var token = process.env.PSDB_TOKEN
  var dbInfo = process.env.PSDB_DB_NAME.split('/')

  var command = [pscalePath, '--service-token-name', tokenName, '--service-token', token, 'branch', '--json', 'status', dbInfo[1], branch]

  var branchInfo = childProcess.execSync(command.join(' ')).toString()
  return JSON.parse(branchInfo).password
}

