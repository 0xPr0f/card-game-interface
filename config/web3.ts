import { createConfig } from "wagmi"
import { connectorsForWallets } from "@rainbow-me/rainbowkit"
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  rabbyWallet,
  walletConnectWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets"
import type { Account } from "viem/accounts"

import { getOrCreateBurnerAccount } from "@/lib/burner"
import { activeChain, defaultTransport, activeRpcUrl, activeWsUrl } from "./web3Shared"
import { env } from "@/lib/env"
import { createBurnerConnector } from "./burnerConnector"

const walletConnectProjectId = env.walletConnectProjectId || "demo"
export { activeChain, activeRpcUrl, activeWsUrl }

export const createWagmiConfig = (options: { burnerAccount?: Account | null } = {}) => {
  const burnerAccount = options.burnerAccount ?? getOrCreateBurnerAccount()
  const rkConnectors = connectorsForWallets([
    {
      groupName: "Popular",
      wallets: [
        () => injectedWallet({ chains: [activeChain] }),
        () => metaMaskWallet({ chains: [activeChain], projectId: walletConnectProjectId }),
        () => rainbowWallet({ chains: [activeChain], projectId: walletConnectProjectId }),
        () => rabbyWallet({ chains: [activeChain] }),
        () => walletConnectWallet({ chains: [activeChain], projectId: walletConnectProjectId }),
        () => coinbaseWallet({ chains: [activeChain], appName: "Whot On-Chain" }),
      ],
    },
  ], {
    appName: "Whot On-Chain",
    projectId: walletConnectProjectId,
  })

  return createConfig({
    chains: [activeChain],
    transports: {
      [activeChain.id]: defaultTransport,
    },
    connectors: [
      createBurnerConnector(burnerAccount),
      ...rkConnectors,
    ],
    multiInjectedProviderDiscovery: false,
    pollingInterval: 4_000,
    ssr: true,
  })
}
