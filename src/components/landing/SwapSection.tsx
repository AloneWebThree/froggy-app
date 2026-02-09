"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { type Address, type Abi, parseUnits, maxUint256 } from "viem";
import {
    useAccount,
    useChainId,
    usePublicClient,
    useReadContract,
    useWaitForTransactionReceipt,
    useWriteContract,
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

import { parseSeiInput } from "@/lib/swap/parseSeiInput";
import { useSeiUsdPrice } from "@/lib/swap/hooks/useSeiUsdPrice";

import { useSwapQuote } from "@/lib/swap/hooks/useSwapQuote";
import { useSwapQuoteV3 } from "@/lib/swap/hooks/useSwapQuoteV3";
import { encodeV3Path } from "@/lib/swap/v3Path";

import { useTokenUsdPriceFromRouter } from "@/lib/swap/hooks/useTokenUsdPriceFromRouter";

import {
    USDC_ADDRESS,
    USDY_ADDRESS,
    DRAGON_V3_QUOTER,
    DRAGON_V3_SWAPROUTER02,
} from "@/lib/swap/tokens";

const USDC_DECIMALS = 6;
const USDY_DECIMALS = 18;
const FROG_DECIMALS = 18;

type FromSymbol = "SEI" | "USDC" | "USDY";
type ToSymbol = "FROG" | "USDC" | "USDY";

type RouteKind = "v2-native" | "v2-erc20" | "v3-erc20" | "unsupported";
type UnknownErr = { shortMessage?: string; message?: string };

function errToMessage(err: unknown, fallback: string) {
    if (!err) return fallback;
    if (typeof err === "string") return err;
    if (typeof err === "object") {
        const e = err as UnknownErr;
        return e.shortMessage || e.message || fallback;
    }
    return fallback;
}

const ERC20_MIN_ABI = [
    {
        name: "allowance",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
] as const;

// SwapRouter02 exactInput (path-based) — works for single hop and multi-hop
const V3_SWAPROUTER02_ABI = [
    {
        type: "function",
        name: "exactInput",
        stateMutability: "payable",
        inputs: [
            {
                name: "params",
                type: "tuple",
                components: [
                    { name: "path", type: "bytes" },
                    { name: "recipient", type: "address" },
                    { name: "deadline", type: "uint256" },
                    { name: "amountIn", type: "uint256" },
                    { name: "amountOutMinimum", type: "uint256" },
                ],
            },
        ],
        outputs: [{ name: "amountOut", type: "uint256" }],
    },
] as const;

function formatUsd(value: number) {
    if (!Number.isFinite(value)) return null;
    const opts =
        value >= 1
            ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            : { minimumFractionDigits: 2, maximumFractionDigits: 4 };
    return `$${value.toLocaleString(undefined, opts)}`;
}

function toBigIntAmount(input: string, decimals: number): bigint | null {
    const raw = input.trim().replace(",", ".");
    if (!raw) return null;

    const normalized = raw.startsWith(".") ? `0${raw}` : raw;
    if (!/^\d+(\.\d*)?$/.test(normalized)) return null;

    const cleaned = normalized.endsWith(".") ? normalized.slice(0, -1) : normalized;
    if (!cleaned) return null;

    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0) return null;

    try {
        const units = parseUnits(cleaned, decimals);
        return units > 0n ? units : null;
    } catch {
        return null;
    }
}

function isSupportedPair(from: FromSymbol, to: ToSymbol) {
    return (
        (from === "SEI" && to === "FROG") ||
        (from === "SEI" && to === "USDC") ||
        (from === "USDC" && to === "USDY") || // V3 on DragonSwap
        (from === "USDY" && to === "FROG")
    );
}

export function SwapSection() {
    const [amount, setAmount] = useState("");
    const [fromSymbol, setFromSymbol] = useState<FromSymbol>("SEI");
    const [toSymbol, setToSymbol] = useState<ToSymbol>("FROG");

    // Hydration-safe mount gate
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    // Wallet / chain
    const { address } = useAccount();
    const chainId = useChainId();
    const publicClient = usePublicClient();

    const hasAddress = mounted && !!address;
    const isSeiEvm = mounted && chainId !== undefined ? chainId === SEI_EVM_CHAIN_ID : true;
    const wrongNetwork = hasAddress && !isSeiEvm;

    // Toasts
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [txForToast, setTxForToast] = useState<`0x${string}` | undefined>();

    const [showErrorToast, setShowErrorToast] = useState(false);
    const [errorToastMessage, setErrorToastMessage] = useState<string | undefined>();

    const pushError = useCallback((msg: string) => {
        setErrorToastMessage(msg);
        setShowErrorToast(true);
    }, []);

    // Prices
    const seiUsdPrice = useSeiUsdPrice(30_000);

    // Route kind (ONLY USDC->USDY is V3)
    const routeKind: RouteKind = useMemo(() => {
        if (!isSupportedPair(fromSymbol, toSymbol)) return "unsupported";
        if (fromSymbol === "SEI") return "v2-native";
        if (fromSymbol === "USDC" && toSymbol === "USDY") return "v3-erc20";
        return "v2-erc20";
    }, [fromSymbol, toSymbol]);

    // Input decimals
    const inDecimals = useMemo(() => {
        if (fromSymbol === "SEI") return 18;
        if (fromSymbol === "USDC") return USDC_DECIMALS;
        return USDY_DECIMALS;
    }, [fromSymbol]);

    // Amount parsing
    const parsedSei = parseSeiInput(amount);
    const amountIn: bigint | null =
        fromSymbol === "SEI" ? parsedSei.units : toBigIntAmount(amount, inDecimals);

    const amountInNumber =
        fromSymbol === "SEI" ? parsedSei.number : Number(amount.trim().replace(",", ".")) || 0;

    // From-side USD estimate
    const fromUsdValue = useMemo(() => {
        if (amountInNumber <= 0) return null;
        if (fromSymbol === "SEI") return seiUsdPrice !== null ? amountInNumber * seiUsdPrice : null;
        if (fromSymbol === "USDC") return amountInNumber; // assume $1
        return null; // USDY unknown (don’t lie)
    }, [amountInNumber, fromSymbol, seiUsdPrice]);

    // V2 path (only used for v2-* routes)
    const v2Path: Address[] = useMemo(() => {
        if (fromSymbol === "SEI" && toSymbol === "FROG") return [WSEI_ADDRESS as Address, ADDR.token as Address];
        if (fromSymbol === "SEI" && toSymbol === "USDC") return [WSEI_ADDRESS as Address, USDC_ADDRESS as Address];
        if (fromSymbol === "USDY" && toSymbol === "FROG") return [USDY_ADDRESS as Address, ADDR.token as Address];
        return [WSEI_ADDRESS as Address, ADDR.token as Address];
    }, [fromSymbol, toSymbol]);

    // V3 path bytes for USDC->USDY (single hop)
    // Fee per tokens.ts comment: USDC/USDY fee: 100 
    const usdcUsdyV3Path = useMemo(() => {
        if (routeKind !== "v3-erc20") return null;
        try {
            return encodeV3Path({
                tokens: [USDC_ADDRESS as Address, USDY_ADDRESS as Address],
                fees: [100],
            }) as `0x${string}`;
        } catch {
            return null;
        }
    }, [routeKind]);

    // Output decimals
    const outDecimals = useMemo(() => {
        if (toSymbol === "FROG") return FROG_DECIMALS;
        if (toSymbol === "USDC") return USDC_DECIMALS;
        return USDY_DECIMALS;
    }, [toSymbol]);

    // Quote gating (do NOT run both)
    const v2Enabled = routeKind === "v2-native" || routeKind === "v2-erc20";
    const v3Enabled = routeKind === "v3-erc20" && !!usdcUsdyV3Path;

    const v2Quote = useSwapQuote({
        routerAddress: DRAGON_ROUTER_ADDRESS as Address,
        routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
        amountIn: v2Enabled ? amountIn : null,
        path: v2Path,
        decimals: outDecimals,
        slippageBps: 200,
    });

    const v3Quote = useSwapQuoteV3({
        quoterAddress: DRAGON_V3_QUOTER as Address,
        pathBytes: (usdcUsdyV3Path ?? "0x") as `0x${string}`,
        amountIn: v3Enabled ? amountIn : null,
        outDecimals: outDecimals,
        slippageBps: 200,
    });

    const quote = useMemo(() => {
        if (routeKind === "v3-erc20") return v3Quote;
        if (routeKind === "v2-native" || routeKind === "v2-erc20") return v2Quote;
        return {
            isLoading: false,
            isError: false,
            errorMessage: undefined as string | undefined,
            outRaw: null as bigint | null,
            outFormatted: null as string | null,
            minOut: null as bigint | null,
        };
    }, [routeKind, v2Quote, v3Quote]);

    // To-side USD estimate (only reliable for FROG and USDC)
    const frogUsdPrice = useTokenUsdPriceFromRouter({
        seiUsdPrice,
        routerAddress: DRAGON_ROUTER_ADDRESS as Address,
        routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
        tokenDecimals: 18,
        seiRoute: [WSEI_ADDRESS as Address, ADDR.token as Address],
    });

    const tokenOutAmount = quote.outFormatted ? Number(quote.outFormatted) : 0;

    const toUsdValue = useMemo(() => {
        if (!quote.outFormatted || tokenOutAmount <= 0) return null;
        if (toSymbol === "FROG") return frogUsdPrice !== null ? tokenOutAmount * frogUsdPrice : null;
        if (toSymbol === "USDC") return tokenOutAmount; // assume $1
        return null;
    }, [frogUsdPrice, quote.outFormatted, tokenOutAmount, toSymbol]);

    // Approval token/spender
    const approvalToken = useMemo(() => {
        if (!amountIn) return null;

        // USDC->USDY is V3, spender = V3 SwapRouter02
        if (routeKind === "v3-erc20" && fromSymbol === "USDC") {
            return {
                symbol: "USDC" as const,
                addr: USDC_ADDRESS as Address,
                spender: DRAGON_V3_SWAPROUTER02 as Address,
            };
        }

        // V2 ERC20 routes spender = V2 router
        if (routeKind === "v2-erc20" && fromSymbol === "USDY") {
            return {
                symbol: "USDY" as const,
                addr: USDY_ADDRESS as Address,
                spender: DRAGON_ROUTER_ADDRESS as Address,
            };
        }

        return null;
    }, [amountIn, routeKind, fromSymbol]);

    const { data: allowanceData } = useReadContract({
        address: approvalToken?.addr,
        abi: ERC20_MIN_ABI as unknown as Abi,
        functionName: "allowance",
        args: approvalToken && address ? [address as Address, approvalToken.spender] : undefined,
        query: {
            enabled: !!approvalToken && !!address,
            staleTime: 10_000,
            gcTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    }) as unknown as { data?: bigint };

    const allowance = allowanceData ?? 0n;
    const isApproved = !approvalToken || !amountIn ? true : allowance >= amountIn;

    const { writeContractAsync, data: txHash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isTxConfirmed } =
        useWaitForTransactionReceipt({ hash: txHash as `0x${string}` | undefined });

    useEffect(() => {
        if (!isTxConfirmed || !txHash) return;
        const id = requestAnimationFrame(() => {
            setTxForToast(txHash as `0x${string}`);
            setShowSuccessToast(true);
        });
        return () => cancelAnimationFrame(id);
    }, [isTxConfirmed, txHash]);

    const approveIfNeeded = useCallback(async () => {
        if (!approvalToken || !address) return;
        try {
            setErrorToastMessage(undefined);
            await writeContractAsync({
                address: approvalToken.addr,
                abi: ERC20_MIN_ABI as unknown as Abi,
                functionName: "approve",
                args: [approvalToken.spender, maxUint256],
            });
        } catch (err: unknown) {
            pushError(errToMessage(err, "Approval was rejected or failed."));
        }
    }, [approvalToken, address, pushError, writeContractAsync]);

    const executeSwap = useCallback(async () => {
        if (!mounted || !address || wrongNetwork) return;
        if (!amountIn) return;

        if (routeKind === "unsupported") {
            pushError("That route isn’t supported.");
            return;
        }

        if ((routeKind === "v2-erc20" || routeKind === "v3-erc20") && !isApproved) {
            await approveIfNeeded();
            return;
        }

        if (!quote.minOut) {
            pushError(quote.errorMessage || "No quote available for this amount.");
            return;
        }

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

        try {
            setErrorToastMessage(undefined);

            if (routeKind === "v2-native") {
                await writeContractAsync({
                    address: DRAGON_ROUTER_ADDRESS as Address,
                    abi: DRAGON_ROUTER_ABI as unknown as Abi,
                    functionName: "swapExactSEIForTokens",
                    args: [quote.minOut, v2Path, address as Address, deadline],
                    value: amountIn,
                });
                return;
            }

            if (routeKind === "v2-erc20") {
                await writeContractAsync({
                    address: DRAGON_ROUTER_ADDRESS as Address,
                    abi: DRAGON_ROUTER_ABI as unknown as Abi,
                    functionName: "swapExactTokensForTokens",
                    args: [amountIn, quote.minOut, v2Path, address as Address, deadline],
                });
                return;
            }

            if (routeKind === "v3-erc20") {
                if (!usdcUsdyV3Path) {
                    pushError("Route not configured.");
                    return;
                }

                const gasPrice = publicClient ? await publicClient.getGasPrice() : undefined;

                await writeContractAsync({
                    address: DRAGON_V3_SWAPROUTER02 as Address,
                    abi: V3_SWAPROUTER02_ABI as unknown as Abi,
                    functionName: "exactInput",
                    args: [
                        {
                            path: usdcUsdyV3Path,
                            recipient: address as Address,
                            deadline,
                            amountIn,
                            amountOutMinimum: quote.minOut,
                        },
                    ],
                    value: 0n,
                    gas: 900000n,
                    ...(gasPrice ? { gasPrice } : {}),
                });

                return;
            }
        } catch (err: unknown) {
            pushError(errToMessage(err, "Transaction was rejected or failed."));
        }
    }, [
        mounted,
        address,
        wrongNetwork,
        amountIn,
        routeKind,
        isApproved,
        approveIfNeeded,
        quote.minOut,
        quote.errorMessage,
        v2Path,
        usdcUsdyV3Path,
        writeContractAsync,
        pushError,
        publicClient,
    ]);

    const swapDisabled =
        !mounted ||
        !hasAddress ||
        wrongNetwork ||
        routeKind === "unsupported" ||
        !amountIn ||
        quote.isLoading ||
        isPending ||
        isConfirming ||
        !quote.minOut ||
        (routeKind === "v3-erc20" && !usdcUsdyV3Path);

    const primaryLabel = useMemo(() => {
        if (!mounted) return "Loading…";
        if (!hasAddress) return "Connect wallet to swap";
        if (wrongNetwork) return "Switch to Sei EVM";
        if (routeKind === "unsupported") return "Route not supported";
        if (!amountIn) return "Enter amount";
        if (quote.isLoading) return "Fetching quote…";
        if ((routeKind === "v2-erc20" || routeKind === "v3-erc20") && !isApproved && approvalToken) {
            return `Approve ${approvalToken.symbol}`;
        }
        if (isPending || isConfirming) return "Processing…";
        return "Swap now";
    }, [
        mounted,
        hasAddress,
        wrongNetwork,
        routeKind,
        amountIn,
        quote.isLoading,
        isApproved,
        approvalToken,
        isPending,
        isConfirming,
    ]);

    useEffect(() => {
        if (isSupportedPair(fromSymbol, toSymbol)) return;
        if (fromSymbol === "SEI") setToSymbol("FROG");
        else if (fromSymbol === "USDC") setToSymbol("USDY");
        else setToSymbol("FROG");
    }, [fromSymbol, toSymbol]);

    const helpLine = useMemo(() => {
        if (routeKind === "v3-erc20") return "USDC → USDY routes via DragonSwap V3.";
        if (routeKind === "v2-erc20" && approvalToken) return `${approvalToken.symbol} swaps require a one-time approval.`;
        return "Swaps route through Sei EVM.";
    }, [routeKind, approvalToken]);

    const panelHeight = "h-[clamp(540px,70vh,680px)] min-h-[520px]";

    return (
        <section className="mx-auto max-w-6xl px-4 pb-14">
            <h2 className="text-2xl md:text-3xl font-bold">Swap</h2>
            <p className="mt-2 text-slate-300/90 text-sm leading-snug">Swap tokens directly from the dApp.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1.15fr] md:items-stretch">
                {/* Left: chart */}
                <div className={`rounded-2xl overflow-hidden border border-white/10 bg-brand-card ${panelHeight} flex flex-col`}>
                    <iframe
                        title="Price chart on GeckoTerminal"
                        src={URL.dexEmbed}
                        className="w-full flex-1"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        sandbox="allow-same-origin allow-scripts allow-popups"
                    />
                    <div className="border-t border-white/10 bg-black/20 backdrop-blur px-3 py-2 flex items-center gap-2">
                        <div className="text-xs text-brand-subtle">Pair</div>
                        <code className="text-[11px] font-mono select-all truncate max-w-[40ch]">{ADDR.pair}</code>
                        <div className="ml-auto flex items-center gap-2">
                            <CopyButton value={ADDR.pair} label="pair address" />
                            <a href={URL.pairExplorer} className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5" target="_blank" rel="noreferrer">
                                Explorer ↗
                            </a>
                            <a href={URL.dexFull} className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5" target="_blank" rel="noreferrer">
                                Full chart ↗
                            </a>
                        </div>
                    </div>
                </div>

                {/* Right: swap card */}
                <div id="swap" className={`rounded-2xl border border-white/10 bg-brand-card p-5 flex flex-col ${panelHeight} overflow-hidden`}>
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-sm text-brand-subtle">Quick Action</div>
                            <h3 className="mt-1 text-lg font-semibold truncate">
                                {fromSymbol} → {toSymbol}
                            </h3>
                            <p className="mt-1 text-xs text-brand-subtle">{helpLine}</p>
                        </div>
                        <Image src="/froggy-cape.png" width={88} height={88} className="rounded-full shrink-0" alt="Froggy icon" />
                    </div>

                    <div className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-4" style={{ scrollbarGutter: "stable" }}>
                        <div className="space-y-4 min-w-0">
                            {/* From / To selectors */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2 min-w-0">
                                    <label className="text-xs text-brand-subtle">Have</label>
                                    <select
                                        value={fromSymbol}
                                        onChange={(e) => setFromSymbol(e.currentTarget.value as FromSymbol)}
                                        className="h-11 w-full rounded-xl bg-black/20 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                                    >
                                        <option value="SEI">SEI</option>
                                        <option value="USDC">USDC</option>
                                        <option value="USDY">USDY</option>
                                    </select>
                                </div>

                                <div className="grid gap-2 min-w-0">
                                    <label className="text-xs text-brand-subtle">Desired Token</label>
                                    <select
                                        value={toSymbol}
                                        onChange={(e) => setToSymbol(e.currentTarget.value as ToSymbol)}
                                        className="h-11 w-full rounded-xl bg-black/20 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                                    >
                                        {fromSymbol === "SEI" && (
                                            <>
                                                <option value="FROG">FROG</option>
                                                <option value="USDC">USDC</option>
                                            </>
                                        )}
                                        {fromSymbol === "USDC" && <option value="USDY">USDY</option>}
                                        {fromSymbol === "USDY" && <option value="FROG">FROG</option>}
                                    </select>
                                </div>
                            </div>

                            {/* Amount input */}
                            <div className="grid gap-2 min-w-0">
                                <div className="flex items-center justify-between text-xs text-brand-subtle">
                                    <span>Amount</span>
                                    <span className="font-mono text-brand-text">{fromSymbol === "SEI" ? "SEI (native)" : fromSymbol}</span>
                                </div>

                                <input
                                    inputMode="decimal"
                                    placeholder="0.0"
                                    className="h-11 w-full box-border rounded-xl bg-black/20 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value.trim())}
                                />

                                <div className="flex items-center justify-between text-[11px] text-brand-subtle min-w-0">
                                    <span className="truncate">Enter amount to swap.</span>
                                    {fromUsdValue !== null && formatUsd(fromUsdValue) && (
                                        <span className="font-mono text-xs text-brand-text shrink-0">≈ {formatUsd(fromUsdValue)}</span>
                                    )}
                                </div>
                            </div>

                            {/* Output */}
                            <div className="grid gap-1 min-w-0">
                                <label className="text-xs text-brand-subtle">Estimated output</label>
                                <button type="button" className="h-11 w-full rounded-xl bg-black/20 text-left px-3 text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                                    {quote.outFormatted ? `${quote.outFormatted.slice(0, 14)} ${toSymbol}` : `0.0 ${toSymbol}`}
                                </button>

                                <div className="flex items-center justify-between text-[11px] text-brand-subtle min-w-0">
                                    <span className="truncate">
                                        {!amountIn ? (
                                            <>Output depends on price and fees.</>
                                        ) : quote.isLoading ? (
                                            <>Fetching quote…</>
                                        ) : quote.outFormatted ? (
                                            <>Estimated output with slippage protection.</>
                                        ) : (
                                            <>No quote available{quote.errorMessage ? ` (${quote.errorMessage})` : ""}.</>
                                        )}
                                    </span>

                                    {toUsdValue !== null && formatUsd(toUsdValue) && (
                                        <span className="font-mono text-xs text-brand-text shrink-0">≈ {formatUsd(toUsdValue)}</span>
                                    )}
                                </div>
                            </div>

                            {/* Approval hint */}
                            {approvalToken && (
                                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-brand-subtle">
                                    <span className="font-semibold text-brand-text">{isApproved ? "Approved" : "Approval required"}</span>
                                    {" — "}
                                    {approvalToken.symbol} allowance to <span className="font-mono">{approvalToken.spender.slice(0, 8)}…</span>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={executeSwap}
                                disabled={swapDisabled}
                                className={`h-11 w-full rounded-2xl text-sm font-semibold transition-transform duration-150 ${swapDisabled ? "cursor-not-allowed bg-brand-subtle/30 text-brand-subtle" : "bg-brand-primary text-black hover:scale-[1.01]"
                                    }`}
                            >
                                {primaryLabel}
                            </button>

                            <div className="border-t border-white/10 pt-3" />
                            <LiveStats />
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <a href={URL.tokenExplorer} className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5" target="_blank" rel="noreferrer">
                            View on Seitrace
                        </a>
                        <a href={URL.dexFull} className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5" target="_blank" rel="noreferrer">
                            View full chart
                        </a>
                    </div>
                </div>
            </div>

            <SwapSuccessToast open={showSuccessToast} onClose={() => setShowSuccessToast(false)} txHash={txForToast} />

            <SwapErrorToast
                open={showErrorToast}
                onClose={() => {
                    setShowErrorToast(false);
                    setErrorToastMessage(undefined);
                }}
                errorMessage={errorToastMessage}
            />
        </section>
    );
}