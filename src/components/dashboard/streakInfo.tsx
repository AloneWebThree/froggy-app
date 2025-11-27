"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

export default function StreakInfo() {
    const [open, setOpen] = useState(true);

    return (
        <section className="rounded-2xl border border-white/10 bg-brand-card/70 p-6 shadow-xl transition-all duration-300">
            {/* Header */}
            <button
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between group"
            >
                <h2 className="text-lg md:text-xl font-bold text-white group-hover:opacity-90 transition-opacity">
                    How Streaks Work
                </h2>

                <ChevronDown
                    className={`h-5 w-5 text-white/70 transition-transform duration-300 ${open ? "rotate-180" : "rotate-0"
                        }`}
                />
            </button>

            {/* Content Wrapper */}
            <div
                className={`mt-4 overflow-hidden transition-all duration-300 ${open ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
                    }`}
            >
                <div className="mt-4 space-y-8 text-[15px] leading-relaxed text-brand-subtle">

                    {/* TLDR */}
                    <Section
                        title="TL;DR"
                        body="Streaks reward holders who increase their FROG balance and check in every UTC day. Missing a day or failing to increase your balance resets your streak and your reward window."
                    />

                    <Section
                        title="1. One Check-In Per Day (UTC)"
                        body="You can check in once per UTC day. A second check-in attempt during the same UTC day will fail. Streaks are based on UTC time, not your local timezone."
                    />

                    <Section
                        title="2. Balance Must Increase"
                        body="Your FROG balance must be higher than it was on your last check-in. Same or lower balance = failed check-in. Selling breaks eligibility until you stack more tokens."
                    />

                    <Section
                        title="3. Minimum Holding Requirement"
                        body="You must hold at least the required minimum amount of FROG or your check-in will fail. Currently set to 100 FROG."
                    />

                    <Section
                        title="4. How Streaks Work"
                        body="A streak is a chain of consecutive UTC days where you successfully check in. Missing even one day resets your streak back to 1. There is no grace period."
                    />

                    <Section
                        title="5. Streak Reset Behavior"
                        body="Missing a day resets your streak and streak window. Your streakStartBalance becomes your current balance and addedDuringStreak resets to zero. Any growth before the new streak does not count toward rewards."
                    />

                    <div>
                        <h3 className="font-semibold text-white mb-1">6. What We Track</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Current streak length</li>
                            <li>Your longest streak ever</li>
                            <li>Total successful check-ins</li>
                            <li>Last check-in day (UTC)</li>
                            <li>Last recorded balance</li>
                            <li>Streak start day</li>
                            <li>Streak start balance</li>
                            <li>Added during this streak only</li>
                            <li>Lifetime positive balance increases</li>
                        </ul>
                    </div>

                    <Section
                        title="7. How Rewards Work"
                        body="Rewards are based on your current streak and the amount of FROG you’ve added during that streak only. Anything outside the active streak window does not count."
                    />

                    <Section
                        title="8. No Shortcuts"
                        body="No backdating. No skipping days. No rolling 24-hour windows. No workarounds. Only consistent daily holders earn rewards."
                    />

                    <Section
                        title="9. Contract Safety"
                        body="The contract never transfers your tokens and never requires approvals. It only reads your balance to calculate streaks and rewards. Extremely safe."
                    />

                </div>
            </div>
        </section>
    );
}

function Section({ title, body }: { title: string; body: string }) {
    return (
        <div className="transition-all">
            <h3 className="font-semibold text-white mb-1">{title}</h3>
            <p>{body}</p>
        </div>
    );
}
