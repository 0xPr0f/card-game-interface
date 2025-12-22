import { createWalletClient, type Chain } from "viem"
import type { Account } from "viem/accounts"
import { createConnector } from "wagmi"

import { getOrCreateBurnerAccount, onBurnerUpdated } from "@/lib/burner"
import { activeChain, defaultTransport } from "./web3Shared"

const pickChain = (chains: readonly Chain[], chainId?: number) =>
  chains.find((c) => c.id === (chainId ?? activeChain.id)) ?? chains[0]

export const createBurnerConnector = (account?: Account) =>
  createConnector((config) => {
    const resolveAccount = () => account ?? getOrCreateBurnerAccount()
    let burnerAccount = resolveAccount()
    let connectedChainId = activeChain.id

    const getClient = (chainId?: number) => {
      burnerAccount = resolveAccount()
      const chain = pickChain(config.chains, chainId ?? connectedChainId)
      connectedChainId = chain.id
      const transport = config.transports?.[chain.id] ?? defaultTransport
      return createWalletClient({
        account: burnerAccount,
        chain,
        transport,
      })
    }

    let walletClient = getClient()
    const syncAccount = () => {
      const next = resolveAccount()
      if (next.address.toLowerCase() !== burnerAccount.address.toLowerCase()) {
        burnerAccount = next
        walletClient = getClient(connectedChainId)
        config.emitter.emit("change", { accounts: [burnerAccount.address] })
      }
    }

    if (typeof window !== "undefined") {
      onBurnerUpdated(syncAccount)
      window.addEventListener("storage", syncAccount)
    }

    return {
      id: "burner",
      name: "Burner Wallet",
      type: "burner",
      async connect({ chainId } = {}) {
        syncAccount()
        walletClient = getClient(chainId)
        const connectedChainId = walletClient.chain?.id ?? activeChain.id
        config.emitter.emit("connect", { accounts: [burnerAccount.address], chainId: connectedChainId })
        return { accounts: [burnerAccount.address], chainId: connectedChainId }
      },
      async disconnect() {
        config.emitter.emit("disconnect")
      },
      async getAccounts() {
        syncAccount()
        return [burnerAccount.address]
      },
      async getChainId() {
        return walletClient.chain?.id ?? activeChain.id
      },
      async getProvider({ chainId } = {}) {
        syncAccount()
        walletClient = getClient(chainId)
        return walletClient.transport
      },
      async getClient({ chainId } = {}) {
        syncAccount()
        walletClient = getClient(chainId)
        return walletClient as unknown as ReturnType<typeof createWalletClient>
      },
      async isAuthorized() {
        return true
      },
      async switchChain({ chainId }) {
        walletClient = getClient(chainId)
        const nextChainId = walletClient.chain?.id ?? chainId
        config.emitter.emit("change", { chainId: nextChainId })
        return pickChain(config.chains, chainId)
      },
      onAccountsChanged(accounts) {
        if (!accounts.length) this.onDisconnect()
        else config.emitter.emit("change", { accounts })
      },
      onChainChanged(chainId) {
        config.emitter.emit("change", { chainId: Number(chainId) })
      },
      onDisconnect() {
        config.emitter.emit("disconnect")
      },
    }
  })
