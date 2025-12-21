export type RelayAction = "join" | "start"

export const relayGameAction = async (action: RelayAction, gameId: bigint) => {
  const resp = await fetch("/api/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, gameId: gameId.toString() }),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const message = typeof json?.error === "string" ? json.error : "Relayer request failed"
    throw new Error(message)
  }
  return json as { hash: `0x${string}`; relayer?: `0x${string}` }
}
