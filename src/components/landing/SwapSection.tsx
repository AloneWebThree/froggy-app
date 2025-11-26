"use client";

import { useState } from "react";
import Image from "next/image";

import LiveStats from "@/components/LiveStats";
import { CopyButton } from "@/components/landing/CopyButton";
import { ADDR, URL } from "@/lib/froggyConfig";
import { brand } from "@/lib/brand";

// token select state
type FromChoice =
    | { kind: "native"; label: "SEI"; value: "SEI" }
    | { kind: "erc20"; label: "Native USDC"; value: string }
    | { kind: "erc20"; label: "Native USDT"; value: string }
    | { kind: "erc20"; label: "WBTC"; value: string }
    | { kind: "erc20"; label: "WETH"; value: string }
    | { kind: "custom"; label: "Custom"; value: string };

const FROM_PRESETS: FromChoice[] = [
    { kind: "native", label: "SEI", value: "SEI" },
    { kind: "erc20", label: "Native USDC", value: "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392" },
    { kind: "erc20", label: "Native USDT", value: "0x9151434b16b9763660705744891fA906F660EcC5" },
    { kind: "erc20", label: "WBTC", value: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c" },
    { kind: "erc20", label: "WETH", value: "0x160345fC359604fC6e70E3c5fAcbdE5F7A9342d8" },
    { kind: "custom", label: "Custom", value: "" },
];

// simple 0x address check (not exhaustive)
const isAddr = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);

export function SwapSection() {
    const [fromChoice, setFromChoice] = useState<FromChoice>(FROM_PRESETS[0]);
    const [customFrom, setCustomFrom] = useState("");

    const inputParam =
        fromChoice.kind === "custom" ? (customFrom || "") : fromChoice.value;

    const yakaHref = `https://yaka.finance/swap?inputCurrency=${encodeURIComponent(
        inputParam || "SEI"
    )}&outputCurrency=${ADDR.token}`;

    const dragonHref = `https://dragonswap.app/swap?outputCurrency=${ADDR.token
        }&inputCurrency=${encodeURIComponent(inputParam)}`;

    return (
        <section id="swap" className="mx-auto max-w-6xl px-4 pb-14">
            <h2 className="text-2xl md:text-3xl font-bold">Swap</h2>
            <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                Trade $FROG with live price data.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr] items-start">
                {/* Left: chart */}
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-brand-card h-[clamp(540px,70vh,680px)] min-h-[520px] flex flex-col">
                    <iframe
                        title="FROG/SEI price chart on DexScreener"
                        src={URL.dexEmbed}
                        className="w-full flex-1"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        sandbox="allow-same-origin allow-scripts allow-popups"
                    />

                    <div className="border-t border-white/10 bg-black/20 backdrop-blur px-3 py-2 flex items-center gap-2">
                        <div className="text-xs text-brand-subtle">Pair</div>
                        <code
                            className="text-[11px] font-mono select-all truncate max-w-[40ch]"
                            title={ADDR.pair}
                        >
                            {ADDR.pair}
                        </code>
                        <div className="ml-auto flex items-center gap-2">
                            <CopyButton value={ADDR.pair} label="pair address" />
                            <a
                                href={URL.pairExplorer}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5"
                            >
                                Explorer ↗
                            </a>
                            <a
                                href={URL.dexFull}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5"
                            >
                                Full chart ↗
                            </a>
                        </div>
                    </div>
                </div>

                {/* Right: quick action + stats */}
                <div className="rounded-2xl border border-white/10 bg-brand-card p-5 flex flex-col h-auto md:h-[clamp(540px,70vh,680px)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-brand-subtle">Quick Action</div>
                            <h3 className="mt-1 text-lg font-semibold">$FROG Swap</h3>
                        </div>
                        <Image
                            src="/froggy-cape.png"
                            alt="Froggy icon"
                            width={48}
                            height={48}
                            className="rounded-full"
                            decoding="async"
                        />
                    </div>

                    {/* Inputs (real selector) */}
                    <div className="mt-4 space-y-3">
                        <div>
                            <label
                                className="text-xs text-brand-subtle"
                                htmlFor="from-asset"
                            >
                                From
                            </label>
                            <div className="mt-1 grid gap-2">
                                <select
                                    id="from-asset"
                                    className="h-12 w-full rounded-xl bg-brand-card text-left px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40 text-brand-text"
                                    value={fromChoice.label}
                                    onChange={(e) => {
                                        const pick = FROM_PRESETS.find(
                                            (p) => p.label === e.target.value
                                        )!;
                                        setFromChoice(pick);
                                    }}
                                >
                                    {FROM_PRESETS.map((p) => (
                                        <option key={p.label} value={p.label}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>

                                {fromChoice.kind === "custom" && (
                                    <div className="grid gap-1">
                                        <input
                                            inputMode="text"
                                            placeholder="Paste ERC-20 address, e.g. 0xabc…"
                                            className="h-11 w-full rounded-xl bg-white/5 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                                            value={customFrom}
                                            onChange={(e) =>
                                                setCustomFrom(e.target.value.trim())
                                            }
                                        />
                                        <div className="text-[11px] text-brand-subtle">
                                            {customFrom
                                                ? isAddr(customFrom)
                                                    ? "Valid address"
                                                    : "Enter a 0x + 40 hex address"
                                                : "Optional unless using a custom token"}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label
                                className="text-xs text-brand-subtle"
                                htmlFor="to-asset"
                            >
                                To ($FROG)
                            </label>
                            <button
                                id="to-asset"
                                type="button"
                                className="mt-1 h-12 w-full rounded-xl bg-white/5 text-left px-3 text-sm font-mono"
                                title={ADDR.token}
                            >
                                0x…{ADDR.token.slice(-6)}
                            </button>
                        </div>
                    </div>

                    <a
                        href={dragonHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 h-11 w-full rounded-2xl bg-brand-secondary font-semibold text-sm text-[#081318] grid place-items-center transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-secondary/50"
                    >
                        Open on DragonSwap ↗
                    </a>

                    <a
                        href={yakaHref}
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
                            <code className="text-[10px] select-all break-all">
                                {ADDR.token}
                            </code>
                            <div className="ml-auto">
                                <CopyButton
                                    value={ADDR.token}
                                    label="contract address"
                                />
                            </div>
                        </div>
                    </div>

                    <LiveStats />

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <a
                            href={URL.tokenExplorer}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5"
                        >
                            View on Seitrace
                        </a>
                        <a
                            href={URL.dexFull}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5"
                        >
                            View full chart
                        </a>
                    </div>

                    <div className="mt-4 text-[11px] text-brand-subtle/90 leading-snug">
                        Uses external DEX for execution. Slippage and fees apply.
                    </div>
                </div>
            </div>
        </section>
    );
}
