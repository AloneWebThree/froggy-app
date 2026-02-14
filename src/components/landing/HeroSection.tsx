"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { ADDR } from "@/lib/froggyConfig";
import { brand } from "@/lib/brand";
import froggySamurai from "@public/gallery/froggy-samurai.png";

export function HeroSection() {
    const { isConnected } = useAccount();

    // HYDRATION FIX: treat as disconnected until after mount
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    const dashboardEnabled = mounted && isConnected;

    return (
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
                        Community first,
                        <span className="text-brand-primary"> zero-tax</span> token on Sei Network
                    </h1>

                    <p className="mt-4 text-brand-subtle max-w-prose">
                        1B supply. Liquidity locked. Built for memes, investors, and long-term holders who actually
                        stick around.
                    </p>
                    <p className="mt-4 text-brand-subtle max-w-prose">
                        Contract is immutable and finalized. Daily streaks and on-chain rewards are designed to favor
                        holders who keep stacking FROG over time.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <a
                            href="#swap"
                            className="rounded-2xl px-5 py-2.5 text-sm font-semibold transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-primary/40 bg-brand-primary text-brand-bg"
                        >
                            Exchange
                        </a>

                        {/* Always render Link (stable markup). Block when locked. */}
                        <Link
                            href={dashboardEnabled ? "/dashboard" : "#"}
                            aria-disabled={!dashboardEnabled}
                            tabIndex={dashboardEnabled ? 0 : -1}
                            onClick={(e) => {
                                if (!dashboardEnabled) e.preventDefault();
                            }}
                            className={
                                dashboardEnabled
                                    ? "rounded-2xl px-5 py-2.5 text-sm font-semibold transition-transform duration-150 hover:scale-[1.02] cursor-pointer bg-brand-secondary text-brand-bg"
                                    : "rounded-2xl px-5 py-2.5 text-sm font-semibold transition-transform duration-150 cursor-not-allowed bg-[#e86a6a] opacity-40"
                            }
                        >
                            Dashboard
                        </Link>
                    </div>

                    <p className="mt-2 text-[11px] text-brand-subtle">
                        Dashboard access requires a connected wallet on Sei EVM.
                    </p>

                    <div className="mt-6 text-xs text-brand-subtle leading-snug">
                        Token Contract: <code className="select-all">{ADDR.token}</code>
                    </div>
                </div>

                {/* Mascot card */}
                <div className="relative">
                    <div className="froggy-breathe relative mx-auto aspect-square max-w-sm rounded-2xl border border-white/10 bg-brand-card/15 shadow-[0_22px_55px_rgba(0,0,0,0.85)] overflow-hidden">
                        <div
                            className="absolute inset-0 pointer-events-none opacity-[0.12]"
                            style={{
                                background: "radial-gradient(60% 60% at 50% 40%, #6eb819 0%, transparent 70%)",
                            }}
                        />

                        <Image
                            src={froggySamurai}
                            alt="Froggy samurai mascot"
                            fill
                            className="relative z-10 object-contain p-5"
                            priority
                        />
                    </div>

                    {/* Live badge */}
                    <div className="absolute -top-3 -right-3 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[11px] font-semibold text-brand-text shadow-[0_0_14px_rgba(0,0,0,0.9)] backdrop-blur">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-[#6EB819] opacity-60 animate-ping" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#6EB819]" />
                        </span>
                        <span>Live</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
