"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Loader2, Plus, Sparkles, Trophy, Users, Settings } from "lucide-react"
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
    <div className="min-h-[100svh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background text-foreground flex flex-col">
       <div className="fixed inset-0 -z-10 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
       <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2 font-bold">
            <img src="/icon.svg" alt="Whot" className="h-8 w-8" />
            <span className="text-xl hidden sm:inline-block" style={{ color: '#8b2037' }}>Whot</span>
          </div>
          <div className="flex items-center gap-2">
            {isMounted ? <CustomConnectButton /> : null}
            <SettingsPopover
              trigger={
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
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

      <main className="flex-1 container mx-auto px-4 py-8 space-y-10">
          {/* Hero Section */}
          <div className="relative pt-12 sm:pt-24 pb-12 sm:pb-20 text-center max-w-4xl mx-auto px-2 sm:px-4">

            {/* Decorative Gradient Blob */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-red-100/40 to-orange-50/40 rounded-full blur-3xl -z-10 pointer-events-none" />

            {/* 3D Cards Visual - PRESERVED HERO CARD DESIGN */}
            <div className="relative h-48 sm:h-72 mb-12 sm:mb-10 group cursor-pointer">
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
            <h1 className="font-serif text-2xl sm:text-4xl md:text-5xl text-gray-900 leading-[1.1] mb-4 sm:mb-6 max-w-2xl mx-auto tracking-tight">
              The classic card game, <br/>
              <span className="italic text-[var(--whot-red)]">reimagined</span> on chain.
            </h1>

            <p className="text-gray-500 text-sm sm:text-lg md:text-xl mb-6 sm:mb-10 max-w-xl mx-auto font-light leading-relaxed px-2">
              Fully encrypted and decentralized. Experience fair play with zero-knowledge shuffles and provable randomness.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
               <Button size="lg" className="h-11 sm:h-12 px-6 sm:px-8 rounded-full text-sm sm:text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow" onClick={() => setShowCreate(true)}>
                  <Plus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Start New Game
               </Button>
               <Button size="lg" variant="outline" className="h-11 sm:h-12 px-6 sm:px-8 rounded-full text-sm sm:text-base bg-background/50 backdrop-blur border-primary/20 hover:border-primary/50" onClick={() => {
                  document.getElementById('games-feed')?.scrollIntoView({ behavior: 'smooth' })
               }}>
                  See Open Games
               </Button>
            </div>
          </div>

        {/* Create Game Modal / Section */}
        {showCreate && (
             <section id="create-game-section" className="mx-auto max-w-lg animate-in zoom-in-95 duration-500">
               <Card className="border-white/10 bg-white/5 shadow-2xl backdrop-blur-md supports-[backdrop-filter]:bg-white/5 relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-transparent pointer-events-none" />
                 <CardHeader>
                   <CardTitle>Create Game</CardTitle>
                   <CardDescription>Setup a new encrypted game lobby</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Players</label>
                           <Input 
                              type="number" 
                              min={2} 
                              max={8} 
                              value={maxPlayers} 
                              onChange={(e) => setMaxPlayers(Number(e.target.value))}
                              className="bg-secondary/20"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cards/Hand</label>
                           <Input 
                              type="number" 
                              min={1} 
                              max={7} 
                              value={initialHandSize} 
                              onChange={(e) => setInitialHandSize(Number(e.target.value))}
                              className="bg-secondary/20"
                           />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invited Players</label>
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
                                        className="bg-secondary/20 font-mono text-xs"
                                    />
                                    {proposedPlayers.length > 1 && (
                                        <Button variant="ghost" size="icon" onClick={() => removePlayer(idx)}>×</Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3 bg-secondary/10">
                        <div className="space-y-0.5">
                            <div className="text-sm font-medium">Quick Mode</div>
                            <div className="text-xs text-muted-foreground">Fast-paced, ends on connect (debug)</div>
                        </div>
                        <Switch checked={rouletteMode} onCheckedChange={setRouletteMode} />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button className="flex-1 shadow-md shadow-primary/20" onClick={handleCreateGame} disabled={!canTransact || createGame.isPending}>
                            {createGame.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Game
                        </Button>
                    </div>
                 </CardContent>
               </Card>
             </section>
        )}

        {/* Game Feed */}
        <section id="games-feed" className="mx-auto max-w-3xl space-y-4 sm:space-y-6 px-2 sm:px-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                     <div className="flex items-center gap-2">
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Created Games</h2>
                        {isFeedLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                     </div>
                     <p className="text-sm sm:text-base text-muted-foreground">Join an existing game to start playing.</p>
                </div>
                <Card className="p-1 px-3 bg-secondary/30 border-0 flex items-center gap-2 self-start sm:self-auto">
                    <Input 
                        placeholder="Join by ID..." 
                        value={joinId} 
                        onChange={(e) => setJoinId(e.target.value)}
                        className="bg-transparent border-none h-8 w-24 sm:w-32 focus-visible:ring-0 placeholder:text-muted-foreground/50 text-sm"
                    />
                    <div className="h-4 w-px bg-border mx-1" />
                    <Button size="sm" variant="ghost" className="h-7 px-2 hover:bg-background" onClick={handleJoin} disabled={!joinId}>
                        Join
                    </Button>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {isFeedLoading && games.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="bg-secondary/10 border-dashed animate-pulse h-40" />
                    ))
                ) : isError ? (
                    <div className="col-span-full py-6 text-center rounded-xl border border-dashed bg-secondary/5 text-sm text-muted-foreground">
                        {error instanceof Error ? error.message : "Unable to load games"}
                    </div>
                ) : games.length > 0 ? (
                    games.map((game) => (
                        <Link key={game.gameId.toString()} href={`/games/${game.gameId.toString()}`}>
                            <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 border-white/5 bg-white/5 backdrop-blur-sm">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-20 transition-opacity duration-500">
                                    <Sparkles className="h-24 w-24 text-primary -rotate-12 translate-x-8 -translate-y-8" />
                                </div>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-center">
                                            <Badge variant={game.status === 1 ? "default" : "secondary"}>
                                                {statusLabel[game.status] ?? "Unknown"}
                                            </Badge>
                                            <span className="text-xl font-bold font-mono text-foreground/80">#{game.gameId.toString()}</span>
                                        </div>
                                        <CardTitle className="text-lg pt-0 flex items-center gap-2">
                                        Game Room 
                                        <span className="text-muted-foreground font-normal text-sm items-center flex gap-1">
                                            <Users className="h-3 w-3" /> {game.playersJoined}/{game.maxPlayers}
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        {game.callCard ? (
                                             <WhotCard shape={describeCard(game.callCard)} number={game.callCard & 0x1f} className="w-10 sm:w-14 shadow-sm rounded-md shrink-0" />
                                        ) : (
                                            <div className="w-10 sm:w-14 h-14 sm:h-20 bg-secondary/50 rounded-md border border-dashed flex items-center justify-center text-base sm:text-lg font-bold text-muted-foreground/50 shrink-0">
                                                ?
                                            </div>
                                        )}
                                        <div className="text-sm flex-1">
                                            <p className="font-medium">
                                                {game.callCard ? "In Progress" : "Waiting for players"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Turn: Player {game.playerTurnIdx}
                                            </p>
                                        </div>
                                        <Button size="icon" variant="secondary" className="rounded-full h-8 w-8 shrink-0">
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))
                ) : (
                    <div className="col-span-full py-12 text-center rounded-xl border border-dashed bg-secondary/5">
                        <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <h3 className="text-lg font-medium">No active games</h3>
                        <p className="text-muted-foreground">Be the first to start a new game!</p>
                        <Button variant="link" onClick={() => setShowCreate(true)}>Create Game</Button>
                    </div>
                )}
            </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
         <p>© 2025 Whot • Powered by Zama FHE</p>
      </footer>
    </div>
  )
}
