"use client";

import { brand } from "@/lib/brand";

export function RoadmapSection() {
    const phases = [
        {
            t: "Phase 1",
            d: "dApp launch, pricing, gallery, and DEX-routed swaps",
            done: true,
        },
        {
            t: "Phase 2",
            d: "Dashboard for on-chain streaks, early supporter badges, and campaign prizes.",
            done: true,
        },
        {
            t: "Phase 3",
            d: "Expanded ecosystem tools, partnerships, and DeFi platform expansion.",
            done: false,
        },
    ];

    return (
        <section id="roadmap" className="scroll-mt-20 mx-auto max-w-6xl px-4 pb-14">
            <h2 className="text-2xl md:text-3xl font-bold">Roadmap</h2>
            <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                A transparent look at Froggy development path.
            </p>

            <ol className="mt-6 grid gap-4 md:grid-cols-3">
                {phases.map(({ t, d, done }, i) => (
                    <li
                        key={t}
                        className="rounded-2xl p-5 border border-white/10 bg-brand-card/60 hover:border-brand-primary/40 transition-all duration-200"
                        style={{ opacity: done ? 0.9 : 1 }}
                    >
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full font-semibold"
                                style={{
                                    background: brand.primary,
                                    color: "#081318",
                                }}
                            >
                                {i + 1}
                            </span>
                            {t}
                        </div>

                        <div className="mt-2 font-semibold text-slate-100">{d}</div>

                        {done && (
                            <div className="mt-3 text-xs text-brand-primary font-medium">
                                ✓ Completed
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </section>
    );
}
