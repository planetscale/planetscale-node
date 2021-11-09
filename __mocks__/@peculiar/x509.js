jest.mock('@peculiar/x509', () => ({
  cryptoProvider: {
    set: jest.fn()
  },
  Pkcs10CertificateRequestGenerator: {
    create: jest.fn(async () => 'certificateRequestString')
  }
}))
