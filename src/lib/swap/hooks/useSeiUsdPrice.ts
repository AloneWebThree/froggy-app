"use client";

import { useEffect, useState } from "react";

export function useSeiUsdPrice(pollMs = 30_000) {
  const [seiUsdPrice, setSeiUsdPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const r = await fetch("/api/sei-price", { cache: "no-store" });
        if (!r.ok) return;

        const j = await r.json();
        const p = Number(j?.seiUsd);

        if (!cancelled && Number.isFinite(p) && p > 0) {
          setSeiUsdPrice(p);
        }
      } catch {
        // keep last good price
      }
    }

    load();
    const id = window.setInterval(load, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollMs]);

  return seiUsdPrice;
}