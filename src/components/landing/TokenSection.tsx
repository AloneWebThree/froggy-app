"use client";

import Image from "next/image";
import { Donut, type DonutSlice } from "@/components/landing/Donut";

const supplyDistribution: DonutSlice[] = [
    { label: "Liquidity", value: 20, color: "#6EB819" },
    { label: "Community", value: 70, color: "#5AA6FF" },
    { label: "Development Team", value: 5, color: "#FDDC69" },
    { label: "CEX Reserve", value: 5, color: "#FF7A7A" },
];

export function TokenSection() {
    return (
        <section id="token" className="mx-auto max-w-6xl px-4 pt-6 pb-14">
            <h2 className="text-2xl md:text-3xl font-bold">Token</h2>
            <p className="mt-2 text-slate-300/90 text-sm leading-snug text-center md:text-left">
                Core tokenomics for the Froggy ecosystem.
            </p>

            {/* Token metric cards */}
            <div className="mt-8 grid gap-6 md:grid-cols-3">
                {[
                    { k: "Ticker", v: "$FROG", d: "The heartbeat of the Froggy ecosystem." },
                    {
                        k: "Network",
                        v: "Sei Network (EVM • Chain ID 1329)",
                        d: "Fast, secure, and gas-efficient.",
                    },
                    {
                        k: "Total Supply",
                        v: "1,000,000,000",
                        d: "Fixed supply. No mints. No burns.",
                    },
                    { k: "Tax", v: "0%", d: "Zero on buys and sells." },
                    {
                        k: "Liquidity",
                        v: "Locked",
                        d: "Verified on-chain and permanent.",
                    },
                    {
                        k: "Holders",
                        v: "1,312 Holders",
                        d: "View holder data on Sei Explorer.",
                        link: "https://seitrace.com/token/0xF9BDbF259eCe5ae17e29BF92EB7ABd7B8b465Db9?chain=pacific-1&tab=holders",
                    },
                ].map(({ k, v, d, link }) => (
                    <div
                        key={k}
                        className="rounded-2xl p-5 border border-white/10 bg-brand-card/60 transition-all duration-200 hover:border-brand-primary/40 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.6)]"
                    >
                        <div className="text-brand-subtle text-xs uppercase tracking-wide">
                            {k}
                        </div>
                        {link ? (
                            <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 block text-lg font-semibold text-brand-primary break-all"
                            >
                                {v}
                            </a>
                        ) : (
                            <div className="mt-1 text-lg font-semibold text-slate-100">
                                {v}
                            </div>
                        )}
                        <div className="mt-1 text-slate-400 text-sm">{d}</div>
                    </div>
                ))}
            </div>

            {/* Distribution */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-brand-card/60 p-5 relative overflow-hidden">
                {/* Watermark */}
                <Image
                    src="/gallery/froggy-hero.png"
                    alt=""
                    aria-hidden="true"
                    width={400}
                    height={400}
                    priority
                    className="pointer-events-none select-none absolute -right-16 -bottom-20 opacity-5 md:opacity-10"
                />

                <div className="relative">
                    <h3 className="text-lg font-semibold flex items-center justify-between text-center md:text-left">
                        <span>Supply Distribution</span>
                        <span className="text-xs text-brand-subtle">
                            Percentages set at bonding on 10/11/2024
                        </span>
                    </h3>

                    <div className="mt-4">
                        <Donut
                            data={supplyDistribution}
                            centerLabel="Tokenomics"
                            size={220}
                            thickness={22}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
