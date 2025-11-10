import { NextResponse } from "next/server";

const NETWORK = "sei-evm";
const POOL = "0x373e718e54e73fb462fec3a73e9645efea280b84";

const URL = `https://api.geckoterminal.com/api/v2/networks/${NETWORK}/pools/${POOL}`;

export async function GET() {
    const r = await fetch(URL, { cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
    const data = await r.json();

    const att = data?.data?.attributes ?? {};

    // Prefer base token (FROG) price; fall back to generic fields if needed.
    const priceUsd =
        num(att.base_token_price_usd) ??
        num(att.price_usd) ??
        num(att.price_in_usd) ??
        0;

    // 24h volume and liquidity naming varies a bit; cover common keys.
    const vol24hUsd =
        num(att.volume_usd_24h) ??
        num(att.volume_usd?.h24) ??
        num(att.h24_volume_usd) ??
        0;

    const liquidityUsd =
        num(att.liquidity_usd) ??
        num(att.reserve_in_usd) ??
        num(att.fdv_usd) ?? // last-resort fallback, not true liquidity
        0;

    return NextResponse.json({ priceUsd, vol24hUsd, liquidityUsd });
}

function num(x: unknown) {
    const n = typeof x === "string" ? Number(x) : (x as number);
    return Number.isFinite(n) ? n : undefined;
}
