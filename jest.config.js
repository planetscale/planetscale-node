/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/__mocks__/@peculiar/x509.js', '<rootDir>/__mocks__/@peculiar/crypto.js']
}
