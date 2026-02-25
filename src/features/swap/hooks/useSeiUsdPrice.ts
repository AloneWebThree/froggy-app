"use client";

import { useQuery } from "@tanstack/react-query";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function parsePrice(data: unknown): number | null {
  if (!isRecord(data)) return null;

  // ✅ matches your current API response shape
  const seiUsd = asFiniteNumber(data["seiUsd"]);
  if (seiUsd !== null) return seiUsd;

  // fallback shapes
  const price = asFiniteNumber(data["price"]);
  if (price !== null) return price;

  const sei = data["sei"];
  if (isRecord(sei)) {
    const usd = asFiniteNumber(sei["usd"]);
    if (usd !== null) return usd;
  }

  return null;
}

async function fetchSeiUsd(): Promise<number> {
  const res = await fetch("/api/sei-price", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch SEI price");

  const data: unknown = await res.json();
  const price = parsePrice(data);
  if (price === null) throw new Error("Invalid SEI price response");

  return price;
}

export function useSeiUsdPrice(refetchIntervalMs = 30_000) {
  return useQuery({
    queryKey: ["sei-usd"],
    queryFn: fetchSeiUsd,
    refetchInterval: refetchIntervalMs,
    staleTime: Math.min(20_000, refetchIntervalMs),
  });
}