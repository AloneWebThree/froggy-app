"use client";

import Link from "next/link";
import StreakInfo from "@/features/streak/components/StreakInfo";

export default function FAQPage() {
    return (
        <div className="min-h-screen px-6 py-10 md:py-16 bg-brand-bg">
            <div className="max-w-3xl mx-auto space-y-10">

                {/* Back button */}
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3.5 py-1.5 text-xs md:text-sm font-medium text-brand-subtle border border-white/15 hover:bg-white/10 hover:border-white/30 transition-colors"
                >
                    ← Back to Dashboard
                </Link>

                {/* Header */}
                <header className="space-y-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                        Streak FAQ
                    </h1>

                    <p className="text-brand-subtle text-sm md:text-base">
                        Everything you need to know about streaks, check-ins, and how rewards work.
                    </p>
                </header>

                {/* FAQ Content */}
                <StreakInfo />

            </div>
        </div>
    );
}
