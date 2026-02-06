import { NextResponse } from "next/server";

export const revalidate = 30;

const URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=sei-network&vs_currencies=usd";

export async function GET() {
  const r = await fetch(URL, { next: { revalidate: 30 } });

  if (!r.ok) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const data = await r.json();
  const seiUsd = Number(data?.["sei-network"]?.usd);

  const res = NextResponse.json({
    seiUsd: Number.isFinite(seiUsd) ? seiUsd : 0,
  });

  res.headers.set(
    "Cache-Control",
    "public, s-maxage=30, stale-while-revalidate=300"
  );
  return res;
}