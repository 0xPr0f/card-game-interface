import { NextRequest, NextResponse } from "next/server"

import { env } from "@/lib/env"

const FALLBACK_HANDLES = [
  process.env.INPUT_HANDLE_ZERO,
  process.env.INPUT_HANDLE_ONE,
].filter(Boolean) as string[];

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const resp = await fetch(`${env.teeUrl}/shuffle/status?id=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const json = await resp.json();

    const handles: string[] | undefined =
      (Array.isArray(json.handles) && json.handles.length ? json.handles : undefined) ||
      (!Array.isArray(json.result) && Array.isArray(json.result?.handles) && json.result?.handles) ||
      (Array.isArray(FALLBACK_HANDLES) && FALLBACK_HANDLES.length >= 2 ? FALLBACK_HANDLES : undefined);

    const inputProof =
      json.inputProof ??
      (Array.isArray(json.result) && json.result.length > 0 ? json.result[0] : undefined);

    return NextResponse.json({
      ...json,
      handles,
      inputProof,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status request failed" },
      { status: 500 },
    );
  }
}
