"use client";

import { useQuery } from "@tanstack/react-query";

type FrogStats = {
    priceUsd: number;
    vol24hUsd: number;
    liquidityUsd: number;
};

function fmt(n: number) {
    if (!n) return "$0";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}k`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

export default function LiveStats() {
    const { data, isLoading, isError } = useQuery<FrogStats>({
        queryKey: ["frog-stats"],
        queryFn: async () => {
            const res = await fetch("/api/frog-stats");
            if (!res.ok) {
                throw new Error("Failed to load stats");
            }
            return res.json() as Promise<FrogStats>;
        },
        staleTime: 30_000,          // don't spam your own API for no reason
        refetchInterval: 60_000,    // once a minute is plenty
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const price = typeof data?.priceUsd === "number" ? data.priceUsd : 0;
    const vol = typeof data?.vol24hUsd === "number" ? data.vol24hUsd : 0;
    const liq = typeof data?.liquidityUsd === "number" ? data.liquidityUsd : 0;

    const card =
        "rounded-lg border border-white/10 p-3 transition-colors duration-150 hover:border-white/20 hover:bg-white/5";
    const label = "text-[11px] uppercase tracking-wide text-brand-subtle/80";
    const value = "mt-1 text-sm font-mono";

    if (isError) {
        return (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs text-brand-subtle">
                <div className={card}>
                    <div className={label}>Live Stats</div>
                    <div className="mt-1 text-[11px] text-yellow-300">
                        Unable to load on-chain market data right now.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={card}>
                <div className={label}>Price</div>
                <div className={value}>{isLoading ? "…" : fmt(price)}</div>
            </div>
            <div className={card}>
                <div className={label}>24h Vol</div>
                <div className={value}>{isLoading ? "…" : fmt(vol)}</div>
            </div>
            <div className={card}>
                <div className={label}>Liquidity</div>
                <div className={value}>{isLoading ? "…" : fmt(liq)}</div>
            </div>
        </div>
    );
}
