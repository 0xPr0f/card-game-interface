import addresses from "./contracts.json"
import { env } from "@/lib/env"

type ChainAddresses = {
  cardEngine?: string
  whotRuleset?: string
  whotManager?: string
  deployFromBlock?: number
}

const contractsByChain: Record<string, ChainAddresses> = addresses
const ZERO = "0x0000000000000000000000000000000000000000"
const isNonZero = (addr?: string) => !!addr && addr.toLowerCase() !== ZERO

export const getContracts = (chainId?: number) => {
  const key = (chainId ?? env.chainId).toString()
  const chainContracts = contractsByChain[key] ?? {}
  return {
    cardEngine:
      (isNonZero(env.cardEngineAddress) ? env.cardEngineAddress : undefined) ||
      chainContracts.cardEngine ||
      ZERO,
    whotRuleset:
      (isNonZero(env.whotRulesetAddress) ? env.whotRulesetAddress : undefined) ||
      chainContracts.whotRuleset ||
      ZERO,
    whotManager: env.whotManagerAddress || chainContracts.whotManager || "",
    deployFromBlock:
      env.deployFromBlock ||
      chainContracts.deployFromBlock ||
      0,
  }
}
