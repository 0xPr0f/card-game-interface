import { fallback, http, webSocket } from "viem"
import { defineChain } from "viem/utils"
import { sepolia } from "viem/chains"

import { env } from "@/lib/env"

const rpcUrls = env.rpcUrls.length ? env.rpcUrls : [sepolia.rpcUrls.default.http[0]!]
const rpcWsUrls = env.rpcWsUrls.length ? env.rpcWsUrls : ([])
const rpcUrl = rpcUrls[0]
const wsUrl = rpcWsUrls[0]

const baseRpcUrls: { http: readonly string[]; webSocket?: readonly string[] } = {
  http: rpcUrls,
  ...(rpcWsUrls.length ? { webSocket: rpcWsUrls } : {}),
}

const chain =
  env.chainId === sepolia.id
    ? {
      ...sepolia,
      rpcUrls: {
        default: baseRpcUrls,
        public: baseRpcUrls,
      },
    }
    : defineChain({
      id: env.chainId,
      name: `Chain ${env.chainId}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: {
        default: baseRpcUrls,
        public: baseRpcUrls,
      },
      blockExplorers: {
        default: { name: "Explorer", url: "https://etherscan.io" },
      },
    })

const transports = [
  ...rpcWsUrls.map((url: any) =>
    webSocket(url, {
      retryCount: 5,
      retryDelay: 1_500,
      keepAlive: true,
      reconnect: true,
    }),
  ),
  ...rpcUrls.map((url: any) =>
    http(url, {
      batch: { batchSize: 25, wait: 50 },
      retryCount: 3,
      retryDelay: 750,
      timeout: 15_000,
    }),
  ),
] as const

export const activeChain = chain
export const activeRpcUrl = rpcUrl
export const activeWsUrl = wsUrl
export const defaultTransport = fallback(transports, { rank: true, retryCount: 2, retryDelay: 500 })
