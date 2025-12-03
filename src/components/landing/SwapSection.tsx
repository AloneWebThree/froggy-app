"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { parseUnits, formatUnits, type Address } from "viem";
import {
    useAccount,
    useChainId,
    useWriteContract,
    useWaitForTransactionReceipt,
    useReadContract,
} from "wagmi";

import LiveStats from "@/components/LiveStats";
import { CopyButton } from "@/components/landing/CopyButton";
import {
    ADDR,
    URL,
    SEI_EVM_CHAIN_ID,
    DRAGON_ROUTER_ADDRESS,
    DRAGON_ROUTER_ABI,
    WSEI_ADDRESS,
} from "@/lib/froggyConfig";

import { SwapSuccessToast } from "@/components/ui/SwapSuccessToast";
import { SwapErrorToast } from "@/components/ui/SwapErrorToast";

export function SwapSection() {
    const [amount, setAmount] = useState("");

    // toast
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [txForToast, setTxForToast] = useState<`0x${string}` | undefined>();

    const [showErrorToast, setShowErrorToast] = useState(false);
    const [errorToastMessage, setErrorToastMessage] = useState<string | undefined>();

    // USD pricing
    const [seiUsdPrice, setSeiUsdPrice] = useState<number | null>(null);
    const [frogUsdPrice, setFrogUsdPrice] = useState<number | null>(null);

    // fetch SEI → USD once
    useEffect(() => {
        async function fetchSeiPrice() {
            try {
                const res = await fetch(
                    "https://api.coingecko.com/api/v3/simple/price?ids=sei-network&vs_currencies=usd"
                );
                if (!res.ok) return;
                const data = await res.json();
                const price = data?.["sei-network"]?.usd;
                if (typeof price === "number") {
                    setSeiUsdPrice(price);
                }
            } catch (err) {
                console.error("Failed to fetch SEI price", err);
            }
        }

        fetchSeiPrice();
    }, []);

    const formatUsd = (value: number) => {
        if (!Number.isFinite(value)) return null;
        const opts =
            value >= 1
                ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                : { minimumFractionDigits: 2, maximumFractionDigits: 4 };
        return `$${value.toLocaleString(undefined, opts)}`;
    };

    // parsed input for quote
    let amountInForQuote: bigint | null = null;
    try {
        if (amount && Number(amount) > 0) {
            amountInForQuote = parseUnits(amount.replace(",", "."), 18);
        }
    } catch {
        amountInForQuote = null;
    }

    const parsedAmount = amount ? Number(amount.replace(",", ".")) : 0;
    const fromUsdValue =
        seiUsdPrice !== null && parsedAmount > 0
            ? parsedAmount * seiUsdPrice
            : null;

    const { address } = useAccount();
    const chainId = useChainId();

    const { writeContract, data: txHash, isPending } = useWriteContract();
    const {
        isLoading: isConfirming,
        isSuccess: isTxConfirmed,
    } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    // when tx is confirmed, show toast
    useEffect(() => {
        if (isTxConfirmed && txHash) {
            setTxForToast(txHash as `0x${string}`);
            setShowSuccessToast(true);
        }
    }, [isTxConfirmed, txHash]);

    const quotePath: Address[] = [WSEI_ADDRESS, ADDR.token as Address];
    const oneSei = parseUnits("1", 18);

    // main quote for the user-entered amount
    const { data: quoteData, isLoading: isQuoteLoading } = useReadContract({
        address: DRAGON_ROUTER_ADDRESS as Address,
        abi: DRAGON_ROUTER_ABI,
        functionName: "getAmountsOut",
        args:
            amountInForQuote !== null
                ? [amountInForQuote, quotePath]
                : undefined,
        query: {
            enabled: amountInForQuote !== null,
        },
    });

    // price quote for 1 SEI -> FROG to derive FROG/USD
    const { data: priceQuoteData } = useReadContract({
        address: DRAGON_ROUTER_ADDRESS as Address,
        abi: DRAGON_ROUTER_ABI,
        functionName: "getAmountsOut",
        args: [oneSei, quotePath],
        query: {
            enabled: seiUsdPrice !== null,
        },
    });

    let frogOutFormatted: string | null = null;
    let minOutFromQuote: bigint | null = null;
    let frogOutRaw: bigint | null = null;

    if (quoteData && Array.isArray(quoteData) && quoteData.length >= 2) {
        const out = quoteData[1] as bigint;

        if (out > BigInt(0)) {
            frogOutRaw = out;
            frogOutFormatted = formatUnits(out, 18);

            // 2% slippage buffer
            const ninetyEight = BigInt(98);
            const hundred = BigInt(100);

            minOutFromQuote = (out * ninetyEight) / hundred;
        }
    }

    // derive FROG/USD from 1 SEI → FROG quote
    useEffect(() => {
        if (
            !priceQuoteData ||
            !Array.isArray(priceQuoteData) ||
            priceQuoteData.length < 2
        ) {
            return;
        }
        if (seiUsdPrice === null) return;

        const out = priceQuoteData[1] as bigint;
        if (out <= BigInt(0)) return;

        const frogsPerSei = Number(formatUnits(out, 18));
        if (!Number.isFinite(frogsPerSei) || frogsPerSei <= 0) return;

        const frogPrice = seiUsdPrice / frogsPerSei;
        if (Number.isFinite(frogPrice) && frogPrice > 0) {
            setFrogUsdPrice(frogPrice);
        }
    }, [priceQuoteData, seiUsdPrice]);

    // To-side USD based on FROG amount * FROG/USD
    const frogOutAmount =
        frogOutFormatted && frogOutFormatted.length > 0
            ? Number(frogOutFormatted)
            : 0;

    const toUsdValue =
        frogUsdPrice !== null && frogOutAmount > 0
            ? frogOutAmount * frogUsdPrice
            : null;

    const wrongNetwork =
        !!address && chainId !== undefined && chainId !== SEI_EVM_CHAIN_ID;

    const swapDisabled =
        !address ||
        wrongNetwork ||
        !amount ||
        Number(amount) <= 0 ||
        isPending ||
        isConfirming;

    const swapLabel = !address
        ? "Connect wallet to swap"
        : wrongNetwork
            ? "Switch to Sei EVM"
            : !amount || Number(amount) <= 0
                ? "Enter amount"
                : isPending || isConfirming
                    ? "Swapping…"
                    : "Swap now";

    async function handleSwap() {
        if (!address) return;
        if (wrongNetwork) return;

        let amountIn: bigint;
        try {
            amountIn = parseUnits(amount.replace(",", "."), 18);
        } catch {
            return;
        }

        if (amountIn <= BigInt(0)) return;
        if (!minOutFromQuote) return;

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

        const path: Address[] = [WSEI_ADDRESS, ADDR.token as Address];

        try {
            await writeContract({
                address: DRAGON_ROUTER_ADDRESS as Address,
                abi: DRAGON_ROUTER_ABI,
                functionName: "swapExactSEIForTokens",
                args: [minOutFromQuote, path, address as Address, deadline],
                value: amountIn,
            });
        } catch (err: unknown) {
            const fallback = "Transaction was rejected or failed.";

            let msg = fallback;

            if (err && typeof err === "object") {
                const e = err as { shortMessage?: string; message?: string };
                msg = e.shortMessage || e.message || fallback;
            } else if (typeof err === "string") {
                msg = err;
            }

            setErrorToastMessage(msg);
            setShowErrorToast(true);

            return;
        }
    }

    return (
        <section className="mx-auto max-w-6xl px-4 pb-14">
            <h2 className="text-2xl md:text-3xl font-bold">Swap</h2>
            <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                Swap SEI for $FROG directly from the dApp.
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
                        <code className="text-[11px] font-mono select-all truncate max-w-[40ch]">
                            {ADDR.pair}
                        </code>
                        <div className="ml-auto flex items-center gap-2">
                            <CopyButton value={ADDR.pair} label="pair address" />
                            <a
                                href={URL.pairExplorer}
                                className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5"
                                target="_blank"
                            >
                                Explorer ↗
                            </a>
                            <a
                                href={URL.dexFull}
                                className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5"
                                target="_blank"
                            >
                                Full chart ↗
                            </a>
                        </div>
                    </div>
                </div>

                {/* Right: FroggySwap card */}
                <div id="swap" className="rounded-2xl border border-white/10 bg-brand-card p-5 flex flex-col h-auto md:h-[clamp(540px,70vh,680px)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-brand-subtle">Quick Action</div>
                            <h3 className="mt-1 text-lg font-semibold">
                                FroggySwap ($SEI → $Frog)
                            </h3>
                            <p className="mt-1 text-xs text-brand-subtle">
                                Swaps route through Sei EVM.
                            </p>
                        </div>
                        <Image
                            src="/froggy-cape.png"
                            width={88}
                            height={88}
                            className="rounded-full"
                            alt="Froggy icon"
                        />
                    </div>

                    <div className="mt-4 space-y-4">
                        {/* From SEI */}
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between text-xs text-brand-subtle">
                                <span>From</span>
                                <span className="font-mono text-brand-text">
                                    SEI (EVM)
                                </span>
                            </div>
                            <input
                                inputMode="decimal"
                                placeholder="0.0"
                                className="h-11 w-full rounded-xl bg-black/20 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                                value={amount}
                                onChange={(e) => {
                                    setAmount(e.target.value.trim());
                                }}
                            />
                            <div className="flex items-center justify-between text-[11px] text-brand-subtle">
                                <span>Enter how much SEI to swap into $FROG.</span>
                                {fromUsdValue !== null && formatUsd(fromUsdValue) && (
                                    <span className="font-mono text-xs text-brand-text">
                                        ≈ {formatUsd(fromUsdValue)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* To FROG */}
                        <div className="grid gap-1">
                            <label className="text-xs text-brand-subtle">To</label>
                            <button
                                type="button"
                                className="h-11 w-full rounded-xl bg-black/20 text-left px-3 text-sm font-mono"
                            >
                                {frogOutFormatted
                                    ? `${frogOutFormatted.slice(0, 12)} FROG`
                                    : "0.0 FROG"}
                            </button>
                            <div className="flex items-center justify-between text-[11px] text-brand-subtle">
                                <span>
                                    {amountInForQuote === null ? (
                                        <>Output estimate depends on pool price and fees.</>
                                    ) : isQuoteLoading ? (
                                        <>Fetching quote…</>
                                    ) : frogOutFormatted ? (
                                        <>Estimated output with lowest slippage.</>
                                    ) : (
                                        <>No quote available for this amount.</>
                                    )}
                                </span>
                                {toUsdValue !== null && formatUsd(toUsdValue) && (
                                    <span className="font-mono text-xs text-brand-text">
                                        ≈ {formatUsd(toUsdValue)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Swap button */}
                    <button
                        type="button"
                        onClick={handleSwap}
                        disabled={swapDisabled}
                        className={`mt-5 h-11 w-full rounded-2xl text-sm font-semibold transition-transform duration-150 ${swapDisabled
                                ? "cursor-not-allowed bg-brand-subtle/30 text-brand-subtle"
                                : "bg-brand-primary text-black hover:scale-[1.01]"
                            }`}
                    >
                        {swapLabel}
                    </button>

                    <div className="mt-5 border-t border-white/10 pt-3" />

                    {/* Contract + copy */}
                    <div className="rounded-xl border border-white/10 p-3">
                        <div className="text-xs text-brand-subtle">Token contract</div>
                        <div className="mt-1 flex items-center gap-2">
                            <code className="text-[11px] select-all break-all">
                                {ADDR.token}
                            </code>
                        </div>
                    </div>

                    <LiveStats />

                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <a
                            href={URL.tokenExplorer}
                            className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5"
                            target="_blank"
                        >
                            View on Seitrace
                        </a>
                        <a
                            href={URL.dexFull}
                            className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5"
                            target="_blank"
                        >
                            View full chart
                        </a>
                    </div>
                </div>
            </div>

            <SwapSuccessToast
                open={showSuccessToast}
                onClose={() => setShowSuccessToast(false)}
                txHash={txForToast}
            />

            <SwapErrorToast
                open={showErrorToast}
                onClose={() => setShowErrorToast(false)}
                errorMessage={errorToastMessage}
            />
        </section>
    );
}
