import { generateKeyPair, generateSSLKey, generateKeys } from '../webcrypto'

describe('webcrypto', () => {
  it('generateKeyPair', async () => {
    return generateKeyPair().then((data) => {
      expect(data).toHaveProperty('publicKey')
      expect(data).toHaveProperty('privateKey')
    })
  })

  it('generateSSLKey', async () => {
    const kayPair = await generateKeyPair()
    return generateSSLKey(kayPair.privateKey).then((data) => {
      expect(data).toContain('-----BEGIN PRIVATE KEY-----')
      expect(data).toContain('-----END PRIVATE KEY-----')
    })
  })

  it('generateKeys', async () => {
    return generateKeys().then((data) => {
      expect(data).toHaveProperty('certificateString')
      expect(data).toHaveProperty('sslKey')
      expect(data.certificateString).toEqual('certificateRequestString')
    })
  })
})
