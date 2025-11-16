import { NextResponse } from "next/server";

const CHAIN = "seiv2";
const PAIR = "0x373e718e54e73fb462fec3a73e9645efea280b84";

const URL = `https://api.dexscreener.com/latest/dex/pairs/${CHAIN}/${PAIR}`;

export async function GET() {
    const r = await fetch(URL, { cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
    const data = await r.json();

    const pair = data?.pair ?? {};

    const priceUsd = num(pair.priceUsd) ?? 0;
    const vol24hUsd = num(pair.volume?.h24) ?? 0;
    const liquidityUsd = num(pair.liquidity?.usd) ?? 0;

    return NextResponse.json({ priceUsd, vol24hUsd, liquidityUsd });
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
