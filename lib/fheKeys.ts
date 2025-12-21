const KEY_PREFIX = "whot-fhe-keys"

export type FheKeypair = {
  publicKey: `0x${string}`
  privateKey: `0x${string}`
}

export const getFheKeypair = (chainId: number, address: string): FheKeypair | null => {
  if (typeof window === "undefined") return null
  if (!address) return null
  const key = `${KEY_PREFIX}:${chainId}:${address.toLowerCase()}`
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FheKeypair
    if (!parsed?.publicKey || !parsed?.privateKey) return null
    return parsed
  } catch {
    return null
  }
}

export const saveFheKeypair = (chainId: number, address: string, keypair: FheKeypair) => {
  if (typeof window === "undefined") return
  if (!address) return
  const key = `${KEY_PREFIX}:${chainId}:${address.toLowerCase()}`
  try {
    window.localStorage.setItem(key, JSON.stringify(keypair))
  } catch {
    // ignore storage failures
  }
}
