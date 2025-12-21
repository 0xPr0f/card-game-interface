import { NextResponse } from "next/server"

import { env } from "@/lib/env"
import { getContracts } from "@/config/contracts"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const chainId = typeof body.chainId === "number" ? body.chainId : undefined
  const resolvedChainId = chainId ?? env.chainId
  const contracts = getContracts(resolvedChainId)

  const payload = {
    totalSize: typeof body.totalSize === "number" ? body.totalSize : 24576,
    contractAddress: body.contractAddress || contracts.cardEngine,
    importerAddress: body.importerAddress || contracts.whotManager,
    chainId: resolvedChainId,
  }

  try {
    const resp = await fetch(`${env.teeUrl}/shuffle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    })
    const json = await resp.json()
    if (!resp.ok) {
      return NextResponse.json({ error: json?.error ?? "Shuffle failed" }, { status: resp.status })
    }
    return NextResponse.json(json)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Shuffle request failed" },
      { status: 500 },
    )
  }
}
