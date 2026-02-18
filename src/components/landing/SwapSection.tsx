// src/components/landing/SwapSection.tsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
    type Address,
    type Abi,
    parseUnits,
    formatUnits,
    createPublicClient,
    http,
    maxUint256,
} from "viem";
import {
    useAccount,
    useChainId,
    useWaitForTransactionReceipt,
    useWriteContract,
    useSwitchChain,
    useReadContract,
    useBalance,
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
    ERC20_ABI,
    USDY_ADDRESS,
    DRG_TOKEN_ADDRESS,
} from "@/lib/froggyConfig";

import {
    SwapSuccessToast,
    type ToSymbol,
} from "@/components/ui/SwapSuccessToast";
import { SwapErrorToast } from "@/components/ui/SwapErrorToast";

import { parseSeiInput } from "@/lib/swap/parseSeiInput";
import { useSeiUsdPrice } from "@/lib/swap/hooks/useSeiUsdPrice";
import { useSwapQuote } from "@/lib/swap/hooks/useSwapQuote";
import { useTokenUsdPriceFromRouter } from "@/lib/swap/hooks/useTokenUsdPriceFromRouter";

import { useSwapRouting } from "@/lib/swap/useSwapRouting";
import { getDecimals, type FromSymbol } from "@/lib/swap/types";

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

function formatUsd(value: number) {
    if (!Number.isFinite(value)) return null;
    const opts =
        value >= 1
            ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            : { minimumFractionDigits: 2, maximumFractionDigits: 4 };
    return `$${value.toLocaleString(undefined, opts)}`;
}

// Clamp to maxDecimals but keep the string safe for inputs
function clampDecimals(value: string, maxDecimals: number) {
    if (!value.includes(".")) return value;
    const [i, d] = value.split(".");
    const dd = (d ?? "").slice(0, maxDecimals);
    return dd.length ? `${i}.${dd}` : i;
}

// Display helper: 4dp for >=1, 6dp for <1 (clean DeFi style)
function formatTokenDisplay(raw: bigint | null | undefined, decimals: number) {
    if (raw === null || raw === undefined) return null;
    const full = formatUnits(raw, decimals);
    const n = Number(full);
    if (!Number.isFinite(n)) return clampDecimals(full, 6);
    const max = Math.abs(n) >= 1 ? 4 : 6;
    return clampDecimals(full, max);
}

// Output display: cap at 6 decimals (prevents huge noise)
function formatOutDisplay(outFormatted: string | null | undefined) {
    if (!outFormatted) return null;
    return clampDecimals(outFormatted, 6);
}

export function SwapSection() {
    const [amount, setAmount] = useState("");
    const [fromSymbol, setFromSymbol] = useState<FromSymbol>("SEI");
    const [toSymbol, setToSymbol] = useState<ToSymbol>("FROG");

    // Default: approve max. Toggle on => approve exact amount.
    const [approveExact, setApproveExact] = useState(false);

    // Reset approve mode when switching input token (simple, predictable UX)
    useEffect(() => {
        setApproveExact(false);
    }, [fromSymbol]);

    // Hydration-safe mount gate
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    // Wallet / chain
    const { address, chainId: accountChainId } = useAccount();
    const appChainId = useChainId();
    const { switchChainAsync } = useSwitchChain();

    const hasAddress = mounted && !!address;

    // Use wallet chain when connected; fall back to app chain when not connected
    const effectiveChainId = hasAddress ? accountChainId : appChainId;

    const networkReady = mounted && effectiveChainId !== undefined;
    const isSeiEvm = mounted && effectiveChainId === SEI_EVM_CHAIN_ID;

    const wrongNetwork = hasAddress && networkReady && !isSeiEvm;
    const networkUnknown = hasAddress && !networkReady;

    // Gate reads/writes
    const canReadOnSei = mounted && isSeiEvm;
    const canWriteOnSei = mounted && hasAddress && isSeiEvm;

    // Toasts
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [txForToast, setTxForToast] = useState<`0x${string}` | undefined>();
    const lastToastedHashRef = useRef<string | null>(null);

    const [showErrorToast, setShowErrorToast] = useState(false);
    const [errorToastMessage, setErrorToastMessage] = useState<
        string | undefined
    >();

    const pushError = useCallback((msg: string) => {
        setErrorToastMessage(msg);
        setShowErrorToast(true);
    }, []);

    // Clear stale error toast when user edits inputs (simple + deterministic)
    useEffect(() => {
        if (!showErrorToast) return;
        setShowErrorToast(false);
        setErrorToastMessage(undefined);
    }, [amount, toSymbol, fromSymbol, showErrorToast]);

    // Routing extracted to hook
    const { allowedToSymbols, path: v2Path, outDecimals } = useSwapRouting(
        fromSymbol,
        toSymbol
    );

    // If From/allowed list changes and To becomes invalid, snap To to first allowed option
    useEffect(() => {
        if (!allowedToSymbols.includes(toSymbol))
            setToSymbol(allowedToSymbols[0]);
    }, [allowedToSymbols, toSymbol]);

    // Prices
    const seiUsdPrice = useSeiUsdPrice(30_000);

    // Token USD prices (router-derived)
    const frogUsdPrice = useTokenUsdPriceFromRouter({
        seiUsdPrice: canReadOnSei ? seiUsdPrice : null,
        routerAddress: DRAGON_ROUTER_ADDRESS as Address,
        routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
        tokenDecimals: getDecimals("FROG"),
        seiRoute: [WSEI_ADDRESS as Address, ADDR.token as Address],
    });

    const usdyUsdPrice = useTokenUsdPriceFromRouter({
        seiUsdPrice: canReadOnSei ? seiUsdPrice : null,
        routerAddress: DRAGON_ROUTER_ADDRESS as Address,
        routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
        tokenDecimals: getDecimals("USDY"),
        seiRoute: [
            WSEI_ADDRESS as Address,
            ADDR.token as Address,
            USDY_ADDRESS as Address,
        ],
    });

    const drgUsdPrice = useTokenUsdPriceFromRouter({
        seiUsdPrice: canReadOnSei ? seiUsdPrice : null,
        routerAddress: DRAGON_ROUTER_ADDRESS as Address,
        routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
        tokenDecimals: getDecimals("DRG"),
        seiRoute: [WSEI_ADDRESS as Address, DRG_TOKEN_ADDRESS as Address],
    });

    // Amount parsing
    const parsedSei = parseSeiInput(amount);

    const amountInNumber = useMemo(() => {
        if (fromSymbol === "SEI") return parsedSei.number;
        const n = Number(amount);
        return Number.isFinite(n) ? n : 0;
    }, [amount, fromSymbol, parsedSei.number]);

    const amountInRaw: bigint | null = useMemo(() => {
        if (!amount || amount.trim() === "") return null;

        if (fromSymbol === "SEI") return parsedSei.units;

        try {
            if (!/^\d*\.?\d*$/.test(amount)) return null;

            if (fromSymbol === "USDY") {
                const units = parseUnits(
                    amount as `${string}`,
                    getDecimals("USDY")
                );
                return units > 0n ? units : null;
            }

            // DRG
            const units = parseUnits(amount as `${string}`, getDecimals("DRG"));
            return units > 0n ? units : null;
        } catch {
            return null;
        }
    }, [amount, fromSymbol, parsedSei.units]);

    // From-side USD estimate
    const fromUsdValue = useMemo(() => {
        if (amountInNumber <= 0) return null;

        if (fromSymbol === "SEI") {
            return seiUsdPrice !== null ? amountInNumber * seiUsdPrice : null;
        }

        if (fromSymbol === "USDY") {
            return usdyUsdPrice !== null
                ? amountInNumber * usdyUsdPrice
                : null;
        }

        return drgUsdPrice !== null ? amountInNumber * drgUsdPrice : null;
    }, [amountInNumber, fromSymbol, seiUsdPrice, usdyUsdPrice, drgUsdPrice]);

    // Quote gating: only request quote on Sei and with a valid amount
    const quote = useSwapQuote({
        routerAddress: DRAGON_ROUTER_ADDRESS as Address,
        routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
        amountIn: canReadOnSei ? amountInRaw : null,
        path: v2Path,
        decimals: outDecimals,
        slippageBps: 200,
    });

    // To-side USD estimate
    const tokenOutAmount = quote.outFormatted
        ? parseFloat(quote.outFormatted)
        : 0;

    const toUsdValue = useMemo(() => {
        if (
            !quote.outFormatted ||
            !Number.isFinite(tokenOutAmount) ||
            tokenOutAmount <= 0
        )
            return null;

        if (toSymbol === "USDC") return tokenOutAmount;
        if (toSymbol === "USDY")
            return usdyUsdPrice !== null
                ? tokenOutAmount * usdyUsdPrice
                : null;
        if (toSymbol === "SEI")
            return seiUsdPrice !== null ? tokenOutAmount * seiUsdPrice : null;
        if (toSymbol === "DRG")
            return drgUsdPrice !== null ? tokenOutAmount * drgUsdPrice : null;

        return frogUsdPrice !== null ? tokenOutAmount * frogUsdPrice : null;
    }, [
        frogUsdPrice,
        usdyUsdPrice,
        seiUsdPrice,
        drgUsdPrice,
        quote.outFormatted,
        tokenOutAmount,
        toSymbol,
    ]);

    // ========= Balances + Max =========

    const { data: seiBalance, refetch: refetchSeiBalance } = useBalance({
        address,
        query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
    });

    const { data: usdyBalanceRaw, refetch: refetchUsdyBalance } =
        useReadContract({
            address: USDY_ADDRESS as Address,
            abi: ERC20_ABI as unknown as Abi,
            functionName: "balanceOf",
            args: [address as Address],
            query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
        });

    const { data: drgBalanceRaw, refetch: refetchDrgBalance } =
        useReadContract({
            address: DRG_TOKEN_ADDRESS as Address,
            abi: ERC20_ABI as unknown as Abi,
            functionName: "balanceOf",
            args: [address as Address],
            query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
        });

    const SEI_GAS_BUFFER_RAW = useMemo(() => parseUnits("0.01", 18), []);

    const fromBalanceRaw = useMemo<bigint | null>(() => {
        if (!hasAddress || !canReadOnSei) return null;

        if (fromSymbol === "SEI") {
            const raw = seiBalance?.value;
            if (typeof raw !== "bigint") return null;
            const spendable =
                raw > SEI_GAS_BUFFER_RAW ? raw - SEI_GAS_BUFFER_RAW : 0n;
            return spendable;
        }

        if (fromSymbol === "USDY") {
            return typeof usdyBalanceRaw === "bigint" ? usdyBalanceRaw : null;
        }

        return typeof drgBalanceRaw === "bigint" ? drgBalanceRaw : null;
    }, [
        hasAddress,
        canReadOnSei,
        fromSymbol,
        seiBalance?.value,
        usdyBalanceRaw,
        drgBalanceRaw,
        SEI_GAS_BUFFER_RAW,
    ]);

    const fromBalanceDisplay = useMemo(() => {
        if (fromBalanceRaw === null) return null;
        const decimals =
            fromSymbol === "SEI"
                ? 18
                : fromSymbol === "USDY"
                    ? getDecimals("USDY")
                    : getDecimals("DRG");
        return formatTokenDisplay(fromBalanceRaw, decimals);
    }, [fromBalanceRaw, fromSymbol]);

    const insufficientBalance = useMemo(() => {
        if (!amountInRaw) return false;
        if (fromBalanceRaw === null) return false;
        return amountInRaw > fromBalanceRaw;
    }, [amountInRaw, fromBalanceRaw]);

    const handleMax = useCallback(() => {
        if (fromBalanceRaw === null) return;

        const decimals =
            fromSymbol === "SEI"
                ? 18
                : fromSymbol === "USDY"
                    ? getDecimals("USDY")
                    : getDecimals("DRG");

        const full = formatUnits(fromBalanceRaw, decimals);
        setAmount(clampDecimals(full, 6));
    }, [fromBalanceRaw, fromSymbol]);

    // ========= Allowances =========

    const { data: usdyAllowance, refetch: refetchUsdyAllowance } =
        useReadContract({
            address: USDY_ADDRESS as Address,
            abi: ERC20_ABI as unknown as Abi,
            functionName: "allowance",
            args: [address as Address, DRAGON_ROUTER_ADDRESS as Address],
            query: {
                enabled: !!address && canReadOnSei && fromSymbol === "USDY",
                staleTime: 5_000,
            },
        });

    const { data: drgAllowance, refetch: refetchDrgAllowance } =
        useReadContract({
            address: DRG_TOKEN_ADDRESS as Address,
            abi: ERC20_ABI as unknown as Abi,
            functionName: "allowance",
            args: [address as Address, DRAGON_ROUTER_ADDRESS as Address],
            query: {
                enabled: !!address && canReadOnSei && fromSymbol === "DRG",
                staleTime: 5_000,
            },
        });

    const [isApproving, setIsApproving] = useState(false);

    const { writeContractAsync, data: txHash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isTxConfirmed } =
        useWaitForTransactionReceipt({
            hash: txHash as `0x${string}` | undefined,
        });

    // Refresh balances/allowances on confirmed tx (approval or swap)
    useEffect(() => {
        if (!isTxConfirmed) return;
        void refetchSeiBalance();
        void refetchUsdyBalance();
        void refetchDrgBalance();
        void refetchUsdyAllowance();
        void refetchDrgAllowance();
    }, [
        isTxConfirmed,
        refetchSeiBalance,
        refetchUsdyBalance,
        refetchDrgBalance,
        refetchUsdyAllowance,
        refetchDrgAllowance,
    ]);

    // Success toast (only once per tx hash)
    useEffect(() => {
        if (!isTxConfirmed || !txHash) return;
        if (lastToastedHashRef.current === txHash) return;

        lastToastedHashRef.current = txHash;

        const id = requestAnimationFrame(() => {
            setTxForToast(txHash as `0x${string}`);
            setShowSuccessToast(true);
        });
        return () => cancelAnimationFrame(id);
    }, [isTxConfirmed, txHash]);

    // viem public client (used only to wait for approval receipt when needed)
    const publicClient = useMemo(() => {
        return createPublicClient({
            chain: {
                id: SEI_EVM_CHAIN_ID,
                name: "Sei EVM",
                nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
                rpcUrls: { default: { http: ["https://evm-rpc.sei-apis.com"] } },
            },
            transport: http(),
        });
    }, []);

    const executeSwap = useCallback(async () => {
        if (!canWriteOnSei || !address) {
            pushError("Wrong network. Switch your wallet to Sei EVM (chain 1329).");
            return;
        }

        if (!amountInRaw) {
            pushError("Enter a valid amount.");
            return;
        }

        if (insufficientBalance) {
            pushError("Insufficient balance for this amount.");
            return;
        }

        if (!quote.minOut) {
            pushError(quote.errorMessage || "No quote available for this amount.");
            return;
        }

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

        try {
            setErrorToastMessage(undefined);

            if (fromSymbol === "SEI") {
                await writeContractAsync({
                    chainId: SEI_EVM_CHAIN_ID,
                    address: DRAGON_ROUTER_ADDRESS as Address,
                    abi: DRAGON_ROUTER_ABI as unknown as Abi,
                    functionName: "swapExactSEIForTokens",
                    args: [quote.minOut, v2Path, address as Address, deadline],
                    value: amountInRaw,
                });
                return;
            }

            const tokenIn =
                fromSymbol === "USDY"
                    ? (USDY_ADDRESS as Address)
                    : (DRG_TOKEN_ADDRESS as Address);

            const currentAllowance =
                fromSymbol === "USDY"
                    ? typeof usdyAllowance === "bigint"
                        ? usdyAllowance
                        : 0n
                    : typeof drgAllowance === "bigint"
                        ? drgAllowance
                        : 0n;

            if (currentAllowance < amountInRaw) {
                setIsApproving(true);

                const approvalAmount = approveExact ? amountInRaw : maxUint256;

                try {
                    // Some ERC20s require approve(0) before approve(non-zero)
                    if (currentAllowance > 0n && approvalAmount !== 0n) {
                        const zeroHash = await writeContractAsync({
                            chainId: SEI_EVM_CHAIN_ID,
                            address: tokenIn,
                            abi: ERC20_ABI as unknown as Abi,
                            functionName: "approve",
                            args: [DRAGON_ROUTER_ADDRESS as Address, 0n],
                        });

                        await publicClient.waitForTransactionReceipt({
                            hash: zeroHash as `0x${string}`,
                        });
                    }

                    const approvalHash = await writeContractAsync({
                        chainId: SEI_EVM_CHAIN_ID,
                        address: tokenIn,
                        abi: ERC20_ABI as unknown as Abi,
                        functionName: "approve",
                        args: [DRAGON_ROUTER_ADDRESS as Address, approvalAmount],
                    });

                    await publicClient.waitForTransactionReceipt({
                        hash: approvalHash as `0x${string}`,
                    });

                    // Refetch allowance immediately after approval confirms
                    if (fromSymbol === "USDY") await refetchUsdyAllowance();
                    if (fromSymbol === "DRG") await refetchDrgAllowance();
                } finally {
                    setIsApproving(false);
                }
            }

            if (toSymbol === "FROG") {
                await writeContractAsync({
                    chainId: SEI_EVM_CHAIN_ID,
                    address: DRAGON_ROUTER_ADDRESS as Address,
                    abi: DRAGON_ROUTER_ABI as unknown as Abi,
                    functionName: "swapExactTokensForTokens",
                    args: [
                        amountInRaw,
                        quote.minOut,
                        v2Path,
                        address as Address,
                        deadline,
                    ],
                });
                return;
            }

            await writeContractAsync({
                chainId: SEI_EVM_CHAIN_ID,
                address: DRAGON_ROUTER_ADDRESS as Address,
                abi: DRAGON_ROUTER_ABI as unknown as Abi,
                functionName: "swapExactTokensForSEI",
                args: [
                    amountInRaw,
                    quote.minOut,
                    v2Path,
                    address as Address,
                    deadline,
                ],
            });
        } catch (err: unknown) {
            setIsApproving(false);
            pushError(errToMessage(err, "Transaction was rejected or failed."));
        }
    }, [
        canWriteOnSei,
        address,
        amountInRaw,
        quote.minOut,
        quote.errorMessage,
        v2Path,
        writeContractAsync,
        pushError,
        fromSymbol,
        toSymbol,
        usdyAllowance,
        drgAllowance,
        publicClient,
        insufficientBalance,
        approveExact,
        refetchUsdyAllowance,
        refetchDrgAllowance,
    ]);

    const handlePrimaryClick = useCallback(async () => {
        if (!mounted) return;
        if (!hasAddress) return;

        if (networkUnknown) {
            pushError("Wallet network not detected yet. Try again in a moment.");
            return;
        }

        if (wrongNetwork) {
            try {
                await switchChainAsync({ chainId: SEI_EVM_CHAIN_ID });
            } catch (err: unknown) {
                pushError(
                    errToMessage(
                        err,
                        "Failed to switch network. Please switch to Sei EVM in your wallet."
                    )
                );
            }
            return;
        }

        await executeSwap();
    }, [
        mounted,
        hasAddress,
        networkUnknown,
        wrongNetwork,
        switchChainAsync,
        pushError,
        executeSwap,
    ]);

    const swapDisabled =
        !mounted ||
        !hasAddress ||
        networkUnknown ||
        wrongNetwork ||
        !amountInRaw ||
        !canReadOnSei ||
        insufficientBalance ||
        quote.isLoading ||
        isApproving ||
        isPending ||
        isConfirming ||
        !quote.minOut;

    const primaryLabel = useMemo(() => {
        if (!mounted) return "Loading…";
        if (!hasAddress) return "Connect wallet to swap";
        if (networkUnknown) return "Detecting network…";
        if (wrongNetwork) return "Switch to Sei EVM";
        if (!amountInRaw) return "Enter amount";
        if (!canReadOnSei) return "Switch to Sei EVM";
        if (insufficientBalance) return "Insufficient balance";
        if (quote.isLoading) return "Fetching quote…";
        if (isApproving) return "Approving…";
        if (isPending || isConfirming) return "Processing…";
        return "Swap now";
    }, [
        mounted,
        hasAddress,
        networkUnknown,
        wrongNetwork,
        amountInRaw,
        canReadOnSei,
        insufficientBalance,
        quote.isLoading,
        isApproving,
        isPending,
        isConfirming,
    ]);

    const helpLine = "Swaps route through Sei EVM";
    const panelHeight = "h-[clamp(540px,70vh,680px)] min-h-[520px]";

    const outDisplay = useMemo(() => formatOutDisplay(quote.outFormatted), [
        quote.outFormatted,
    ]);

    const showApproveToggle = fromSymbol !== "SEI";

    return (
        <section className="mx-auto max-w-6xl px-4 pb-14">
            <h2 className="text-2xl md:text-3xl font-bold">Swap</h2>
            <p className="mt-2 text-slate-300/90 text-sm leading-snug">
                Swap tokens directly from the dApp.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1.15fr] md:items-stretch">
                {/* Left: chart */}
                <div
                    className={`rounded-2xl overflow-hidden border border-white/10 bg-brand-card ${panelHeight} flex flex-col`}
                >
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
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-sm text-brand-subtle">
                                Quick Action
                            </div>
                            <h3 className="mt-1 text-lg font-semibold truncate">
                                {fromSymbol} → {toSymbol}
                            </h3>
                            <p className="mt-1 text-xs text-brand-subtle">
                                {helpLine}
                            </p>
                        </div>
                        <Image
                            src="/froggy-cape.png"
                            width={88}
                            height={88}
                            className="rounded-full shrink-0"
                            alt="Froggy icon"
                        />
                    </div>

                    <div
                        className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-4"
                        style={{ scrollbarGutter: "stable" }}
                    >
                        <div className="space-y-4 min-w-0">
                            {/* From / To selectors */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* From */}
                                <div className="grid gap-1 min-w-0">
                                    <label className="text-[11px] text-brand-subtle">
                                        Pay With
                                    </label>
                                    <select
                                        value={fromSymbol}
                                        onChange={(e) =>
                                            setFromSymbol(
                                                e.currentTarget.value as FromSymbol
                                            )
                                        }
                                        className="h-9 w-full rounded-lg bg-black/20 px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                                    >
                                        <option value="SEI">SEI</option>
                                        <option value="USDY">USDY</option>
                                        <option value="DRG">DRG</option>
                                    </select>
                                </div>

                                {/* To */}
                                <div className="grid gap-1 min-w-0">
                                    <label className="text-[11px] text-brand-subtle">
                                        Receive
                                    </label>
                                    <select
                                        value={toSymbol}
                                        onChange={(e) =>
                                            setToSymbol(
                                                e.currentTarget.value as ToSymbol
                                            )
                                        }
                                        className="h-9 w-full rounded-lg bg-black/20 px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                                    >
                                        {allowedToSymbols.map((sym) => (
                                            <option key={sym} value={sym}>
                                                {sym}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Amount input */}
                            <div className="grid gap-2 min-w-0">
                                <div className="flex items-center justify-between text-xs text-brand-subtle">
                                    <span>Amount</span>

                                    <div className="flex items-center gap-2 min-w-0">
                                        {fromBalanceDisplay !== null && (
                                            <span className="font-mono text-[11px] text-brand-subtle truncate">
                                                Bal:{" "}
                                                <span className="text-brand-text">
                                                    {fromBalanceDisplay}
                                                </span>
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleMax}
                                            disabled={
                                                fromBalanceRaw === null ||
                                                fromBalanceRaw === 0n
                                            }
                                            className={`text-[10px] leading-none font-semibold uppercase tracking-wide px-1.5 py-[2px] rounded transition-colors duration-150 ${fromBalanceRaw === null ||
                                                    fromBalanceRaw === 0n
                                                    ? "cursor-not-allowed opacity-40"
                                                    : "text-brand-primary/90 hover:text-brand-primary hover:bg-white/5"
                                                }`}
                                            aria-label="Set amount to max"
                                        >
                                            MAX
                                        </button>

                                        <span className="font-mono text-brand-text">
                                            {fromSymbol === "SEI"
                                                ? "SEI"
                                                : fromSymbol === "USDY"
                                                    ? "USDY"
                                                    : "DRG"}
                                        </span>
                                    </div>
                                </div>

                                <input
                                    inputMode="decimal"
                                    placeholder="0.0"
                                    className={`h-11 w-full box-border rounded-xl bg-black/20 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-inset ${insufficientBalance
                                            ? "focus:ring-red-500/30"
                                            : "focus:ring-brand-primary/30"
                                        }`}
                                    value={amount}
                                    onChange={(e) =>
                                        setAmount(e.target.value.trim())
                                    }
                                />

                                <div className="flex items-center justify-between text-[11px] text-brand-subtle min-w-0">
                                    <span className="truncate">
                                        {insufficientBalance
                                            ? "Insufficient balance."
                                            : "Enter amount to swap."}
                                    </span>
                                    {fromUsdValue !== null &&
                                        formatUsd(fromUsdValue) && (
                                            <span className="font-mono text-xs text-brand-text shrink-0">
                                                ≈ {formatUsd(fromUsdValue)}
                                            </span>
                                        )}
                                </div>
                            </div>

                            {/* Output */}
                            <div className="grid gap-1 min-w-0">
                                <label className="text-xs text-brand-subtle">
                                    Estimated output
                                </label>
                                <button
                                    type="button"
                                    className="h-11 w-full rounded-xl bg-black/20 text-left px-3 text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap"
                                >
                                    {outDisplay
                                        ? `${outDisplay} ${toSymbol}`
                                        : `0.0 ${toSymbol}`}
                                </button>

                                <div className="flex items-center justify-between text-[11px] text-brand-subtle min-w-0">
                                    <span className="truncate">
                                        {!amountInRaw ? (
                                            <>Output depends on price and fees.</>
                                        ) : !canReadOnSei ? (
                                            <>Switch to Sei EVM to fetch a quote.</>
                                        ) : quote.isLoading ? (
                                            <>Fetching quote…</>
                                        ) : quote.outFormatted ? (
                                            <>Estimated output with slippage protection.</>
                                        ) : (
                                            <>
                                                No quote available
                                                {quote.errorMessage
                                                    ? ` (${quote.errorMessage})`
                                                    : ""}
                                                .
                                            </>
                                        )}
                                    </span>

                                    {toUsdValue !== null &&
                                        formatUsd(toUsdValue) && (
                                            <span className="font-mono text-xs text-brand-text shrink-0">
                                                ≈ {formatUsd(toUsdValue)}
                                            </span>
                                        )}
                                </div>
                            </div>

                            {/* Approve behavior toggle (only for ERC20 inputs) */}
                            {showApproveToggle && (
                                <label className="flex items-center justify-between gap-3 rounded-xl bg-black/10 border border-white/10 px-3 py-2">
                                    <div className="text-[12px] font-semibold text-brand-text">
                                        Approve exact amount
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setApproveExact((v) => !v)
                                        }
                                        disabled={
                                            isApproving || isPending || isConfirming
                                        }
                                        className={`h-6 w-11 rounded-full border transition-colors ${approveExact
                                                ? "bg-brand-primary/80 border-brand-primary/40"
                                                : "bg-black/20 border-white/10"
                                            } ${isApproving || isPending || isConfirming
                                                ? "opacity-50 cursor-not-allowed"
                                                : ""
                                            }`}
                                        aria-pressed={approveExact}
                                        aria-label="Toggle approve exact amount"
                                    >
                                        <span
                                            className={`block h-5 w-5 rounded-full bg-white transition-transform ${approveExact
                                                    ? "translate-x-5"
                                                    : "translate-x-0.5"
                                                }`}
                                        />
                                    </button>
                                </label>
                            )}

                            <button
                                type="button"
                                onClick={handlePrimaryClick}
                                disabled={swapDisabled}
                                className={`h-11 w-full rounded-2xl text-sm font-semibold transition-transform duration-150 ${swapDisabled
                                        ? "cursor-not-allowed bg-brand-subtle/30 text-brand-subtle"
                                        : "bg-brand-primary text-black hover:scale-[1.01]"
                                    }`}
                            >
                                {primaryLabel}
                            </button>

                            <div className="border-t border-white/10 pt-3" />
                            <LiveStats />
                        </div>
                    </div>
                </div>
            </div>

            <SwapSuccessToast
                open={showSuccessToast}
                onClose={() => setShowSuccessToast(false)}
                txHash={txForToast}
                toSymbol={toSymbol}
            />

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