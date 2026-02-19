import { NextResponse } from "next/server";

export const revalidate = 30;

const URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=sei-network&vs_currencies=usd";

export async function GET() {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4_000);

  let r: Response;
  try {
    r = await fetch(URL, {
      next: { revalidate: 30 },
      signal: controller.signal,
    });
  } catch {
    clearTimeout(t);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  } finally {
    clearTimeout(t);
  }

  if (!r.ok) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const data = await r.json();
  const seiUsd = Number(data?.["sei-network"]?.usd);

	if (!Number.isFinite(seiUsd) || seiUsd <= 0) {
	return NextResponse.json({ error: "invalid_price" }, { status: 502 });
	}

const res = NextResponse.json({ seiUsd });

  res.headers.set(
    "Cache-Control",
    "public, s-maxage=30, stale-while-revalidate=300"
  );
  return res;
}