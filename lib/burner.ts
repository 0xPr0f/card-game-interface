import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const STORAGE_KEY = "whot-burner-key"
const BURNER_EVENT = "burner-updated"

const isBrowser = () => typeof window !== "undefined"

export const getStoredPrivateKey = (): `0x${string}` | null => {
  if (!isBrowser()) return null
  const key = window.localStorage.getItem(STORAGE_KEY)
  return key && key.startsWith("0x") ? (key as `0x${string}`) : null
}

export const getOrCreateBurnerAccount = () => {
  let key = getStoredPrivateKey()
  if (!key) {
    key = generatePrivateKey()
    if (isBrowser()) {
      window.localStorage.setItem(STORAGE_KEY, key)
      window.dispatchEvent(new Event(BURNER_EVENT))
    }
  }
  return privateKeyToAccount(key)
}

export const regenerateBurnerAccount = () => {
  const key = generatePrivateKey()
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, key)
    window.dispatchEvent(new Event(BURNER_EVENT))
  }
  return privateKeyToAccount(key)
}

export const exportBurner = () => {
  const key = getStoredPrivateKey()
  if (!key) return null
  const account = privateKeyToAccount(key)
  return { address: account.address, privateKey: key }
}

export const importBurnerPrivateKey = (input: string) => {
  const value = input.trim()
  if (!value) throw new Error("Private key required")
  const prefixed = value.startsWith("0x") ? value : `0x${value}`
  if (prefixed.length !== 66) throw new Error("Private key must be 32 bytes (64 hex chars)")
  const account = privateKeyToAccount(prefixed as `0x${string}`)
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, prefixed)
    window.dispatchEvent(new Event(BURNER_EVENT))
  }
  return account
}

export const onBurnerUpdated = (cb: () => void) => {
  if (!isBrowser()) return () => {}
  window.addEventListener(BURNER_EVENT, cb)
  return () => window.removeEventListener(BURNER_EVENT, cb)
}
