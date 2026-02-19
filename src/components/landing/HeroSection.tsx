"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { requireAddress } from "@/lib/swap/tokenRegistry";
import { brand } from "@/lib/brand";
import froggySamurai from "@public/gallery/froggy-samurai.png";

function truncateAddr(addr: string) {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function MascotCard({ badgeText }: { badgeText: string }) {
    return (
        <div className="relative mx-auto w-full max-w-[22rem] md:max-w-sm">
            <div className="froggy-breathe relative aspect-square rounded-2xl border border-white/10 bg-brand-card/15 shadow-[0_22px_55px_rgba(0,0,0,0.85)] overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.10]"
                    style={{
                        background:
                            "radial-gradient(60% 60% at 50% 40%, #6eb819 0%, transparent 70%)",
                    }}
                />

                <Image
                    src={froggySamurai}
                    alt="Froggy samurai mascot"
                    fill
                    className="relative z-10 object-contain p-6"
                    priority
                />

                {/* Badge: anchored to the card */}
                <div className="absolute top-2 right-2 md:top-3 md:right-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-[11px] font-semibold text-brand-text shadow-[0_0_10px_rgba(0,0,0,0.6)] backdrop-blur">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-[#6EB819] opacity-50 animate-ping [animation-duration:1.6s]" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#6EB819]" />
                    </span>
                    <span>{badgeText}</span>
                </div>
            </div>
        </div>
    );
}

export function HeroSection() {
    const { isConnected } = useAccount();

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const frog = useMemo(() => requireAddress("FROG"), []);
    const [copied, setCopied] = useState(false);

    const explorerBase =
        process.env.NEXT_PUBLIC_SEI_EXPLORER_BASE_URL?.replace(/\/+$/, "") ||
        "https://seitrace.com";
    const explorerUrl = `${explorerBase}/address/${frog}`;

    const liveStatText = mounted
        ? isConnected
            ? "Live • wallet connected"
            : "Live • connect to track streaks"
        : "Live • loading…";

    async function onCopy() {
        try {
            await navigator.clipboard.writeText(frog);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            setCopied(false);
        }
    }

    return (
        <section id="home" className="relative">
            <div
                className="absolute inset-0 -z-10 opacity-30"
                style={{
                    background: `radial-gradient(60% 60% at 50% 20%, ${brand.secondary}22 0%, transparent 60%), radial-gradient(40% 40% at 80% 10%, ${brand.primary}22 0%, transparent 60%)`,
                }}
            />

            <div className="mx-auto max-w-6xl px-4 py-8 md:py-16 grid md:grid-cols-2 gap-10 items-center">
                {/* LEFT */}
                <div>
                    {/* Trust chips */}
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] sm:text-[11px] font-semibold">
                        {["1B supply", "Zero tax", "Liquidity locked", "Immutable"].map(
                            (t) => (
                                <span
                                    key={t}
                                    className="rounded-full border border-white/10 bg-brand-card/20 px-2.5 py-0.5 sm:px-3 sm:py-1 text-brand-text"
                                >
                                    {t}
                                </span>
                            )
                        )}
                    </div>

                    <h1 className="mt-4 text-4xl md:text-6xl font-extrabold leading-tight">
                        <span className="sm:whitespace-nowrap">
                            Earn <span className="text-brand-primary">daily</span> rewards.
                        </span>
                        <br />
                        Grow your streak.
                    </h1>

                    <p className="mt-4 text-brand-subtle max-w-prose">
                        $FROG on Sei EVM. On-chain daily check-ins. Build streaks. Compound
                        rewards.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            href="/#swap"
                            className="rounded-2xl px-5 py-2.5 text-sm font-semibold transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-primary/40 bg-brand-primary text-brand-bg"
                        >
                            FrogSwap
                        </Link>

                        {/* OUTLINED secondary for hierarchy */}
                        <Link
                            href="/dashboard"
                            className="rounded-2xl px-5 py-2.5 text-sm font-semibold transition-transform duration-150 hover:scale-[1.02] border border-white/15 bg-brand-card/10 text-brand-text hover:bg-brand-card/20 focus:outline-none focus:ring-2 focus:ring-white/10"
                        >
                            Dashboard
                        </Link>
                    </div>

                    <p className="mt-2 text-[11px] text-brand-subtle">
                        Check in daily to build streak rewards.
                    </p>

                    {/* MOBILE: show mascot earlier */}
                    <div className="mt-8 md:hidden">
                        <MascotCard badgeText={liveStatText} />
                    </div>

                    {/* CONTRACT: collapsible on mobile, full card on md+ */}
                    <div className="mt-6 md:mt-8">
                        {/* Mobile compact */}
                        <details className="group md:hidden rounded-2xl border border-white/10 bg-brand-card/15 px-3 py-2.5">
                            <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-brand-text">
                                        <span className="flex items-center transition-transform duration-200 group-open:rotate-90">
                                            <svg
                                                className="w-3 h-3"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path d="M6 4l8 6-8 6V4z" />
                                            </svg>
                                        </span>
                                        <span>Token Contract</span>
                                    </div>

                                    <div className="text-xs text-brand-subtle">
                                        {truncateAddr(frog)}
                                    </div>
                                </div>

                                <div className="mt-1 text-[11px] text-brand-subtle">
                                    Tap to expand
                                </div>
                            </summary>

                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-brand-subtle">
                                <code className="select-all text-brand-text">{frog}</code>

                                <button
                                    type="button"
                                    onClick={onCopy}
                                    aria-label="Copy token contract address"
                                    className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-brand-text hover:bg-black/40 transition"
                                >
                                    {copied ? "Copied" : "Copy"}
                                </button>

                                <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-brand-text hover:bg-black/40 transition"
                                >
                                    Explorer
                                </a>
                            </div>
                        </details>

                        {/* Desktop full */}
                        <div className="hidden md:block rounded-2xl border border-white/10 bg-brand-card/15 px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-brand-subtle leading-snug">
                                    <div className="font-semibold text-brand-text">
                                        Token Contract
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <code className="select-all text-brand-text">
                                            {truncateAddr(frog)}
                                        </code>

                                        <button
                                            type="button"
                                            onClick={onCopy}
                                            aria-label="Copy token contract address"
                                            className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold text-brand-text hover:bg-black/40 transition"
                                        >
                                            {copied ? "Copied" : "Copy"}
                                        </button>

                                        <a
                                            href={explorerUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold text-brand-text hover:bg-black/40 transition"
                                        >
                                            Explorer
                                        </a>
                                    </div>
                                </div>

                                <details className="text-[11px] text-brand-subtle">
                                    <summary className="cursor-pointer select-none hover:text-brand-text transition">
                                        Show full address
                                    </summary>
                                    <div className="mt-1">
                                        <code className="select-all">{frog}</code>
                                    </div>
                                </details>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT (desktop only; mobile already rendered above) */}
                <div className="hidden md:block">
                    <MascotCard badgeText={liveStatText} />
                </div>
            </div>
        </section>
    );
}