import * as crypto from 'crypto'
import { Crypto as webCryptoPolyfill } from '@peculiar/webcrypto'
import * as x509 from '@peculiar/x509'

import { algorithm } from '../constants/webcrypto'

const nodeBtoa = (str: string): string => Buffer.from(str, 'binary').toString('base64')
const base64encode = typeof btoa !== 'undefined' ? btoa : nodeBtoa

// Define interface for webcrypto. This is not available (yet)
// in TypeScript for the native webcrypto so we need this to
// satisfy the rest of the type checks.
//
// This definition is the same as what @peculiar/webcrypto uses
// which functions as a polyfill for Node versions earlier than Node 15
// which don't provide webcrypto.
interface WebCrypto {
  readonly subtle: SubtleCrypto
  getRandomValues<T extends ArrayBufferView | null>(array: T): T
}

let webcrypto = crypto.webcrypto as unknown as WebCrypto
// Need to cast here first to unknown and then to WebCrypto since
// TypeScript doesn't know about WebCrypto as a specific type.
if (crypto.webcrypto == undefined) {
  console.warn(
    'No native webcrypto available, using @peculiar/webcrypto polyfill. Please upgrade to Node 15 or later to avoid this warning.'
  )
  webcrypto = new webCryptoPolyfill()
}

x509.cryptoProvider.set(webcrypto)

/**
 * Generates key pair with webcrypto
 * @returns Object of public and private crypto keys
 */
export async function generateKeyPair(): Promise<{
  privateKey: CryptoKey
  publicKey: CryptoKey
}> {
  const keyPair = await webcrypto.subtle.generateKey(algorithm, true, ['sign', 'verify'])

  if (!keyPair.privateKey || !keyPair.publicKey) {
    throw new Error('Failed to generate keypair')
  }

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey
  }
}

/**
 * Generates SSL key with given private crypto key
 * @param _privateCryptoKey CryptoKey
 * @returns {string} Generated SSL key
 */
export async function generateSSLKey(_privateCryptoKey: CryptoKey): Promise<string> {
  const exportPrivateKey = await webcrypto.subtle.exportKey('pkcs8', _privateCryptoKey)
  const exportedAsString = String.fromCharCode.apply(null, Array.from(new Uint8Array(exportPrivateKey)))
  const exportedAsBase64 = base64encode(exportedAsString)
  const pemExported = `-----BEGIN PRIVATE KEY-----\n${exportedAsBase64}\n-----END PRIVATE KEY-----`

  return pemExported
}

/**
 * Generates certificate string and SSL key with generated crypto key pair
 * @returns { certificateString, sslKey } Object of certificate string and SSL key
 */
export async function generateKeys(): Promise<{
  certificateString: string
  sslKey: string
}> {
  const keyPair = await generateKeyPair()

  const certificateString = await x509.Pkcs10CertificateRequestGenerator.create({
    keys: keyPair,
    signingAlgorithm: algorithm
  }).then((csr) => csr.toString())

  const sslKey = await generateSSLKey(keyPair.privateKey)

  return { certificateString, sslKey }
}
