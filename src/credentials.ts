import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const prefix = 'equiviq-guides:v1:'

function encryptionKey(secret: string): Buffer {
  if (!secret) throw new Error('Payload secret is required to store the Equiviq API key')
  return createHash('sha256').update('equiviq-guides-api-key\0').update(secret).digest()
}

export function encryptGuideKey(value: string, secret: string): string {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), nonce)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${prefix}${Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url')}`
}

export function decryptGuideKey(value: string, secret: string): string {
  if (!value.startsWith(prefix)) throw new Error('Invalid stored Equiviq API key')
  const bytes = Buffer.from(value.slice(prefix.length), 'base64url')
  if (bytes.length < 29) throw new Error('Invalid stored Equiviq API key')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), bytes.subarray(0, 12))
  decipher.setAuthTag(bytes.subarray(12, 28))
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')
}
