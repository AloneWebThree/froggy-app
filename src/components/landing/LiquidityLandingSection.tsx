"use client";

import Image from "next/image";
import { LiquiditySection } from "@/components/landing/LiquiditySection";

export function LiquidityLandingSection() {
    return (
        <section id="liquidity" className="scroll-mt-20 mx-auto max-w-6xl px-4 pb-14">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-2xl md:text-3xl font-bold">Liquidity</h2>
                    <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                        Add or Remove liquidity from $Frog pools
                    </p>
                </div>

                <Image
                    src="/froggy-cash.png"
                    width={88}
                    height={88}
                    className="rounded-full shrink-0 opacity-90"
                    alt="Froggy icon"
                />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-brand-card p-5">
                <LiquiditySection />
            </div>
        </section>
    );
}