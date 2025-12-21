"use client"

import { useEffect, useState } from "react"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"

import { activeChain, createWagmiConfig } from "@/config/web3"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
export function Providers({ children }: { children: React.ReactNode }) {
  const [wagmiConfig] = useState(() => createWagmiConfig())
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  const [mounted, setMounted] = useState(false)

  // Delay RainbowKit until client render to avoid SSR localStorage access.
  useEffect(() => setMounted(true), [])

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        {mounted ? (
          <RainbowKitProvider chains={[activeChain]}>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
              {children}
              <Toaster richColors position="top-right" />
            </ThemeProvider>
          </RainbowKitProvider>
        ) : (
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        )}
      </WagmiProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  )
}
