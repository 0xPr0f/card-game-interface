"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Loader2, Plus, Users, Settings, Hash } from "lucide-react"
import { toast } from "sonner"
import { useAccount, useConnect, usePublicClient } from "wagmi"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { describeCard } from "@/lib/cards"
import { useCardGameActions } from "@/hooks/useCardGameActions"
import { activeChain } from "@/config/web3Shared"
import { useGameFeed } from "@/hooks/useGameFeed"
import { WhotCard } from "@/components/whot-card"
import { CustomConnectButton } from "@/components/custom-connect-button"
import { SettingsPopover } from "@/components/home/SettingsPopover"
import { exportBurner, importBurnerPrivateKey, regenerateBurnerAccount } from "@/lib/burner"
import { useRuleEnforcement } from "@/lib/uiSettings"

const statusLabel: Record<number, string> = {
  0: "Open",
  1: "Started",
  2: "Ended",
}

const parseGameId = (value: string): bigint | null => {
  try {
    return BigInt(value.trim())
  } catch {
    return null
  }
}

// Ethereum Logo SVG Component
const EthLogo = () => (
  <svg width="14" height="22" viewBox="0 0 14 22" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
    <path d="M6.86699 0.179688L6.72852 0.643204V15.018L6.86699 15.1544L13.7317 11.168L6.86699 0.179688Z" fill="#343434" fillOpacity="0.6"/>
    <path d="M6.8668 0.179688L0 11.168L6.8668 15.1544V8.0463V0.179688Z" fill="#343434" fillOpacity="0.6"/>
    <path d="M6.86694 16.3887L6.75684 16.5222V21.4984L6.86694 21.8203L13.7344 12.4043L6.86694 16.3887Z" fill="#343434" fillOpacity="0.6"/>
    <path d="M6.8668 21.8203V16.3887L0 12.4043L6.8668 21.8203Z" fill="#343434" fillOpacity="0.6"/>
    <path d="M6.86699 15.1544V8.04626L13.7317 11.168L6.86699 15.1544Z" fill="#181818" fillOpacity="0.6"/>
    <path d="M0 11.168L6.8668 8.04626V15.1544L0 11.168Z" fill="#181818" fillOpacity="0.6"/>
  </svg>
)

// Mini Card Stack Component for Game Cards
const CardStack = ({ value }: { value: string | number }) => (
  <div className="relative w-12 h-16 mr-6">
    {/* Left Card */}
    <div className="absolute inset-0 bg-white border border-gray-200 rounded shadow-sm transform transition-all duration-500 ease-out group-hover:-translate-x-4 group-hover:-rotate-12 group-hover:bg-gray-50 origin-bottom-right" />

    {/* Right Card */}
    <div className="absolute inset-0 bg-white border border-gray-200 rounded shadow-sm transform transition-all duration-500 ease-out group-hover:translate-x-4 group-hover:rotate-12 group-hover:bg-gray-50 origin-bottom-left" />

    {/* Center/Top Card */}
    <div className="absolute inset-0 bg-white border border-gray-200 rounded shadow-sm flex items-center justify-center z-10 transform transition-all duration-500 ease-out group-hover:-translate-y-1.5 group-hover:shadow-md">
      <span className="text-[var(--whot-red)] font-serif font-bold text-lg">{value}</span>
      <div className="absolute top-0.5 left-1 text-[0.5rem] text-[var(--whot-red)] font-serif font-bold leading-none">{value}</div>
      <div className="absolute bottom-0.5 right-1 text-[0.5rem] text-[var(--whot-red)] font-serif font-bold leading-none rotate-180">{value}</div>
    </div>
  </div>
)

// Join Widget Component
const JoinWidget = ({ joinId, setJoinId, onJoin, disabled }: {
  joinId: string
  setJoinId: (v: string) => void
  onJoin: () => void
  disabled: boolean
}) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
        <Hash className="w-4 h-4" />
      </div>
      <h4 className="font-serif text-lg font-bold text-gray-900">Quick Join</h4>
    </div>

    <div className="flex flex-col gap-3">
      <div className="relative">
        <Input
          type="text"
          placeholder="Enter Game ID..."
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[var(--whot-red)]/10 focus:border-[var(--whot-red)] transition-all placeholder:text-gray-400"
        />
      </div>
      <button
        onClick={onJoin}
        disabled={disabled || !joinId}
        className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-[var(--whot-red)] hover:shadow-lg hover:shadow-red-900/20 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Join Room
      </button>
    </div>

    <p className="mt-4 text-center text-xs text-gray-400">
      Looking for a specific table? Enter the ID above.
    </p>
  </div>
)

export function NewHome() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { connectAsync, connectors } = useConnect()
  const { createGame, joinGame, isConnected: canTransact } = useCardGameActions()
  const chainId = publicClient?.chain?.id ?? activeChain.id
  const queryClient = useQueryClient()

  const {
    data: indexedGames,
    isFetching,
    isPending,
    isError,
    error,
  } = useGameFeed(publicClient)
  const games = useMemo(() => indexedGames ?? [], [indexedGames])
  const isFeedLoading = isPending || isFetching

  const [proposedPlayers, setProposedPlayers] = useState<string[]>([""])
  const [maxPlayers, setMaxPlayers] = useState(2)
  const [initialHandSize, setInitialHandSize] = useState(5)
  const [joinId, setJoinId] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [burnerPk, setBurnerPk] = useState("")
  const [rouletteMode, setRouletteMode] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const burnerInfo = exportBurner()
  const burnerAddress = burnerInfo?.address ?? ""
  const isBurnerConnected = Boolean(
    address && burnerAddress && address.toLowerCase() === burnerAddress.toLowerCase(),
  )
  const { enabled: enforceRules, setEnabled: setEnforceRules } = useRuleEnforcement()

  useEffect(() => setIsMounted(true), [])

  const handleBurnerConnect = async () => {
    const burner = connectors.find((c) => c.id === "burner")
    if (!burner) {
      toast.error("Burner connector unavailable")
      return
    }
    await connectAsync({ connector: burner, chainId })
  }

  const addPlayerField = () => setProposedPlayers((prev) => [...prev, ""])
  const updatePlayer = (idx: number, value: string) =>
    setProposedPlayers((prev) => prev.map((p, i) => (i === idx ? value : p)))
  const removePlayer = (idx: number) =>
    setProposedPlayers((prev) => prev.filter((_, i) => i !== idx))

  const handleCopyBurner = async () => {
    const data = exportBurner()
    if (!data) {
      toast.error("No burner found")
      return
    }
    await navigator.clipboard.writeText(data.privateKey)
    toast.success("Burner key copied")
  }


  const handleImportBurner = () => {
    try {
      const account = importBurnerPrivateKey(burnerPk)
      setBurnerPk("")
      toast.success("Burner imported", { description: account.address })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed"
      toast.error(message)
    }
  }

  const handleResetBurner = () => {
    const account = regenerateBurnerAccount()
    toast.success("Burner reset", { description: account.address })
  }

  const handleCreateGame = async () => {
    try {
      const tx = await createGame.mutateAsync({
        proposedPlayers: proposedPlayers.filter(Boolean) as `0x${string}`[],
        maxPlayers,
        initialHandSize,
        roulette: rouletteMode,
      })
      toast.success("Game created", {
        description: `Game id ${tx.gameId ?? "unknown"}`,
      })
      queryClient.invalidateQueries({ queryKey: ["game-index", chainId] })
      setProposedPlayers([""])
      setRouletteMode(false)
      setShowCreate(false)
    } catch (err) {
      toast.error("Create game failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  const handleJoin = async () => {
    const id = parseGameId(joinId)
    if (!id) {
      toast.error("Enter a valid game id")
      return
    }
    try {
      await joinGame.mutateAsync({ gameId: id })
      toast.success(`Joined game ${joinId}`)
      queryClient.invalidateQueries({ queryKey: ["game-index", chainId] })
      setJoinId("")
    } catch (err) {
      toast.error("Join failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  const formatAddr = (addr: string) => {
    if (!addr) return "—"
    return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
  }

  useEffect(() => {
    if (showCreate) {
      setTimeout(() => {
        document.getElementById("create-game-section")?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 100)
    }
  }, [showCreate])

  return (
    <div className="min-h-screen bg-[var(--whot-bg)] font-sans selection:bg-[var(--whot-red)]/20">

      {/* Background Pattern */}
      <div className="fixed inset-0 z-0 bg-grid pointer-events-none h-[60vh]" />

      {/* Main Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-[var(--whot-bg)]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--whot-red)] flex items-center justify-center rounded-sm">
                <span className="text-white font-serif font-bold text-xs">W</span>
              </div>
              <span className="text-[var(--whot-red)] font-serif font-bold text-2xl tracking-tight">Whot</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">

              {/* Network Indicator */}
              <div className="hidden md:flex items-center bg-white border border-gray-200 rounded-full px-4 py-1.5 shadow-sm">
                <EthLogo />
                <span className="text-sm font-medium text-gray-700">Sepolia</span>
              </div>

              {/* Wallet / Connect Button */}
              {isMounted ? <CustomConnectButton /> : null}

              {/* Settings */}
              <SettingsPopover
                trigger={
                  <button className="p-2 text-gray-600 hover:text-[var(--whot-red)] hover:bg-gray-100 rounded-full transition-colors">
                    <Settings className="w-5 h-5" />
                  </button>
                }
                enforceRules={enforceRules}
                setEnforceRules={setEnforceRules}
                burnerAddress={burnerAddress}
                activeAddress={address ?? ""}
                isBurnerConnected={isBurnerConnected}
                onUseBurner={handleBurnerConnect}
                onResetBurner={handleResetBurner}
                onCopyBurner={handleCopyBurner}
                burnerPk={burnerPk}
                setBurnerPk={setBurnerPk}
                onImportBurner={handleImportBurner}
                formatAddr={formatAddr}
              />
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          {/* Hero Section */}
          <div className="relative pt-24 pb-20 text-center max-w-4xl mx-auto px-4">

            {/* Decorative Gradient Blob */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-red-100/40 to-orange-50/40 rounded-full blur-3xl -z-10 pointer-events-none" />

            {/* 3D Cards Visual - PRESERVED HERO CARD DESIGN */}
            <div className="relative h-72 mb-10 group cursor-pointer">
              <div className="relative w-full h-full">

                {/* Left Card */}
                <div className="absolute inset-0 animate-float-slow">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-4 origin-bottom-right transform -rotate-[15deg] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-rotate-[35deg] group-hover:-translate-x-[90%] drop-shadow-2xl">
                    <WhotCard variant="back" className="w-32 sm:w-40 shadow-none rounded-[8px]" />
                  </div>
                </div>

                {/* Right Card */}
                <div className="absolute inset-0 animate-float-medium" style={{ animationDelay: '100ms' }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-4 origin-bottom-left transform rotate-[15deg] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-[35deg] group-hover:-translate-x-[10%] drop-shadow-2xl">
                    <WhotCard variant="back" className="w-32 sm:w-40 shadow-none rounded-[8px]" />
                  </div>
                </div>

                {/* Center Card - Main Hero Card */}
                <div className="absolute inset-0 animate-float-fast" style={{ animationDelay: '75ms' }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-2 z-20 transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-4 group-hover:scale-110 drop-shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)]">
                    <WhotCard shape="Whot" number={20} className="w-36 sm:w-44 shadow-none border-[1px] border-white/10 rounded-[8px]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Copy */}
            <h1 className="font-serif text-4xl md:text-5xl text-gray-900 leading-[1.1] mb-6 max-w-2xl mx-auto tracking-tight">
              The classic card game, <br/>
              <span className="italic text-[var(--whot-red)]">reimagined</span> on chain.
            </h1>

            <p className="text-gray-500 text-lg md:text-xl mb-10 max-w-xl mx-auto font-light leading-relaxed">
              Fully encrypted and decentralized. Experience fair play with zero-knowledge shuffles and provable randomness.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setShowCreate(true)}
                className="w-full sm:w-auto px-8 py-4 bg-[var(--whot-red)] text-white rounded-full font-medium shadow-xl shadow-red-900/10 hover:bg-[var(--whot-red-hover)] hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 active:scale-95"
              >
                Start New Game
              </button>
              <button
                onClick={() => document.getElementById('games-feed')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-full font-medium hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all duration-300 active:scale-95"
              >
                Explore Rooms
              </button>
            </div>
          </div>

          {/* Create Game Modal / Section */}
          {showCreate && (
            <section id="create-game-section" className="mx-auto max-w-lg mb-16 animate-in zoom-in-95 duration-500">
              <Card className="border-gray-100 bg-white/80 shadow-2xl backdrop-blur-md relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-[var(--whot-red)]/5 via-transparent to-transparent pointer-events-none" />
                <CardHeader>
                  <CardTitle className="font-serif">Create Game</CardTitle>
                  <CardDescription>Setup a new encrypted game lobby</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Players</label>
                      <Input
                        type="number"
                        min={2}
                        max={8}
                        value={maxPlayers}
                        onChange={(e) => setMaxPlayers(Number(e.target.value))}
                        className="bg-gray-50 border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Cards/Hand</label>
                      <Input
                        type="number"
                        min={1}
                        max={7}
                        value={initialHandSize}
                        onChange={(e) => setInitialHandSize(Number(e.target.value))}
                        className="bg-gray-50 border-gray-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Invited Players</label>
                      <Button variant="ghost" size="sm" onClick={addPlayerField} className="h-6 text-xs">
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                      {proposedPlayers.map((player, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            placeholder="0x..."
                            value={player}
                            onChange={(e) => updatePlayer(idx, e.target.value)}
                            className="bg-gray-50 border-gray-200 font-mono text-xs"
                          />
                          {proposedPlayers.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => removePlayer(idx)}>×</Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">Quick Mode</div>
                      <div className="text-xs text-gray-500">Fast-paced, ends on connect (debug)</div>
                    </div>
                    <Switch checked={rouletteMode} onCheckedChange={setRouletteMode} />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1 border-gray-200" onClick={() => setShowCreate(false)}>Cancel</Button>
                    <Button
                      className="flex-1 bg-[var(--whot-red)] hover:bg-[var(--whot-red-hover)] shadow-md shadow-red-900/10"
                      onClick={handleCreateGame}
                      disabled={!canTransact || createGame.isPending}
                    >
                      {createGame.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Game
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Game Section Title */}
          <div id="games-feed" className="flex flex-col md:flex-row md:items-end justify-between max-w-5xl mx-auto mb-10 border-b border-gray-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-3xl font-bold text-gray-900">Created Games</h2>
                {isFeedLoading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
              </div>
              <p className="text-gray-500 mt-1">Join an existing game to start playing.</p>
            </div>
          </div>

          {/* Grid Layout: Games Left, Join Widget Right */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Game List */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {isFeedLoading && games.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-7 animate-pulse h-48" />
                ))
              ) : isError ? (
                <div className="col-span-full py-6 text-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  {error instanceof Error ? error.message : "Unable to load games"}
                </div>
              ) : games.length > 0 ? (
                games.map((game) => {
                  const isStarted = game.status === 1
                  const cardValue = game.callCard ? (game.callCard & 0x1f) : '?'

                  return (
                    <Link key={game.gameId.toString()} href={`/games/${game.gameId.toString()}`}>
                      <div className="group relative bg-white border border-gray-100 rounded-2xl p-7 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.1)] hover:border-gray-200 transition-all duration-500 ease-out overflow-hidden cursor-pointer">

                        {/* Subtle Gradient Background Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Decorative Blob */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                        {/* Top Row: Status & ID */}
                        <div className="relative z-10 flex justify-between items-center mb-6">
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            isStarted
                              ? 'bg-red-50 text-[var(--whot-red)] border border-red-100'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isStarted ? 'bg-[var(--whot-red)] animate-pulse' : 'bg-gray-400'}`} />
                            {statusLabel[game.status] ?? "Unknown"}
                          </div>
                          <span className="text-xl font-serif font-bold text-gray-300 group-hover:text-[var(--whot-red)]/20 transition-colors">
                            #{String(game.gameId).padStart(3, '0')}
                          </span>
                        </div>

                        {/* Title & Player Info */}
                        <div className="relative z-10 mb-10">
                          <h3 className="font-serif text-2xl font-bold text-gray-900 mb-2 group-hover:text-[var(--whot-red)] transition-colors duration-300">
                            Standard Room
                          </h3>
                          <div className="flex items-center text-gray-500 text-sm font-medium">
                            <Users className="mr-2 text-gray-400 w-4 h-4" />
                            <span>{game.playersJoined} <span className="text-gray-300 mx-1">/</span> {game.maxPlayers} Players</span>
                          </div>
                        </div>

                        {/* Bottom Row: Card Action */}
                        <div className="relative z-10 flex items-center justify-between mt-auto pt-4 border-t border-gray-50 group-hover:border-gray-100 transition-colors">

                          {/* Dynamic Card Stack Preview */}
                          <div className="flex items-center">
                            <CardStack value={cardValue} />
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Last Played</span>
                              <span className="text-sm font-medium text-gray-900 group-hover:text-[var(--whot-red)] transition-colors">
                                {game.callCard ? describeCard(game.callCard) : 'None'}
                              </span>
                            </div>
                          </div>

                          {/* Join Button */}
                          <button className="relative w-12 h-12 flex items-center justify-center rounded-full bg-gray-50 text-gray-600 group-hover:bg-[var(--whot-red)] group-hover:text-white transition-all duration-300 transform group-hover:scale-110 shadow-sm group-hover:shadow-lg">
                            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5" />
                          </button>
                        </div>
                      </div>
                    </Link>
                  )
                })
              ) : (
                <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="font-serif text-2xl text-gray-400">W</span>
                  </div>
                  <h3 className="text-lg font-serif font-bold text-gray-900 mb-1">No active games</h3>
                  <p className="text-gray-500 mb-4">Be the first to start a new game!</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="px-6 py-2 text-sm font-medium text-[var(--whot-red)] hover:text-[var(--whot-red-hover)] transition-colors"
                  >
                    Create Game
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar Widget (Join) */}
            <div className="lg:col-span-4 hidden lg:block">
              <div className="sticky top-24">
                <div className="bg-white/50 backdrop-blur-sm border border-gray-100 rounded-2xl p-6 text-center mb-6">
                  <span className="block text-gray-400 text-xs uppercase tracking-wider mb-2">Total Games</span>
                  <span className="font-serif text-3xl font-bold text-[var(--whot-red)]">{games.length}</span>
                </div>
                <JoinWidget
                  joinId={joinId}
                  setJoinId={setJoinId}
                  onJoin={handleJoin}
                  disabled={!canTransact || joinGame.isPending}
                />
              </div>
            </div>

            {/* Mobile Join Widget (Fallback) */}
            <div className="lg:hidden">
              <JoinWidget
                joinId={joinId}
                setJoinId={setJoinId}
                onJoin={handleJoin}
                disabled={!canTransact || joinGame.isPending}
              />
            </div>

          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 py-8 text-center text-gray-400 text-sm">
          <p>© 2025 Whot. Powered by Zama FHE.</p>
        </footer>
      </div>
    </div>
  )
}
