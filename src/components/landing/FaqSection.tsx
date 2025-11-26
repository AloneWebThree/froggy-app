"use client";

export function FaqSection() {
    const items = [
        {
            q: "Is there a trading tax?",
            a: "No. Zero on buys and sells. Trade to FULL potential!",
        },
        {
            q: "Where is liquidity?",
            a: "Locked permanently and verified on-chain. More can be added anytime by Dev team or community members.",
        },
        {
            q: "What is utility?",
            a: "Community-first DeFi, liquidity provision token, and on-chain streaks.",
        },
        {
            q: "What chain is Froggy on?",
            a: "Sei Network (EVM). Secure, scalable, and low fees.",
        },
        {
            q: "How many tokens exist?",
            a: "1 billion total supply. No future mints, no drops, no vesting, fixed forever.",
        },
    ];

    return (
        <section id="faq" className="mx-auto max-w-6xl px-4 pb-20">
            <h2 className="text-2xl md:text-3xl font-bold">FAQ</h2>
            <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                Common questions about $FROG and its ecosystem.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
                {items.map(({ q, a }) => (
                    <details
                        key={q}
                        className="group rounded-2xl border border-white/10 bg-brand-card p-5 transition-all duration-200 hover:border-brand-primary/40"
                    >
                        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-100 focus:outline-none">
                            {q}
                            <span className="ml-2 text-brand-primary transition-transform duration-200 group-open:rotate-45">
                                +
                            </span>
                        </summary>
                        <div className="mt-2 text-slate-300/90 text-sm leading-snug">
                            {a}
                        </div>
                    </details>
                ))}
            </div>
        </section>
    );
}
