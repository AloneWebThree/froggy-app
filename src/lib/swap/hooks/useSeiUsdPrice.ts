"use client";

import { useQuery } from "@tanstack/react-query";

type SeiPriceResponse = {
  price?: number;
  sei?: { usd?: number };
};

function parsePrice(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as any;

  // ✅ matches your current API response shape
  if (typeof obj.seiUsd === "number" && Number.isFinite(obj.seiUsd)) {
    return obj.seiUsd;
  }

  // fallback shapes (safe to keep)
  if (typeof obj.price === "number" && Number.isFinite(obj.price)) {
    return obj.price;
  }

  if (
    obj.sei &&
    typeof obj.sei.usd === "number" &&
    Number.isFinite(obj.sei.usd)
  ) {
    return obj.sei.usd;
  }

  return null;
}

async function fetchSeiUsd(): Promise<number> {
  const res = await fetch("/api/sei-price");
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