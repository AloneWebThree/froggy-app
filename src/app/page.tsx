"use client";

import { useState, useRef, useEffect } from "react";
import { WalletButton } from "./providers";
import LiveStats from "@/components/LiveStats";
import Image from "next/image";

const ADDR = {
  token: "0xF9BDbF259eCe5ae17e29BF92EB7ABd7B8b465Db9",
  pair: "0x373e718e54e73fb462fec3a73e9645efea280b84",
};

const URL = {
  geckoEmbed: `https://www.geckoterminal.com/sei-evm/pools/${ADDR.pair}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=price&resolution=1d`,
geckoFull: `https://www.geckoterminal.com/sei-evm/pools/${ADDR.pair}`,
    pairExplorer: `https://seitrace.com/address/${ADDR.pair}?chain=pacific-1`,
        tokenExplorer: `https://seitrace.com/token/${ADDR.token}?chain=pacific-1`,
            dragon: `https://dragonswap.app/swap?outputCurrency=${ADDR.token}&inputCurrency=`,
                yaka: `https://yaka.finance/swap?inputCurrency=SEI&outputCurrency=${ADDR.token}`,
};

function CopyButton({ value, label }: { value: string; label: string }) {
    const [msg, setMsg] = useState("");
    const copy = async () => {
        try {
            if (!("clipboard" in navigator)) throw new Error("no-clipboard");
            await navigator.clipboard.writeText(value);
            setMsg("Copied");
        } catch {
            setMsg("Copy failed");
        } finally {
            setTimeout(() => setMsg(""), 1400);
        }
    };
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={copy}
                aria-label={`Copy ${label}`}
                className="rounded-lg px-2 py-1 text-xs border border-white/15 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            >
                Copy
            </button>
            <span role="status" aria-live="polite" className="text-[11px] text-brand-subtle">
                {msg}
            </span>
        </div>
    );
}

export default function FroggyLanding() {
    const [menuOpen, setMenuOpen] = useState(false);
    const toggleRef = useRef<HTMLButtonElement | null>(null);
    const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

    useEffect(() => {
        if (menuOpen && firstLinkRef.current) firstLinkRef.current.focus();
    }, [menuOpen]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setMenuOpen(false);
                toggleRef.current?.focus();
            }
        };
        if (menuOpen) document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [menuOpen]);

    useEffect(() => {
        if (!menuOpen) return;

        const onPointerDown = (e: PointerEvent) => {
            const nav = document.getElementById("mobile-nav");
            if (nav && (nav === e.target || nav.contains(e.target as Node))) return;
            const btn = toggleRef.current;
            if (btn && (btn === e.target || btn.contains(e.target as Node))) return;
            setMenuOpen(false);
            toggleRef.current?.focus();
        };

        document.addEventListener("pointerdown", onPointerDown, true);
        return () => document.removeEventListener("pointerdown", onPointerDown, true);
    }, [menuOpen]);

    const brand = {
        bg: "#0b1221",
        primary: "#6eb819",
        secondary: "#5AA6FF",
        text: "#E9F1FF",
        card: "#121a2e",
        subtle: "#93A8C3",
    } as const;

    return (
        <div className="min-h-screen w-full" style={{ background: brand.bg, color: brand.text }}>
            {/* Nav */}
            <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5">
                <div className="mx-auto max-w-6xl px-4">
                    <div className="flex h-16 items-center justify-between">
                        <a className="flex items-center gap-3" href="#home" aria-label="Froggy home">
                            <Image src="/froggy-logo.png" alt="Froggy logo" width={36} height={36} className="rounded-xl object-contain" priority />
                            <span className="font-semibold tracking-wide text-brand-text">FROGGY</span>
                        </a>
                        <nav className="hidden gap-8 md:flex text-sm text-slate-200/90">
                            <a href="#token" className="hover:text-white">Token</a>
                            <a href="#swap" className="hover:text-white">Swap</a>
                            <a href="#gallery" className="hover:text-white">Gallery</a>
                            <a href="#roadmap" className="hover:text-white">Roadmap</a>
                            <a href="#faq" className="hover:text-white">FAQ</a>
                        </nav>
                        <div className="flex items-center gap-3">
                            <div className="hidden md:block">
                                <WalletButton />
                            </div>
                            <button
                                type="button"
                                ref={toggleRef}
                                className="md:hidden rounded-lg p-2 hover:bg-white/5"
                                onClick={() => setMenuOpen((v) => !v)}
                                aria-label="Toggle navigation"
                                aria-controls="mobile-nav"
                                aria-expanded={menuOpen}
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                {menuOpen && (
                    <>
                        <button
                            type="button"
                            aria-hidden="true"
                            className="fixed inset-0 bg-black/30 md:hidden z-40"
                            onClick={() => {
                                setMenuOpen(false);
                                toggleRef.current?.focus();
                            }}
                        />
                        <nav id="mobile-nav" aria-label="Primary" className="md:hidden border-t border-white/10 relative z-50">
                            <ul role="menu" className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3 text-sm">
                                {[
                                    { id: "token", label: "Token" },
                                    { id: "swap", label: "Swap" },
                                    { id: "gallery", label: "Gallery" },
                                    { id: "roadmap", label: "Roadmap" },
                                    { id: "faq", label: "FAQ" },
                                ].map((item, i) => (
                                    <li role="none" key={item.id}>
                                        <a
                                            role="menuitem"
                                            ref={i === 0 ? firstLinkRef : undefined}
                                            href={`#${item.id}`}
                                            className="block py-1 hover:text-white"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                toggleRef.current?.focus();
                                            }}
                                        >
                                            {item.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </>
                )}
            </header>

            {/* Hero */}
            <section id="home" className="relative">
                <div
                    className="absolute inset-0 -z-10 opacity-30"
                    style={{
                        background: `radial-gradient(60% 60% at 50% 20%, ${brand.secondary}22 0%, transparent 60%), radial-gradient(40% 40% at 80% 10%, ${brand.primary}22 0%, transparent 60%)`,
                    }}
                />
                <div className="mx-auto max-w-6xl px-4 py-8 md:py-16 grid md:grid-cols-2 gap-10 items-center">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
                            Froggy: community first,
                            <span style={{ color: brand.primary }}> zero-tax</span> trading on Sei Network
                        </h1>
                        <p className="mt-4 text-slate-300/90 max-w-prose">
                            1B supply. Liquidity locked. Built for memes, merchants, and holders. Utility grows with the community. Yields are real.
                        </p>
                        <p className="mt-4 text-slate-300/90 max-w-prose">Contract is immutable and finalized!</p>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <a
                                href="#swap"
                                className="rounded-2xl px-5 py-2.5 text-sm font-semibold transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                                style={{ background: brand.primary, color: "#081318" }}
                            >
                                Trade $FROG
                            </a>
                            <a href="#token" className="rounded-xl px-5 py-2.5 text-sm font-semibold border border-white/15 hover:bg-white/5">
                                Token details
                            </a>
                        </div>
                        <div className="mt-6 text-xs text-brand-subtle leading-snug">
                            CA: <code className="select-all">{ADDR.token}</code>
                        </div>
                    </div>

                    {/* Mascot card placeholder */}
                    <div className="relative">
                        <div className="relative mx-auto aspect-square max-w-sm rounded-3xl shadow-xl" style={{ background: brand.card }}>
                            <Image src="/froggy-base.png" alt="Froggy base mascot" fill sizes="(min-width: 768px) 24rem, 18rem" className="object-contain p-4" />
                        </div>
                        <div className="absolute -top-3 -right-3 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: brand.secondary, boxShadow: `0 0 10px ${brand.secondary}` }}>
                            Live
                        </div>
                    </div>
                </div>
            </section>

            {/* Token section */}
            <section id="token" className="mx-auto max-w-6xl px-4 pt-6 pb-14">
                <h2 className="text-2xl md:text-3xl font-bold">Token</h2>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {[
                        { k: "Ticker", v: "$FROG" },
                        { k: "Chain", v: "Sei Network ID: 1329" },
                        { k: "Supply", v: "Hard Cap: 1,000,000,000" },
                    ].map(({ k, v }) => (
                        <div key={k} className="rounded-2xl p-5 border border-white/10 bg-brand-card transition-all duration-200 hover:border-white/20 hover:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.6)] hover:-translate-y-0.5">
                            <div className="text-brand-subtle text-xs uppercase tracking-wide">{k}</div>
                            <div className={`mt-1 text-lg font-semibold ${k === "Supply" ? "text-center" : ""}`}>{v}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Swap placeholder */}
            <section id="swap" className="mx-auto max-w-6xl px-4 pb-14">
                <h2 className="text-2xl md:text-3xl font-bold">Swap</h2>
                <p className="mt-2 text-slate-300/90 text-sm leading-snug">Trade $FROG with live price data.</p>

                <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr] items-start">
                    {/* Left: chart */}
                    <div className="rounded-2xl overflow-hidden border border-white/10 bg-brand-card h-[min(70vh,680px)] min-h-[520px] flex flex-col">
                        <iframe
                            title="FROG/SEI price chart on GeckoTerminal"
                            src={URL.geckoEmbed}
                            className="w-full flex-1"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            sandbox="allow-same-origin allow-scripts allow-popups"
                        />

                        <div className="border-t border-white/10 bg-black/20 backdrop-blur px-3 py-2 flex items-center gap-2">
                            <div className="text-xs text-brand-subtle">Pair</div>
                            <code className="text-[11px] font-mono select-all truncate max-w-[40ch]" title={ADDR.pair}>
                                {ADDR.pair}
                            </code>
                            <div className="ml-auto flex items-center gap-2">
                                <CopyButton value={ADDR.pair} label="pair address" />
                                <a href={URL.pairExplorer} target="_blank" rel="noopener noreferrer" className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5">
                                    Explorer ↗
                                </a>
                                <a href={URL.geckoFull} target="_blank" rel="noopener noreferrer" className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5">
                                    Full chart ↗
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Right: quick action + stats */}
                    <div className="rounded-2xl border border-white/10 bg-brand-card p-5 flex flex-col h-auto md:h-[min(70vh,680px)]">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm text-brand-subtle">Quick Action</div>
                                <h3 className="mt-1 text-lg font-semibold">$FROG Swap</h3>
                            </div>
                            <Image src="/froggy-cape.png" alt="Froggy icon" width={48} height={48} className="rounded-full" decoding="async" />
                        </div>

                        {/* Inputs (mock) */}
                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="text-xs text-brand-subtle" htmlFor="from-asset">
                                    From
                                </label>
                                <button id="from-asset" type="button" className="mt-1 h-12 w-full rounded-xl bg-white/5 text-left px-3 text-sm">
                                    Connect wallet to select
                                </button>
                            </div>
                            <div>
                                <label className="text-xs text-brand-subtle" htmlFor="to-asset">
                                    To ($FROG)
                                </label>
                                <button id="to-asset" type="button" className="mt-1 h-12 w-full rounded-xl bg-white/5 text-left px-3 text-sm font-mono">
                                    0x…{ADDR.token.slice(-6)}
                                </button>
                            </div>
                        </div>

                        <a
                            href={URL.dragon}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 h-11 w-full rounded-2xl bg-brand-secondary font-semibold text-sm text-[#081318] grid place-items-center transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-secondary/50"
                        >
                            Open on DragonSwap ↗
                        </a>

                        <a
                            href={URL.yaka}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 h-11 w-full rounded-2xl bg-brand-primary font-semibold text-sm text-[#081318] grid place-items-center transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                        >
                            Open on Yaka ↗
                        </a>

                        <div className="mt-4 border-t border-white/10 pt-4" />

                        {/* Contract + copy */}
                        <div className="mt-5 rounded-xl border border-white/10 p-3">
                            <div className="text-xs text-brand-subtle">Contract</div>
                            <div className="mt-1 flex items-center gap-2">
                                <code className="text-[10px] select-all break-all">{ADDR.token}</code>
                                <div className="ml-auto">
                                    <CopyButton value={ADDR.token} label="contract address" />
                                </div>
                            </div>
                        </div>

                        <LiveStats />

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <a href={URL.tokenExplorer} target="_blank" rel="noopener noreferrer" className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5">
                                View token on Seitrace
                            </a>
                            <a href={URL.geckoFull} target="_blank" rel="noopener noreferrer" className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5">
                                View full chart
                            </a>
                        </div>

                        <div className="mt-12 text-[11px] text-brand-subtle/90 leading-snug">Uses external DEX for execution. Slippage and fees apply.</div>
                    </div>
                </div>
            </section>

            {/* Roadmap */}
            <section id="roadmap" className="mx-auto max-w-6xl px-4 pb-14">
                <h2 className="text-2xl md:text-3xl font-bold">Roadmap</h2>
                <ol className="mt-6 grid gap-4 md:grid-cols-3">
                    {[
                        { t: "Phase 1", d: "dApp website features + swap" },
                        { t: "Phase 2", d: "On-chain streaks + merchant pilots" },
                        { t: "Phase 3", d: "Ecosystem tools + partnerships" },
                    ].map(({ t, d }, i) => (
                        <li key={t} className="rounded-2xl p-5 border border-white/10" style={{ background: brand.card }}>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full font-semibold" style={{ background: brand.primary, color: "#081318" }}>
                                    {i + 1}
                                </span>
                                {t}
                            </div>
                            <div className="mt-2 font-semibold">{d}</div>
                        </li>
                    ))}
                </ol>
            </section>

            {/* FAQ */}
            <section id="faq" className="mx-auto max-w-6xl px-4 pb-20">
                <h2 className="text-2xl md:text-3xl font-bold">FAQ</h2>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {[
                        ["Is there a tax?", "No. Zero on buys and sells."],
                        ["Where is liquidity?", "Locked. Verified on-chain."],
                        ["What is utility?", "Community-first memes, merchant pilots, and on-chain streaks."],
                    ].map(([q, a]) => (
                        <div key={q as string} className="rounded-2xl p-5 border border-white/10" style={{ background: brand.card }}>
                            <div className="font-semibold">{q}</div>
                            <div className="mt-1 text-slate-300/90 text-sm">{a}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/10">
                <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-400">
                    <div className="flex items-center justify-between">
                        <div>© {new Date().getFullYear()} Froggy Project</div>
                        <div className="flex gap-4">
                            <a href="#" className="hover:text-white">X/Twitter</a>
                            <a href="#" className="hover:text-white">Discord</a>
                            <a href="#" className="hover:text-white">Docs</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
