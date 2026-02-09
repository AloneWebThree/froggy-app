"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { type Address, type Abi } from "viem";
import { useAccount, useChainId, useWaitForTransactionReceipt } from "wagmi";

import LiveStats from "@/components/LiveStats";
import { CopyButton } from "@/components/landing/CopyButton";
import {
    ADDR,
    URL,
    SEI_EVM_CHAIN_ID,
    DRAGON_ROUTER_ADDRESS,
    DRAGON_ROUTER_ABI,
} from "@/lib/froggyConfig";

import { SwapSuccessToast } from "@/components/ui/SwapSuccessToast";
import { SwapErrorToast } from "@/components/ui/SwapErrorToast";

import { parseSeiInput } from "@/lib/swap/parseSeiInput";
import { useSeiUsdPrice } from "@/lib/swap/hooks/useSeiUsdPrice";

// v2 hooks (FROG)
import { useSwapQuote } from "@/lib/swap/hooks/useSwapQuote";
import { useSwapExecution } from "@/lib/swap/hooks/useSwapExecution";
import { useTokenUsdPriceFromRouter } from "@/lib/swap/hooks/useTokenUsdPriceFromRouter";

// v3 hooks (USDY)
import { encodeV3Path } from "@/lib/swap/v3Path";
import { useSwapQuoteV3 } from "@/lib/swap/hooks/useSwapQuoteV3";
import { useSwapExecutionV3 } from "@/lib/swap/hooks/useSwapExecutionV3";
import { useTokenUsdPriceFromQuoterV3 } from "@/lib/swap/hooks/useTokenUsdPriceFromQuoterV3";

import {
    SWAP_TOKENS,
    DRAGON_V3_QUOTER,
    DRAGON_V3_SWAPROUTER02,
} from "@/lib/swap/tokens";

type TokenSymbol = (typeof SWAP_TOKENS)[number]["symbol"];

export function SwapSection() {
    const [amount, setAmount] = useState("");

    // token selection (default FROG)
    const [tokenSymbol, setTokenSymbol] = useState<TokenSymbol>("FROG");
    const selectedToken = useMemo(
        () => SWAP_TOKENS.find((t) => t.symbol === tokenSymbol) ?? SWAP_TOKENS[0],
        [tokenSymbol]
    );

    // Hydration-safe mount gate (lint-safe)
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    // Success toast
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [txForToast, setTxForToast] = useState<`0x${string}` | undefined>();

    // Error toast visibility (message comes from execution hook)
    const [showErrorToast, setShowErrorToast] = useState(false);

    // USD pricing
    const seiUsdPrice = useSeiUsdPrice(30_000);

    const formatUsd = (value: number) => {
        if (!Number.isFinite(value)) return null;
        const opts =
            value >= 1
                ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                : { minimumFractionDigits: 2, maximumFractionDigits: 4 };
        return `$${value.toLocaleString(undefined, opts)}`;
    };

    // Input parsing (SEI input only)
    const parsed = parseSeiInput(amount);
    const amountInForQuote = parsed.units;
    const parsedAmount = parsed.number;

    const fromUsdValue =
        seiUsdPrice !== null && parsedAmount > 0 ? parsedAmount * seiUsdPrice : null;

    // Wallet / chain
    const { address } = useAccount();
    const chainId = useChainId();

    const hasAddress = mounted && !!address;
    const isSeiEvm = mounted && chainId !== undefined ? chainId === SEI_EVM_CHAIN_ID : true;
    const wrongNetwork = hasAddress && !isSeiEvm;

    const isV3 = selectedToken.kind === "v3";

    // ----- V3 path bytes (only for V3 tokens) -----
    const v3PathBytes = useMemo(() => {
        if (!isV3) return null;
        const tokens = selectedToken.v3Tokens;
        const fees = selectedToken.v3Fees;
        if (!tokens || !fees) return null;

        try {
            return encodeV3Path({
                tokens: tokens as readonly Address[],
                fees: fees as readonly number[],
            }) as `0x${string}`;
        } catch {
            return null;
        }
    }, [isV3, selectedToken]);

    // ----- QUOTES -----
    // V2 quote (FROG)
    const v2Path = (selectedToken.v2Route ?? []) as unknown as Address[];
    const v2Quote = useSwapQuote({
        routerAddress: DRAGON_ROUTER_ADDRESS as Address,
        routerAbi: DRAGON_ROUTER_ABI as Abi,
        amountIn: amountInForQuote,
        path: v2Path,
        decimals: selectedToken.decimals,
        slippageBps: 200,
    });

    // V3 quote (USDY)
    const v3Quote = useSwapQuoteV3({
        quoterAddress: DRAGON_V3_QUOTER as Address,
        pathBytes: (v3PathBytes ?? "0x") as `0x${string}`,
        amountIn: amountInForQuote,
        outDecimals: selectedToken.decimals,
        slippageBps: 200,
    });

    const tokenOutFormatted = isV3 ? v3Quote.outFormatted : v2Quote.outFormatted;
    const minOutFromQuote = isV3 ? v3Quote.minOut : v2Quote.minOut;
    const isQuoteLoading = isV3 ? v3Quote.isLoading : v2Quote.isLoading;

    // ----- USD pricing for output -----
    // V2 pricing: uses getAmountsOut(1 SEI -> token route)
    const tokenUsdPriceV2 = useTokenUsdPriceFromRouter({
        seiUsdPrice,
        routerAddress: DRAGON_ROUTER_ADDRESS as Address,
        routerAbi: DRAGON_ROUTER_ABI as Abi,
        tokenDecimals: selectedToken.decimals,
        seiRoute: selectedToken.v2Route ?? [],
    });

    // V3 pricing: uses QuoterV2 quoteExactInput(1 SEI -> token pathBytes)
    const tokenUsdPriceV3 = useTokenUsdPriceFromQuoterV3({
        seiUsdPrice,
        quoterAddress: DRAGON_V3_QUOTER as Address,
        pathBytes: (v3PathBytes ?? "0x") as `0x${string}`,
        tokenDecimals: selectedToken.decimals,
    });

    const tokenUsdPrice = isV3 ? tokenUsdPriceV3 : tokenUsdPriceV2;

    // ----- EXECUTION -----
    // V2 execution (FROG)
    const v2Exec = useSwapExecution({
        routerAddress: DRAGON_ROUTER_ADDRESS as Address,
        routerAbi: DRAGON_ROUTER_ABI as Abi,
        path: v2Path,
    });

    // V3 execution (USDY)
    const v3Exec = useSwapExecutionV3({
        swapRouter02: DRAGON_V3_SWAPROUTER02 as Address,
    });

    const txHash = (isV3 ? v3Exec.txHash : v2Exec.txHash) as `0x${string}` | undefined;
    const isPending = isV3 ? v3Exec.isPending : v2Exec.isPending;
    const errorToastMessage = isV3 ? v3Exec.errorMessage : v2Exec.errorMessage;

    const clearError = () => {
        if (isV3) v3Exec.clearError();
        else v2Exec.clearError();
    };

    // Receipt / confirmations
    const { isLoading: isConfirming, isSuccess: isTxConfirmed } =
        useWaitForTransactionReceipt({ hash: txHash });

    useEffect(() => {
        if (!isTxConfirmed || !txHash) return;

        const id = requestAnimationFrame(() => {
            setTxForToast(txHash);
            setShowSuccessToast(true);
        });

        return () => cancelAnimationFrame(id);
    }, [isTxConfirmed, txHash]);

    useEffect(() => {
        if (!errorToastMessage) return;

        const id = requestAnimationFrame(() => {
            setShowErrorToast(true);
        });

        return () => cancelAnimationFrame(id);
    }, [errorToastMessage]);

    // USD estimate for output
    const tokenOutAmount =
        tokenOutFormatted && tokenOutFormatted.length > 0 ? Number(tokenOutFormatted) : 0;

    const toUsdValue =
        tokenUsdPrice !== null && tokenOutAmount > 0 ? tokenOutAmount * tokenUsdPrice : null;

    // Disable rules
    const missingV3Path = isV3 && !v3PathBytes;

    const swapDisabled =
        !mounted ||
        !hasAddress ||
        wrongNetwork ||
        !amountInForQuote ||
        !minOutFromQuote ||
        isQuoteLoading ||
        isPending ||
        isConfirming ||
        missingV3Path;

    const swapLabel = !mounted
        ? "Loading..."
        : !hasAddress
            ? "Connect wallet to swap"
            : wrongNetwork
                ? "Switch to Sei EVM"
                : !amountInForQuote
                    ? "Enter amount"
                    : missingV3Path
                        ? "Route not configured"
                        : isQuoteLoading
                            ? "Fetching quote…"
                            : !minOutFromQuote
                                ? "No quote available"
                                : isPending || isConfirming
                                    ? "Swapping…"
                                    : "Swap now";

    async function handleSwap() {
        if (!mounted || !address || wrongNetwork) return;
        if (!amountInForQuote || !minOutFromQuote) return;

        if (isV3) {
            if (!v3PathBytes) return;

            await v3Exec.executeSwapV3({
                recipient: address as Address,
                amountIn: amountInForQuote,
                minOut: minOutFromQuote,
                pathBytes: v3PathBytes,
                deadlineSeconds: 600,
            });
        } else {
            await v2Exec.executeSwap({
                address: address as Address,
                amountIn: amountInForQuote,
                minOut: minOutFromQuote,
                deadlineSeconds: 600,
            });
        }
    }

    const panelHeight = "h-[clamp(540px,70vh,680px)] min-h-[520px]";

    return (
        <section className="mx-auto max-w-6xl px-4 pb-14">
            <h2 className="text-2xl md:text-3xl font-bold">Swap</h2>
            <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                Swap SEI for a token directly from the dApp.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr] md:items-stretch">
                {/* Left: chart (still Froggy chart from your config) */}
                <div className={`rounded-2xl overflow-hidden border border-white/10 bg-brand-card ${panelHeight} flex flex-col`}>
                    <iframe
                        title="Price chart on DexScreener"
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
                                rel="noreferrer"
                            >
                                Explorer ↗
                            </a>
                            <a
                                href={URL.dexFull}
                                className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Full chart ↗
                            </a>
                        </div>
                    </div>
                </div>

                {/* Right: swap card */}
                <div
                    id="swap"
                    className={`rounded-2xl border border-white/10 bg-brand-card p-5 flex flex-col ${panelHeight} overflow-hidden`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-brand-subtle">Quick Action</div>
                            <h3 className="mt-1 text-lg font-semibold">
                                SEI → {selectedToken.symbol}
                            </h3>
                            <p className="mt-1 text-xs text-brand-subtle">Swaps route through Sei EVM.</p>
                        </div>
                        <Image
                            src="/froggy-cape.png"
                            width={88}
                            height={88}
                            className="rounded-full"
                            alt="Froggy icon"
                        />
                    </div>

                    <div className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-4">
                        <div className="space-y-4">
                            {/* Token selector */}
                            <div className="grid gap-2">
                                <label className="text-xs text-brand-subtle">Desired Token</label>
                                <select
                                    value={tokenSymbol}
                                    onChange={(e) => setTokenSymbol(e.currentTarget.value as TokenSymbol)}
                                    className="h-11 w-full rounded-xl bg-black/20 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                                >
                                    {SWAP_TOKENS.map((t) => (
                                        <option key={t.symbol} value={t.symbol}>
                                            {t.symbol}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* From SEI */}
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between text-xs text-brand-subtle">
                                    <span>From</span>
                                    <span className="font-mono text-brand-text">SEI (EVM)</span>
                                </div>
                                <input
                                    inputMode="decimal"
                                    placeholder="0.0"
                                    className="h-11 w-full box-border rounded-xl bg-black/20 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value.trim())}
                                />
                                <div className="flex items-center justify-between text-[11px] text-brand-subtle">
                                    <span>Enter how much SEI to swap.</span>
                                    {fromUsdValue !== null && formatUsd(fromUsdValue) && (
                                        <span className="font-mono text-xs text-brand-text">
                                            ≈ {formatUsd(fromUsdValue)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* To token */}
                            <div className="grid gap-1">
                                <label className="text-xs text-brand-subtle">To</label>
                                <button
                                    type="button"
                                    className="h-11 w-full rounded-xl bg-black/20 text-left px-3 text-sm font-mono"
                                >
                                    {tokenOutFormatted
                                        ? `${tokenOutFormatted.slice(0, 12)} ${selectedToken.symbol}`
                                        : `0.0 ${selectedToken.symbol}`}
                                </button>
                                <div className="flex items-center justify-between text-[11px] text-brand-subtle">
                                    <span>
                                        {amountInForQuote === null ? (
                                            <>Output estimate depends on pool price and fees.</>
                                        ) : isQuoteLoading ? (
                                            <>Fetching quote…</>
                                        ) : tokenOutFormatted ? (
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

                            <button
                                type="button"
                                onClick={handleSwap}
                                disabled={swapDisabled}
                                className={`h-11 w-full rounded-2xl text-sm font-semibold transition-transform duration-150 ${swapDisabled
                                    ? "cursor-not-allowed bg-brand-subtle/30 text-brand-subtle"
                                    : "bg-brand-primary text-black hover:scale-[1.01]"
                                    }`}
                            >
                                {swapLabel}
                            </button>

                            <div className="border-t border-white/10 pt-3" />
                            <LiveStats />
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <a
                            href={URL.tokenExplorer}
                            className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5"
                            target="_blank"
                            rel="noreferrer"
                        >
                            View on Seitrace
                        </a>
                        <a
                            href={URL.dexFull}
                            className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5"
                            target="_blank"
                            rel="noreferrer"
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
                onClose={() => {
                    setShowErrorToast(false);
                    clearError();
                }}
                errorMessage={errorToastMessage}
            />
        </section>
    );
}