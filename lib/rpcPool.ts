import {
  createPublicClient,
  http,
  type GetLogsParameters,
  type GetStorageAtParameters,
  type Log,
  type PublicClient,
  type ReadContractParameters,
} from "viem"

import { activeChain } from "@/config/web3Shared"
import { env } from "@/lib/env"

type RpcProvider = {
  url: string
  client: PublicClient
  maxLogRange?: bigint
}

type GetLogsOptions = {
  maxRange?: bigint | number
  maxConcurrent?: number
}

const DEFAULT_MAX_LOG_RANGE = 5_000n
const ALCHEMY_MAX_LOG_RANGE = 10n
const DEFAULT_BATCH_SIZE = 25
const DEFAULT_BATCH_WAIT_MS = 50
const DEFAULT_CONCURRENCY = 4

let rpcProviders: RpcProvider[] | null = null
let rrIndex = 0

const normalizeUrls = (urls: string[]) => urls.map((url) => url.trim()).filter(Boolean)

const inferMaxRange = (url: string): bigint => {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes("alchemy")) return ALCHEMY_MAX_LOG_RANGE
    if (host.includes("infura")) return 10_000n
  } catch {
    // ignore parse errors and use default
  }
  return DEFAULT_MAX_LOG_RANGE
}

const initRpcProviders = (): RpcProvider[] => {
  const urls = normalizeUrls(env.rpcUrls.length ? env.rpcUrls : [])
  const resolvedUrls = urls.length ? urls : activeChain.rpcUrls.default.http
  return resolvedUrls.map((url) => ({
    url,
    client: createPublicClient({
      chain: activeChain,
      transport: http(url, {
        batch: { batchSize: DEFAULT_BATCH_SIZE, wait: DEFAULT_BATCH_WAIT_MS },
        retryCount: 1,
        retryDelay: 300,
        timeout: 15_000,
      }),
    }),
    maxLogRange: inferMaxRange(url),
  }))
}

const getRpcProviders = () => {
  if (!rpcProviders) rpcProviders = initRpcProviders()
  return rpcProviders
}

const nextProviderOrder = (pool: RpcProvider[]) => {
  if (pool.length === 0) return []
  const start = rrIndex % pool.length
  rrIndex = (rrIndex + 1) % pool.length
  return [...pool.slice(start), ...pool.slice(0, start)]
}

const getErrorText = (error: unknown) => {
  if (!error) return ""
  const anyErr = error as { [key: string]: unknown }
  const parts: string[] = []
  const push = (value: unknown) => {
    if (value) parts.push(String(value))
  }
  push(anyErr.shortMessage)
  push(anyErr.message)
  push(anyErr.details)
  if (anyErr.cause && typeof anyErr.cause === "object") {
    push((anyErr.cause as { message?: string }).message)
    push((anyErr.cause as { shortMessage?: string }).shortMessage)
  }
  if (!parts.length) {
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }
  return parts.join(" | ")
}

const parseRangeLimit = (message: string): bigint | null => {
  const blockRangeMatch = message.match(/up to a (\d+) block range/i)
  if (blockRangeMatch?.[1]) return BigInt(blockRangeMatch[1])
  const hexRangeMatch = message.match(/\[(0x[0-9a-fA-F]+),\s*(0x[0-9a-fA-F]+)\]/)
  if (hexRangeMatch?.[1] && hexRangeMatch?.[2]) {
    const start = BigInt(hexRangeMatch[1])
    const end = BigInt(hexRangeMatch[2])
    return end >= start ? end - start + 1n : null
  }
  const maxMatch = message.match(/maximum (?:block )?range(?: is)? (\d+)/i)
  if (maxMatch?.[1]) return BigInt(maxMatch[1])
  return null
}

const isRangeError = (message: string) => {
  const text = message.toLowerCase()
  return (
    (text.includes("getlogs") && text.includes("range")) ||
    text.includes("block range") ||
    text.includes("too many results") ||
    text.includes("query returned more than")
  )
}

const normalizeMaxRange = (value?: bigint | number) => {
  if (typeof value === "bigint") return value
  if (typeof value === "number") return BigInt(Math.max(1, Math.floor(value)))
  return DEFAULT_MAX_LOG_RANGE
}

const splitBlockRange = (fromBlock: bigint, toBlock: bigint, maxRange: bigint) => {
  const range = maxRange > 0n ? maxRange : 1n
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = []
  let current = fromBlock
  while (current <= toBlock) {
    const end = current + range - 1n
    ranges.push({ fromBlock: current, toBlock: end > toBlock ? toBlock : end })
    current = end + 1n
  }
  return ranges
}

const fetchLogsChunked = async (
  client: PublicClient,
  params: GetLogsParameters,
  fromBlock: bigint,
  toBlock: bigint,
  maxRange: bigint,
  maxConcurrent: number,
) => {
  if (fromBlock > toBlock) return [] as Log[]
  if (maxRange <= 0n || toBlock - fromBlock + 1n <= maxRange) {
    return (await client.getLogs({ ...params, fromBlock, toBlock })) as Log[]
  }
  const ranges = splitBlockRange(fromBlock, toBlock, maxRange)
  const results: Log[] = []
  const concurrency = Math.max(1, maxConcurrent)
  for (let i = 0; i < ranges.length; i += concurrency) {
    const slice = ranges.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      slice.map((range) =>
        client.getLogs({
          ...params,
          fromBlock: range.fromBlock,
          toBlock: range.toBlock,
        }),
      ),
    )
    for (const logs of batchResults) results.push(...(logs as Log[]))
  }
  return results
}

const getLogsFromProvider = async (
  provider: RpcProvider,
  params: GetLogsParameters,
  options?: GetLogsOptions,
) => {
  const toBlock = params.toBlock ?? (await provider.client.getBlockNumber())
  const fromBlock = params.fromBlock ?? 0n
  if (typeof fromBlock !== "bigint" || typeof toBlock !== "bigint") {
    return (await provider.client.getLogs(params)) as Log[]
  }

  let maxRange = normalizeMaxRange(options?.maxRange ?? provider.maxLogRange)
  const maxConcurrent = options?.maxConcurrent ?? DEFAULT_CONCURRENCY

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const logs = await fetchLogsChunked(
        provider.client,
        params,
        fromBlock,
        toBlock,
        maxRange,
        maxConcurrent,
      )
      provider.maxLogRange = maxRange
      return logs
    } catch (error) {
      const message = getErrorText(error)
      const suggestedRange = parseRangeLimit(message)
      if (suggestedRange && suggestedRange > 0n && suggestedRange < maxRange) {
        maxRange = suggestedRange
        provider.maxLogRange = maxRange
        continue
      }
      if (isRangeError(message) && maxRange > 1n) {
        maxRange = maxRange / 2n
        provider.maxLogRange = maxRange
        continue
      }
      throw error
    }
  }

  return [] as Log[]
}

export const getLogsBalanced = async (params: GetLogsParameters, options?: GetLogsOptions) => {
  const providers = getRpcProviders()
  if (!providers.length) {
    throw new Error("No RPC providers configured")
  }
  const ordered = nextProviderOrder(providers)
  let lastError: unknown
  for (const provider of ordered) {
    try {
      return await getLogsFromProvider(provider, params, options)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error("Failed to load logs")
}

const raceProviders = async <T>(fn: (client: PublicClient) => Promise<T>) => {
  const providers = getRpcProviders()
  if (!providers.length) {
    throw new Error("No RPC providers configured")
  }
  const ordered = nextProviderOrder(providers)
  const calls = ordered.map((provider) => fn(provider.client))
  if (calls.length === 1) return calls[0]!
  try {
    return await Promise.any(calls)
  } catch (error) {
    if (error instanceof AggregateError) {
      const aggregate = error as AggregateError & { errors?: unknown[] }
      if (aggregate.errors?.length) throw aggregate.errors[0]
    }
    throw error
  }
}

export const readContractBalanced = async (params: ReadContractParameters) =>
  raceProviders((client) => client.readContract(params))

export const getStorageAtBalanced = async (params: GetStorageAtParameters) =>
  raceProviders((client) => client.getStorageAt(params))
