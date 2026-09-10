/**
 * 客户端 AES-GCM 加密（Web Crypto）。
 * 设备密钥存于 localStorage；仅防普通窥探，无法对抗本机恶意程序或 XSS。
 * 仍是纯客户端方案，不是端到端云加密。
 */

const DEVICE_KEY_LS = 'pp-device-aes-key-v1'
const APP_SALT = 'personal-planner-v1-aes'

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  let rawB64 = localStorage.getItem(DEVICE_KEY_LS)
  if (!rawB64) {
    const raw = crypto.getRandomValues(new Uint8Array(32))
    rawB64 = b64encode(raw)
    localStorage.setItem(DEVICE_KEY_LS, rawB64)
  }
  const raw = b64decode(rawB64)
  // 混入应用盐再导入，避免裸 key 直接当 AES key（仍存本机）
  const mixed = new Uint8Array(32)
  const saltBytes = new TextEncoder().encode(APP_SALT)
  for (let i = 0; i < 32; i++) {
    mixed[i] = raw[i % raw.length] ^ saltBytes[i % saltBytes.length]
  }
  return crypto.subtle.importKey('raw', mixed, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/** 加密明文，返回 base64(iv[12] + ciphertext) */
export async function encryptSecret(plain: string): Promise<string> {
  if (!plain) return ''
  const key = await getOrCreateDeviceKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plain)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const out = new Uint8Array(iv.length + cipher.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(cipher), iv.length)
  return b64encode(out)
}

/** 解密；失败时返回空字符串 */
export async function decryptSecret(payload: string): Promise<string> {
  if (!payload) return ''
  try {
    const all = b64decode(payload)
    if (all.length < 13) return ''
    const iv = all.slice(0, 12)
    const data = all.slice(12)
    const key = await getOrCreateDeviceKey()
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(plain)
  } catch {
    return ''
  }
}

export const CRYPTO_LIMITATION_ZH =
  'API Key 使用 Web Crypto AES-GCM 加密后保存在本机 IndexedDB；密钥派生自本设备 localStorage。仍属客户端方案：清除站点数据会丢失，也无法防止本机恶意软件或 XSS。'
