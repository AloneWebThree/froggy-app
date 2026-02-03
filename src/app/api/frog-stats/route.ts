import { NextResponse } from "next/server";

export const revalidate = 60; // seconds (shared cache)

const CHAIN = "seiv2";
const PAIR = "0x373e718e54e73fb462fec3a73e9645efea280b84";
const URL = `https://api.dexscreener.com/latest/dex/pairs/${CHAIN}/${PAIR}`;

export async function GET() {
    const r = await fetch(URL, {
        // Allow Next to cache and revalidate; prevents request storms
        next: { revalidate: 60 },
    });

    if (!r.ok) {
        return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    const data = await r.json();
    const pair = data?.pair ?? {};

    const priceUsd = num(pair.priceUsd) ?? 0;
    const vol24hUsd = num(pair.volume?.h24) ?? 0;
    const liquidityUsd = num(pair.liquidity?.usd) ?? 0;

    const res = NextResponse.json({ priceUsd, vol24hUsd, liquidityUsd });
    // Extra explicit CDN/proxy caching (Vercel edge/CDN respects this)
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res;
}

function num(x: unknown) {
    const n =
        typeof x === "string"
            ? Number(x)
            : typeof x === "number"
                ? x
                : undefined;
    return Number.isFinite(n) ? n : undefined;
}
