"use client"

import { useEffect, useMemo, useState } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useBalance, useChainId } from "wagmi"
import type { Address } from "viem"

import { Button } from "@/components/ui/button"
import { getOrCreateBurnerAccount, onBurnerUpdated } from "@/lib/burner"
import { activeChain } from "@/config/web3Shared"

// Custom RainbowKit button that shows chain + address and labels burner sessions.
export function CustomConnectButton() {
  const [burnerAddress, setBurnerAddress] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => {
      try {
        const account = getOrCreateBurnerAccount()
        setBurnerAddress(account.address.toLowerCase())
      } catch {
        setBurnerAddress(null)
      }
    }
    refresh()
    const off = onBurnerUpdated(refresh)
    window.addEventListener("storage", refresh)
    return () => {
      off()
      window.removeEventListener("storage", refresh)
    }
  }, [])

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted
        const connected = ready && !!account && !!chain
        const isBurner = burnerAddress && account?.address && account.address.toLowerCase() === burnerAddress
        const label = isBurner ? "Burner" : account?.displayName ?? "Wallet"

        return (
          <div
            aria-hidden={!ready}
            style={
              !ready
                ? {
                    opacity: 0,
                    pointerEvents: "none",
                    userSelect: "none",
                  }
                : undefined
            }
          >
            {!connected ? (
              <Button onClick={openConnectModal}>Connect Wallet</Button>
            ) : chain?.unsupported ? (
              <Button variant="destructive" onClick={openChainModal}>
                Wrong network
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={openChainModal} className="flex items-center gap-2">
                  {chain?.hasIcon ? (
                    <span
                      className="h-4 w-4 overflow-hidden rounded-full bg-secondary"
                      style={chain.iconBackground ? { background: chain.iconBackground } : undefined}
                    >
                      {chain.iconUrl ? <img alt={chain.name ?? "chain"} src={chain.iconUrl} className="h-4 w-4" /> : null}
                    </span>
                  ) : null}
                  <span>{chain?.name ?? "Network"}</span>
                </Button>
                <Button onClick={openAccountModal} className="flex items-center gap-2">
                  <span>{label}</span>
                  <BalanceLabel address={account?.address as Address | undefined} fallback={account?.displayBalance} />
                </Button>
              </div>
            )}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}

function BalanceLabel({ address, fallback }: { address?: Address; fallback?: string }) {
  const chainId = useChainId()
  const { data: balance } = useBalance({
    address,
    chainId: chainId ?? activeChain.id,
    query: { enabled: Boolean(address) },
    watch: true,
  })
  const formattedBalance = useMemo(() => {
    if (!balance) return null
    const value = Number(balance.formatted)
    const display = Number.isFinite(value) ? value.toFixed(4) : balance.formatted
    return `${display} ${balance.symbol}`
  }, [balance])

  if (!formattedBalance && !fallback) return null
  return <span className="text-xs text-muted-foreground">{formattedBalance ?? fallback}</span>
}
