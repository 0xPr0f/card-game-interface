"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Loader2, Plus, Settings } from "lucide-react"
import { toast } from "sonner"
import type { Address } from "viem"
import { useAccount, useConnect, usePublicClient } from "wagmi"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { describeCard, marketSize } from "@/lib/cards"
import { useCardGameActions } from "@/hooks/useCardGameActions"
import { exportBurner, importBurnerPrivateKey } from "@/lib/burner"
import { CustomConnectButton } from "@/components/custom-connect-button"
import { getContracts } from "@/config/contracts"
import { activeChain } from "@/config/web3Shared"
import { readGameDataBatch, readNextGameId } from "@/lib/cardEngineView"

type IndexedGame = {
  gameId: bigint
  creator: string
  status: number
  playersLeftToJoin: number
  maxPlayers: number
  callCard: number
  lastMove: number
  ruleset: string
  marketDeckMap: bigint
  marketCount: number
  playerTurnIdx: number
  playersJoined: number
}

type CachedGame = Omit<IndexedGame, "gameId" | "marketDeckMap"> & {
  gameId: string
  marketDeckMap: string
}

type FeedCache = {
  version: number
  chainId: number
  cardEngine: string
  updatedAt: number
  latestGameId: string
  games: CachedGame[]
}

const statusLabel: Record<number, string> = {
  0: "Open",
  1: "Started",
  2: "Ended",
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const FEED_CACHE_VERSION = 2
const FEED_CACHE_TTL_MS = 60_000
const FEED_CACHE_PREFIX = "whot-game-feed-cache"
const FEED_MAX_GAMES = 50
const FEED_FALLBACK_GAMES = 50

const parseGameId = (value: string): bigint | null => {
  try {
    return BigInt(value.trim())
  } catch {
    return null
  }
}

const buildFeedCacheKey = (chainId: number, cardEngine: string) =>
  `${FEED_CACHE_PREFIX}:${chainId}:${cardEngine.toLowerCase()}`

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const serializeGame = (game: IndexedGame): CachedGame => ({
  ...game,
  gameId: game.gameId.toString(),
  marketDeckMap: game.marketDeckMap.toString(),
})

const deserializeGame = (game: CachedGame): IndexedGame | null => {
  try {
    return {
      gameId: BigInt(game.gameId),
      creator: String(game.creator ?? ""),
      status: safeNumber(game.status),
      playersLeftToJoin: safeNumber(game.playersLeftToJoin),
      maxPlayers: safeNumber(game.maxPlayers),
      callCard: safeNumber(game.callCard),
      lastMove: safeNumber(game.lastMove),
      ruleset: String(game.ruleset ?? ""),
      marketDeckMap: BigInt(game.marketDeckMap),
      marketCount: safeNumber(game.marketCount),
      playerTurnIdx: safeNumber(game.playerTurnIdx),
      playersJoined: safeNumber(game.playersJoined),
    }
  } catch {
    return null
  }
}

const loadFeedCache = (key: string) => {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FeedCache
    if (!parsed || parsed.version !== FEED_CACHE_VERSION || !Array.isArray(parsed.games)) {
      return null
    }
    const games = parsed.games
      .map((game) => deserializeGame(game))
      .filter(Boolean) as IndexedGame[]
    return {
      games,
      latestGameId: parsed.latestGameId ? BigInt(parsed.latestGameId) : undefined,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return null
  }
}

const saveFeedCache = (
  key: string,
  chainId: number,
  cardEngine: string,
  games: IndexedGame[],
  latestGameId?: bigint,
) => {
  if (typeof window === "undefined") return
  try {
    const payload: FeedCache = {
      version: FEED_CACHE_VERSION,
      chainId,
      cardEngine,
      updatedAt: Date.now(),
      latestGameId: (latestGameId ?? 0n).toString(),
      games: games.map(serializeGame),
    }
    window.localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // ignore cache failures
  }
}

const buildGameIdRange = (start: bigint, end: bigint) => {
  const ids: bigint[] = []
  if (end < start) return ids
  for (let id = start; id <= end; id++) ids.push(id)
  return ids
}

export default function Page() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { connectAsync, connectors } = useConnect()
  const { createGame, joinGame, isConnected: canTransact } = useCardGameActions()
  const chainId = publicClient?.chain?.id ?? activeChain.id
  const contracts = useMemo(() => getContracts(chainId), [chainId])
  const queryClient = useQueryClient()

  const [proposedPlayers, setProposedPlayers] = useState<string[]>([""])
  const [maxPlayers, setMaxPlayers] = useState(2)
  const [initialHandSize, setInitialHandSize] = useState(5)
  const [joinId, setJoinId] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [showFeed, setShowFeed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [burnerPk, setBurnerPk] = useState("")
  const [rouletteMode, setRouletteMode] = useState(false)
  const cacheKey = useMemo(() => buildFeedCacheKey(chainId, contracts.cardEngine), [chainId, contracts.cardEngine])
  const cachedFeed = useMemo(() => loadFeedCache(cacheKey), [cacheKey])

  useEffect(() => setIsMounted(true), [])

  const {
    data: indexedGames = [],
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["game-index", chainId],
    enabled: Boolean(publicClient),
    initialData: cachedFeed?.games ?? [],
    queryFn: async () => {
      if (!publicClient) return []
      const cache = loadFeedCache(cacheKey)
      const cachedGames = cache?.games ?? []
      const cachedLatestGameId = cache?.latestGameId ?? 0n
      const nextGameId = await readNextGameId(publicClient, contracts.cardEngine as Address)
      if (nextGameId <= 1n) {
        if (cachedGames.length) return cachedGames.sort((a, b) => Number(b.gameId - a.gameId))
        const fallbackEnd = BigInt(FEED_FALLBACK_GAMES)
        const fallbackIds = buildGameIdRange(1n, fallbackEnd)
        const fallbackMap = await readGameDataBatch(
          publicClient,
          contracts.cardEngine as Address,
          fallbackIds,
        )
        const fallbackGames: IndexedGame[] = []
        for (const gameId of fallbackIds) {
          const gameData = fallbackMap.get(gameId)
          if (!gameData || gameData.gameCreator === ZERO_ADDRESS) continue
          fallbackGames.push({
            gameId,
            creator: gameData.gameCreator,
            status: gameData.status,
            playersLeftToJoin: gameData.playersLeftToJoin,
            maxPlayers: gameData.maxPlayers,
            callCard: gameData.callCard,
            lastMove: gameData.lastMoveTimestamp,
            ruleset: gameData.ruleset,
            marketDeckMap: gameData.marketDeckMap,
            marketCount: marketSize(gameData.marketDeckMap),
            playerTurnIdx: gameData.playerTurnIdx,
            playersJoined: gameData.playersJoined,
          })
        }
        const orderedFallback = fallbackGames.sort((a, b) => Number(b.gameId - a.gameId))
        const latestFallback = orderedFallback[0]?.gameId ?? 0n
        saveFeedCache(cacheKey, chainId, contracts.cardEngine, orderedFallback, latestFallback)
        return orderedFallback
      }
      const latestGameId = nextGameId - 1n
      if (
        cachedLatestGameId === latestGameId &&
        cache?.updatedAt &&
        Date.now() - cache.updatedAt < FEED_CACHE_TTL_MS
      ) {
        return cachedGames.sort((a, b) => Number(b.gameId - a.gameId))
      }

      const maxGames = BigInt(FEED_MAX_GAMES)
      const rangeStart = latestGameId > maxGames ? latestGameId - maxGames + 1n : 1n
      const gameIds = buildGameIdRange(rangeStart, latestGameId)
      const dataMap = await readGameDataBatch(publicClient, contracts.cardEngine as Address, gameIds)
      const games: IndexedGame[] = []
      for (const gameId of gameIds) {
        const gameData = dataMap.get(gameId)
        if (!gameData || gameData.gameCreator === ZERO_ADDRESS) continue
        games.push({
          gameId,
          creator: gameData.gameCreator,
          status: gameData.status,
          playersLeftToJoin: gameData.playersLeftToJoin,
          maxPlayers: gameData.maxPlayers,
          callCard: gameData.callCard,
          lastMove: gameData.lastMoveTimestamp,
          ruleset: gameData.ruleset,
          marketDeckMap: gameData.marketDeckMap,
          marketCount: marketSize(gameData.marketDeckMap),
          playerTurnIdx: gameData.playerTurnIdx,
          playersJoined: gameData.playersJoined,
        })
      }

      let ordered = games.sort((a, b) => Number(b.gameId - a.gameId))
      if (!ordered.length && rangeStart !== 1n) {
        const fallbackEnd = latestGameId > maxGames ? maxGames : latestGameId
        const fallbackIds = buildGameIdRange(1n, fallbackEnd)
        const fallbackMap = await readGameDataBatch(
          publicClient,
          contracts.cardEngine as Address,
          fallbackIds,
        )
        const fallbackGames: IndexedGame[] = []
        for (const gameId of fallbackIds) {
          const gameData = fallbackMap.get(gameId)
          if (!gameData || gameData.gameCreator === ZERO_ADDRESS) continue
          fallbackGames.push({
            gameId,
            creator: gameData.gameCreator,
            status: gameData.status,
            playersLeftToJoin: gameData.playersLeftToJoin,
            maxPlayers: gameData.maxPlayers,
            callCard: gameData.callCard,
            lastMove: gameData.lastMoveTimestamp,
            ruleset: gameData.ruleset,
            marketDeckMap: gameData.marketDeckMap,
            marketCount: marketSize(gameData.marketDeckMap),
            playerTurnIdx: gameData.playerTurnIdx,
            playersJoined: gameData.playersJoined,
          })
        }
        ordered = fallbackGames.sort((a, b) => Number(b.gameId - a.gameId))
      }
      const cacheLatest = ordered[0]?.gameId ?? latestGameId
      saveFeedCache(cacheKey, chainId, contracts.cardEngine, ordered, cacheLatest)
      return ordered
    },
  })
  const games = useMemo(() => indexedGames, [indexedGames])

  const handleBurnerConnect = async () => {
    const burner = connectors.find((c) => c.id === "burner")
    if (!burner) {
      toast.error("Burner connector unavailable")
      return
    }
    await connectAsync({ connector: burner })
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
      console.error(err)
    }
  }

  const handleJoin = async () => {
    const id = parseGameId(joinId)
    if (!id) {
      toast.error("Enter a valid game id (number or hex)")
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center gap-6 px-4 py-14">
        <header className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              {isMounted ? <CustomConnectButton /> : null}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-2">
                  <div className="text-sm font-medium">Burner wallet</div>
                  <p className="text-xs text-muted-foreground">Stored locally for quick joins.</p>
                  <div className="rounded-md border bg-secondary/40 p-2 text-xs">
                    Address: {formatAddr(address ?? exportBurner()?.address ?? "")}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={handleBurnerConnect}>
                      Use burner
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={handleCopyBurner}>
                      Copy key
                    </Button>
                  </div>
                  <div className="space-y-1 pt-2">
                    <div className="text-xs font-medium text-muted-foreground">Import private key</div>
                    <div className="flex gap-2">
                      <Input
                        value={burnerPk}
                        onChange={(e) => setBurnerPk(e.target.value)}
                        placeholder="0x..."
                        className="text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={handleImportBurner}>
                        Save
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-3xl font-semibold text-primary">Whot On-Chain</h1>
            <p className="text-muted-foreground text-sm">Encrypted • Fair • On-Chain</p>
          </div>
        </header>

        <section className="w-full space-y-4">
          {!showCreate ? (
            <>
              <Card className="shadow-sm">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">Join a Game</CardTitle>
                  <CardDescription>Pick an active lobby or enter an ID.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {games.length ? (
                      games.slice(0, 2).map((game) => (
                        <Link
                          key={game.gameId.toString()}
                          href={`/games/${game.gameId.toString()}`}
                          className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2"
                        >
                          <div>
                            <p className="font-medium">Game #{game.gameId.toString()}</p>
                            <p className="text-muted-foreground text-xs">
                              {statusLabel[game.status] ?? "Unknown"} • {game.playersJoined}/{game.maxPlayers} players
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      ))
                    ) : isFetching ? (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading games...
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        No games yet. Create a lobby to get started.
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="Game ID" />
                    <Button onClick={handleJoin} disabled={!canTransact || joinGame.isPending}>
                      {joinGame.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="w-full border-dashed border-primary text-primary"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Game
                </Button>
              </div>
            </>
          ) : (
            <Card className="w-full shadow-sm">
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 text-primary"
                    onClick={() => setShowCreate(false)}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back to Games
                  </Button>
                </div>
                <CardTitle className="text-lg">Create Game</CardTitle>
                <CardDescription>WhotManager pulls encrypted decks from the trusted shuffle service.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Max players</label>
                    <Input
                      type="number"
                      min={2}
                      max={8}
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Initial hand</label>
                    <Input
                      type="number"
                      min={1}
                      max={7}
                      value={initialHandSize}
                      onChange={(e) => setInitialHandSize(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-secondary/50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">Roulette mode</p>
                      <p className="text-muted-foreground text-xs">
                        Ends the game immediately on start (manager hook).
                      </p>
                    </div>
                    <Switch checked={rouletteMode} onCheckedChange={setRouletteMode} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Add players</span>
                    <Button variant="ghost" size="sm" onClick={addPlayerField} className="h-7 px-2 text-xs">
                      <Plus className="mr-1 h-3 w-3" /> Add
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-24 overflow-y-auto">
                    {proposedPlayers.map((player, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          value={player}
                          onChange={(e) => updatePlayer(idx, e.target.value)}
                          placeholder="0x..."
                        />
                        {proposedPlayers.length > 1 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => removePlayer(idx)}
                          >
                            ×
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-secondary/50 p-3 text-sm">
                  <p className="font-medium">Encrypted deck source</p>
                  <p className="text-muted-foreground text-xs">
                    Handles are fetched on-chain from TrustedShuffleServiceV0 by WhotManager.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleCreateGame} disabled={!canTransact || createGame.isPending}>
                    {createGame.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="w-full space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Game feed</h2>
              <p className="text-muted-foreground text-sm">
                Pulled from on-chain storage.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              <Badge variant="outline">{games.length} games</Badge>
              <Button variant="ghost" size="sm" onClick={() => setShowFeed((v) => !v)}>
                {showFeed ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
          {isError ? (
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Feed error: {error instanceof Error ? error.message : "Unable to load games"}
            </div>
          ) : null}
          {showFeed ? (
            <div className="grid grid-cols-1 gap-3">
              {games.map((game) => (
                <Card key={game.gameId.toString()} className="gap-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">Game #{game.gameId.toString()}</CardTitle>
                      <Badge variant={game.status === 1 ? "default" : "secondary"}>
                        {statusLabel[game.status] ?? "Unknown"}
                      </Badge>
                    </div>
                    <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="max-w-full truncate">
                        Creator: {formatAddr(game.creator)}
                      </Badge>
                      <Badge variant="outline" className="max-w-full truncate">
                        Ruleset: {formatAddr(game.ruleset)}
                      </Badge>
                      <Badge variant="outline">Turn: {game.playerTurnIdx}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="rounded-lg bg-secondary px-3 py-2 font-medium">
                        Call: {game.callCard === 0 ? "No call card yet" : describeCard(game.callCard)}
                      </div>
                      <div className="text-muted-foreground text-xs flex flex-wrap items-center gap-2">
                        <span>Market: {game.marketCount}</span>
                        <span>Seats: {game.playersJoined}/{game.maxPlayers}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-muted-foreground">
                        {isMounted && game.lastMove
                          ? `Last activity few moments ago`
                          : "Activity pending"}
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/games/${game.gameId.toString()}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </section>
      </main>
      <footer className="border-t border-border bg-secondary px-4 py-6 text-center text-xs text-foreground">
        <div className="space-y-1">
          <p>© 2025 Whot On-Chain</p>
          <p className="text-muted-foreground">Built with Zama FHE • Ethereum </p>
        </div>
      </footer>
    </div>
  )
}
