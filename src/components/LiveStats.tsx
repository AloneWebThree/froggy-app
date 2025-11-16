"use client";

import { useQuery } from "@tanstack/react-query";

function fmt(n: number) {
    if (!n) return "$0";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}k`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

export default function LiveStats() {
    const { data, isLoading } = useQuery({
        queryKey: ["frog-stats"],
        queryFn: async () => (await fetch("/api/frog-stats")).json(),
        refetchInterval: 60_000, // 60s
    });

    const price = data?.priceUsd ?? 0;
    const vol = data?.vol24hUsd ?? 0;
    const liq = data?.liquidityUsd ?? 0;

    const card =
        "rounded-lg border border-white/10 p-3 transition-colors duration-150 hover:border-white/20 hover:bg-white/5";
    const label = "text-brand-subtle";
    const value = "mt-1 text-sm font-semibold whitespace-nowrap";

    return (
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
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
