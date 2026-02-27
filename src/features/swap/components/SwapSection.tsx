// src/features/swap/components/SwapSection.tsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { type Address, type Abi, parseUnits, formatUnits } from "viem";
import { useWriteContract, useReadContract, useBalance, usePublicClient } from "wagmi";

import LiveStats from "@/components/layout/LiveStats";
import { CopyButton } from "@/components/landing/CopyButton";
import {
    ADDR,
    URL,
    SEI_EVM_CHAIN_ID,
    DRAGON_ROUTER_ADDRESS,
    DRAGON_ROUTER_ABI,
    WSEI_ADDRESS,
    ERC20_ABI,
} from "@/lib/chain/froggyConfig";

import { SwapSuccessToast, type ToSymbol } from "@/features/swap/components/SwapSuccessToast";
import { SwapErrorToast } from "@/features/swap/components/SwapErrorToast";
import { ApprovalToast, type ApprovalTokenSymbol } from "@/features/swap/components/ApprovalToast";

import { parseSeiInput } from "@/features/swap/services/parseSeiInput";
import { useSeiUsdPrice } from "@/features/swap/hooks/useSeiUsdPrice";
import { useSwapQuote } from "@/features/swap/hooks/useSwapQuote";
import { useTokenUsdPriceFromRouter } from "@/features/swap/hooks/useTokenUsdPriceFromRouter";
import { useAllowance } from "@/features/swap/hooks/useAllowance";
import { useTxLifecycle } from "@/features/swap/hooks/useTxLifecycle";
import { ensureApproval } from "@/features/swap/services/ensureApproval";

import { computeAllowedToSymbols, useSwapRouting } from "@/features/swap/services/useSwapRouting";
import { requireAddress, getDecimals, type FromSymbol } from "@/lib/tokens/registry";

import { errToMessage } from "@/lib/utils/errors";
import { clampDecimals, formatOutDisplay, formatTokenDisplay, formatUsd } from "@/lib/utils/format";

import { emitBalancesRefresh, onBalancesRefresh } from "@/lib/refresh/balancesRefresh";

import { useSwapGate } from "@/features/swap/hooks/useSwapGate";
import { useSwapForm } from "@/features/swap/hooks/useSwapForm";

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;

    if (typeof err === "object" && err !== null) {
        const maybe = (err as { message?: unknown }).message;
        if (typeof maybe === "string") return maybe;
    }

    return "";
}

function isRequestedBlockYetError(err: unknown) {
    const msg = getErrorMessage(err).toLowerCase();
    return msg.includes("requested block") || msg.includes("requested block yet");
}

async function withRequestedBlockRetry<T>(fn: () => Promise<T>, tries = 2, delayMs = 900): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < tries; i++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (!isRequestedBlockYetError(e) || i === tries - 1) break;
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw lastErr;
}

function allowedToForFrom(from: FromSymbol): ToSymbol[] {
    return computeAllowedToSymbols(from);
}

export function SwapSection() {
    // Gate (same semantics as before)
    const gate = useSwapGate();
    const mounted = gate.mounted;
    const address = gate.address as Address | undefined;
    const hasAddress = mounted && !!address;
    const wrongNetwork = gate.wrongNetwork;
    const networkUnknown = gate.networkUnknown;
    const canReadOnSei = gate.canReadOnSei;
    const canWriteOnSei = gate.canWriteOnSei;

    // Form (symbols/amount/debounce/approveExact reset)
    const form = useSwapForm<FromSymbol, ToSymbol>({
        initialFrom: "SEI" as FromSymbol,
        initialTo: "FROG" as ToSymbol,
        debounceMs: 300,
        getAllowedToSymbols: (from) => allowedToForFrom(from),
    });

    const {
        fromSymbol,
        toSymbol,
        amount,
        debouncedAmount,
        approveExact,
        setFromSymbol,
        setToSymbol,
        setAmount,
        setApproveExact,
    } = form;

    // Single Sei client for all preflight reads/simulations (reduces "RPC roulette")
    const seiPublicClient = usePublicClient({ chainId: SEI_EVM_CHAIN_ID });

    const routerAbi = DRAGON_ROUTER_ABI as unknown as Abi;
    const erc20Abi = ERC20_ABI as unknown as Abi;
    const routerAddress = DRAGON_ROUTER_ADDRESS as Address;

    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [txForToast, setTxForToast] = useState<`0x${string}` | undefined>();
    const [toSymbolForToast, setToSymbolForToast] = useState<ToSymbol>("FROG");

    const [showApprovalToast, setShowApprovalToast] = useState(false);
    const [approvalTxForToast, setApprovalTxForToast] = useState<`0x${string}` | undefined>();
    const [approvalTokenForToast, setApprovalTokenForToast] = useState<ApprovalTokenSymbol>("USDY");

    const lastToastedHashRef = useRef<string | null>(null);

    const txMetaByHashRef = useRef(
        new Map<
            string,
            {
                kind: "approve" | "swap";
                approvalToken?: ApprovalTokenSymbol;
                swapToSymbol?: ToSymbol;
            }
        >()
    );

    const recordTxMeta = useCallback(
        (kind: "approve" | "swap", hash: unknown, meta?: { approvalToken?: ApprovalTokenSymbol; swapToSymbol?: ToSymbol }) => {
            if (typeof hash !== "string") return;
            txMetaByHashRef.current.set(hash, {
                kind,
                approvalToken: meta?.approvalToken,
                swapToSymbol: meta?.swapToSymbol,
            });
        },
        []
    );

    const [showErrorToast, setShowErrorToast] = useState(false);
    const [errorToastMessage, setErrorToastMessage] = useState<string | undefined>();

    const pushError = useCallback((msg: string) => {
        setErrorToastMessage(msg);
        setShowErrorToast(true);
    }, []);

    useEffect(() => {
        if (!showErrorToast) return;
        const t = setTimeout(() => {
            setShowErrorToast(false);
            setErrorToastMessage(undefined);
        }, 5000);
        return () => clearTimeout(t);
    }, [showErrorToast]);

    // Routing remains the source of truth for allowed receive symbols + path
    const { allowedToSymbols, path: v2Path, outDecimals } = useSwapRouting(fromSymbol, toSymbol);

    // Keep `toSymbol` valid against routing truth as well
    useEffect(() => {
        if (!allowedToSymbols.includes(toSymbol)) setToSymbol(allowedToSymbols[0]);
    }, [allowedToSymbols, toSymbol, setToSymbol]);

    const seiUsdPriceQuery = useSeiUsdPrice(30_000);
    const seiUsdPrice = seiUsdPriceQuery.data ?? null;

    const frogUsdPrice = useTokenUsdPriceFromRouter({
        seiUsdPrice: canReadOnSei ? seiUsdPrice : null,
        chainId: SEI_EVM_CHAIN_ID,
        routerAddress,
        routerAbi,
        tokenDecimals: getDecimals("FROG"),
        seiRoute: [WSEI_ADDRESS as Address, requireAddress("FROG")],
    });

    const usdyUsdPrice = useTokenUsdPriceFromRouter({
        seiUsdPrice: canReadOnSei ? seiUsdPrice : null,
        chainId: SEI_EVM_CHAIN_ID,
        routerAddress,
        routerAbi,
        tokenDecimals: getDecimals("USDY"),
        seiRoute: [WSEI_ADDRESS as Address, requireAddress("FROG"), requireAddress("USDY")],
    });

    const drgUsdPrice = useTokenUsdPriceFromRouter({
        seiUsdPrice: canReadOnSei ? seiUsdPrice : null,
        chainId: SEI_EVM_CHAIN_ID,
        routerAddress,
        routerAbi,
        tokenDecimals: getDecimals("DRG"),
        seiRoute: [WSEI_ADDRESS as Address, requireAddress("DRG")],
    });

    const wbtcUsdPrice = useTokenUsdPriceFromRouter({
        seiUsdPrice: canReadOnSei ? seiUsdPrice : null,
        chainId: SEI_EVM_CHAIN_ID,
        routerAddress,
        routerAbi,
        tokenDecimals: getDecimals("WBTC"),
        seiRoute: [WSEI_ADDRESS as Address, requireAddress("FROG"), requireAddress("WBTC")],
    });

    const parsedSei = parseSeiInput(amount);
    const parsedSeiDebounced = parseSeiInput(debouncedAmount);

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

            const units = parseUnits(amount as `${string}`, getDecimals(fromSymbol));
            return units > 0n ? units : null;
        } catch {
            return null;
        }
    }, [amount, fromSymbol, parsedSei.units]);

    const amountInRawForQuote: bigint | null = useMemo(() => {
        if (!debouncedAmount || debouncedAmount.trim() === "") return null;

        if (fromSymbol === "SEI") return parsedSeiDebounced.units;

        try {
            if (!/^\d*\.?\d*$/.test(debouncedAmount)) return null;

            const units = parseUnits(debouncedAmount as `${string}`, getDecimals(fromSymbol));
            return units > 0n ? units : null;
        } catch {
            return null;
        }
    }, [debouncedAmount, fromSymbol, parsedSeiDebounced.units]);

    const quoteInputPending = amount !== debouncedAmount;

    const fromUsdValue = useMemo(() => {
        if (amountInNumber <= 0) return null;
        if (fromSymbol === "SEI") return seiUsdPrice !== null ? amountInNumber * seiUsdPrice : null;
        if (fromSymbol === "WBTC") return wbtcUsdPrice !== null ? amountInNumber * wbtcUsdPrice : null;
        if (fromSymbol === "USDY") return usdyUsdPrice !== null ? amountInNumber * usdyUsdPrice : null;
        if (fromSymbol === "DRG") return drgUsdPrice !== null ? amountInNumber * drgUsdPrice : null;
        return frogUsdPrice !== null ? amountInNumber * frogUsdPrice : null;
    }, [amountInNumber, fromSymbol, seiUsdPrice, wbtcUsdPrice, usdyUsdPrice, drgUsdPrice, frogUsdPrice]);

    const SLIPPAGE_BPS = 200;

    const quote = useSwapQuote({
        routerAddress,
        routerAbi,
        amountIn: canReadOnSei && v2Path.length >= 2 ? amountInRawForQuote : null,
        path: v2Path,
        decimals: outDecimals,
        slippageBps: SLIPPAGE_BPS,
        chainId: SEI_EVM_CHAIN_ID,
    });

    const tokenOutAmount = useMemo(
        () => (quote.outFormatted ? Number(quote.outFormatted) : 0),
        [quote.outFormatted]
    );

    const toUsdValue = useMemo(() => {
        if (!quote.outFormatted || !Number.isFinite(tokenOutAmount) || tokenOutAmount <= 0) return null;

        if (toSymbol === "WBTC") return wbtcUsdPrice !== null ? tokenOutAmount * wbtcUsdPrice : null;
        if (toSymbol === "USDY") return usdyUsdPrice !== null ? tokenOutAmount * usdyUsdPrice : null;
        if (toSymbol === "SEI") return seiUsdPrice !== null ? tokenOutAmount * seiUsdPrice : null;
        if (toSymbol === "DRG") return drgUsdPrice !== null ? tokenOutAmount * drgUsdPrice : null;
        return frogUsdPrice !== null ? tokenOutAmount * frogUsdPrice : null;
    }, [frogUsdPrice, wbtcUsdPrice, usdyUsdPrice, seiUsdPrice, drgUsdPrice, quote.outFormatted, tokenOutAmount, toSymbol]);

    // ========= Balances + Max =========

    const { data: seiBalance, refetch: refetchSeiBalance } = useBalance({
        address,
        chainId: SEI_EVM_CHAIN_ID,
        query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
    });

    const { data: usdyBalanceRaw, refetch: refetchUsdyBalance } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: requireAddress("USDY"),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address as Address] : undefined,
        query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
    });

    const { data: frogBalanceRaw, refetch: refetchFrogBalance } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: requireAddress("FROG"),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address as Address] : undefined,
        query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
    });

    const { data: wbtcBalanceRaw, refetch: refetchWbtcBalance } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: requireAddress("WBTC"),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address as Address] : undefined,
        query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
    });

    const { data: drgBalanceRaw, refetch: refetchDrgBalance } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: requireAddress("DRG"),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address as Address] : undefined,
        query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
    });

    const SEI_GAS_BUFFER_RAW = useMemo(() => parseUnits("0.01", 18), []);

    const fromBalanceRaw = useMemo<bigint | null>(() => {
        if (!hasAddress || !canReadOnSei) return null;

        if (fromSymbol === "SEI") {
            const raw = seiBalance?.value;
            if (typeof raw !== "bigint") return null;
            const spendable = raw > SEI_GAS_BUFFER_RAW ? raw - SEI_GAS_BUFFER_RAW : 0n;
            return spendable;
        }

        if (fromSymbol === "USDY") return typeof usdyBalanceRaw === "bigint" ? usdyBalanceRaw : null;
        if (fromSymbol === "DRG") return typeof drgBalanceRaw === "bigint" ? drgBalanceRaw : null;
        if (fromSymbol === "FROG") return typeof frogBalanceRaw === "bigint" ? frogBalanceRaw : null;
        if (fromSymbol === "WBTC") return typeof wbtcBalanceRaw === "bigint" ? wbtcBalanceRaw : null;
        return null;
    }, [hasAddress, canReadOnSei, fromSymbol, seiBalance?.value, usdyBalanceRaw, drgBalanceRaw, frogBalanceRaw, wbtcBalanceRaw, SEI_GAS_BUFFER_RAW]);

    const fromBalanceDisplay = useMemo(() => {
        if (fromBalanceRaw === null) return null;
        const decimals = fromSymbol === "SEI" ? 18 : getDecimals(fromSymbol);
        return formatTokenDisplay(fromBalanceRaw, decimals);
    }, [fromBalanceRaw, fromSymbol]);

    const insufficientBalance = useMemo(() => {
        if (!amountInRaw) return false;
        if (fromBalanceRaw === null) return false;
        return amountInRaw > fromBalanceRaw;
    }, [amountInRaw, fromBalanceRaw]);

    const handleMax = useCallback(() => {
        if (fromBalanceRaw === null) return;
        const decimals = fromSymbol === "SEI" ? 18 : getDecimals(fromSymbol);
        const full = formatUnits(fromBalanceRaw, decimals);
        setAmount(clampDecimals(full, 6));
    }, [fromBalanceRaw, fromSymbol, setAmount]);

    // ========= Allowances =========

    const { allowance: tokenAllowance, refetch: refetchTokenAllowance } = useAllowance({
        token: fromSymbol,
        owner: address as Address | undefined,
        spender: routerAddress,
        enabled: !!address && canReadOnSei && fromSymbol !== "SEI",
        staleTime: 5_000,
        chainId: SEI_EVM_CHAIN_ID,
    });

    const [isApproving, setIsApproving] = useState(false);
    const [isSwapping, setIsSwapping] = useState(false);

    const { writeContractAsync, data: txHash, isPending } = useWriteContract();
    const { isConfirming, isConfirmed: isTxConfirmed } = useTxLifecycle(txHash as `0x${string}` | undefined);

    const txLockRef = useRef(false);
    const refreshSourceRef = useRef<string>("swap");
    useEffect(() => {
        try {
            refreshSourceRef.current = `swap-${crypto.randomUUID()}`;
        } catch {
            refreshSourceRef.current = `swap-${Date.now()}`;
        }
    }, []);

    useEffect(() => {
        if (!mounted) return;

        return onBalancesRefresh((detail) => {
            if (detail?.source && detail.source === refreshSourceRef.current) return;
            void refetchSeiBalance();
            void refetchUsdyBalance();
            void refetchFrogBalance();
            void refetchWbtcBalance();
            void refetchDrgBalance();
        });
    }, [mounted, refetchSeiBalance, refetchUsdyBalance, refetchFrogBalance, refetchWbtcBalance, refetchDrgBalance]);

    useEffect(() => {
        if (!isTxConfirmed) return;

        void refetchSeiBalance();
        void refetchUsdyBalance();
        void refetchFrogBalance();
        void refetchWbtcBalance();
        void refetchDrgBalance();
        void refetchTokenAllowance();

        const hash = txHash as string | undefined;
        if (!hash) return;
        const meta = txMetaByHashRef.current.get(hash);
        if (meta?.kind === "swap") {
            emitBalancesRefresh(refreshSourceRef.current);
        }
    }, [isTxConfirmed, txHash, refetchSeiBalance, refetchUsdyBalance, refetchFrogBalance, refetchWbtcBalance, refetchDrgBalance, refetchTokenAllowance]);

    useEffect(() => {
        if (!isTxConfirmed || !txHash) return;
        if (lastToastedHashRef.current === txHash) return;

        lastToastedHashRef.current = txHash;

        const meta = txMetaByHashRef.current.get(txHash as string);
        const kind = meta?.kind;

        const id = requestAnimationFrame(() => {
            if (kind === "approve") {
                setApprovalTxForToast(txHash as `0x${string}`);
                setApprovalTokenForToast(meta?.approvalToken ?? "USDY");
                setShowApprovalToast(true);
                return;
            }

            if (kind === "swap") {
                setTxForToast(txHash as `0x${string}`);
                setToSymbolForToast(meta?.swapToSymbol ?? toSymbol);
                setShowSuccessToast(true);
            }
        });

        if (typeof txHash === "string") txMetaByHashRef.current.delete(txHash);

        return () => cancelAnimationFrame(id);
    }, [isTxConfirmed, txHash, toSymbol]);

    const executeSwap = useCallback(async () => {
        if (txLockRef.current || isSwapping || isApproving || isPending || isConfirming) return;
        txLockRef.current = true;

        try {
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

            if (quoteInputPending || quote.isStale) {
                pushError("Quote is updating. Try again in a moment.");
                return;
            }

            if (!quote.minOut) {
                pushError(quote.errorMessage || "No quote available for this amount.");
                return;
            }

            if (!v2Path || v2Path.length < 2) {
                pushError("No swap route available for this pair.");
                return;
            }

            if (!seiPublicClient) {
                pushError("Public client not ready yet. Try again in a moment.");
                return;
            }

            const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
            const amountIn = amountInRaw;
            type WriteArgs = Parameters<typeof writeContractAsync>[0];

            const preflightMinOut = async (): Promise<bigint> => {
                const amountsOut = await withRequestedBlockRetry(
                    () =>
                        seiPublicClient.readContract({
                            address: routerAddress,
                            abi: routerAbi,
                            functionName: "getAmountsOut",
                            args: [amountIn, v2Path],
                        }) as Promise<unknown>,
                    2,
                    900
                );

                if (!Array.isArray(amountsOut) || amountsOut.length === 0) {
                    throw new Error("Unable to fetch a fresh quote.");
                }

                const out = amountsOut[amountsOut.length - 1];
                if (typeof out !== "bigint" || out <= 0n) {
                    throw new Error("Unable to fetch a fresh quote.");
                }

                const minOut = (out * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n;
                return minOut > 0n ? minOut : 1n;
            };

            try {
                setIsSwapping(true);
                setErrorToastMessage(undefined);

                if (fromSymbol === "SEI") {
                    if (toSymbol === "SEI") {
                        pushError("Select a different token to receive.");
                        return;
                    }

                    const minOutFresh = await preflightMinOut();

                    const { request } = await withRequestedBlockRetry(
                        () =>
                            seiPublicClient.simulateContract({
                                address: routerAddress,
                                abi: routerAbi,
                                functionName: "swapExactSEIForTokens",
                                args: [minOutFresh, v2Path, address as Address, deadline],
                                account: address as Address,
                                value: amountIn,
                            }),
                        2,
                        900
                    );

                    const h = await writeContractAsync({
                        ...(request as WriteArgs),
                        chainId: SEI_EVM_CHAIN_ID,
                    });
                    recordTxMeta("swap", h, { swapToSymbol: toSymbol });
                    return;
                }

                const tokenIn = requireAddress(fromSymbol);
                const currentAllowance = tokenAllowance ?? 0n;

                if (currentAllowance < amountIn) {
                    setIsApproving(true);
                    try {
                        await withRequestedBlockRetry(
                            () =>
                                ensureApproval({
                                    publicClient: seiPublicClient,
                                    token: tokenIn as Address,
                                    spender: routerAddress,
                                    requiredAmount: amountIn,
                                    currentAllowance,
                                    approveExact,
                                    writeContractAsync: async (args) => {
                                        const h = await writeContractAsync(args);
                                        const approvalToken: ApprovalTokenSymbol = fromSymbol as Exclude<FromSymbol, "SEI">;
                                        recordTxMeta("approve", h, { approvalToken });
                                        return h;
                                    },
                                }),
                            2,
                            900
                        );

                        await refetchTokenAllowance();
                    } finally {
                        setIsApproving(false);
                    }
                }

                if (toSymbol !== "SEI") {
                    const minOutFresh = await preflightMinOut();

                    const { request } = await withRequestedBlockRetry(
                        () =>
                            seiPublicClient.simulateContract({
                                address: routerAddress,
                                abi: routerAbi,
                                functionName: "swapExactTokensForTokens",
                                args: [amountIn, minOutFresh, v2Path, address as Address, deadline],
                                account: address as Address,
                            }),
                        2,
                        900
                    );

                    const h = await writeContractAsync({
                        ...(request as WriteArgs),
                        chainId: SEI_EVM_CHAIN_ID,
                    });
                    recordTxMeta("swap", h, { swapToSymbol: toSymbol });
                    return;
                }

                const minOutFresh = await preflightMinOut();

                const { request } = await withRequestedBlockRetry(
                    () =>
                        seiPublicClient.simulateContract({
                            address: routerAddress,
                            abi: routerAbi,
                            functionName: "swapExactTokensForSEI",
                            args: [amountIn, minOutFresh, v2Path, address as Address, deadline],
                            account: address as Address,
                        }),
                    2,
                    900
                );

                const h = await writeContractAsync({
                    ...(request as WriteArgs),
                    chainId: SEI_EVM_CHAIN_ID,
                });
                recordTxMeta("swap", h, { swapToSymbol: toSymbol });
            } catch (err: unknown) {
                setIsApproving(false);

                if (isRequestedBlockYetError(err)) {
                    pushError("RPC is catching up (requested block not available yet). Try again in a moment.");
                    return;
                }

                pushError(errToMessage(err, "Transaction was rejected or failed."));
            } finally {
                setIsSwapping(false);
            }
        } finally {
            txLockRef.current = false;
        }
    }, [
        canWriteOnSei,
        address,
        amountInRaw,
        insufficientBalance,
        quoteInputPending,
        quote.isStale,
        quote.minOut,
        quote.errorMessage,
        v2Path,
        writeContractAsync,
        pushError,
        fromSymbol,
        toSymbol,
        tokenAllowance,
        approveExact,
        refetchTokenAllowance,
        recordTxMeta,
        seiPublicClient,
        routerAddress,
        routerAbi,
        isSwapping,
        isApproving,
        isPending,
        isConfirming,
        SLIPPAGE_BPS,
    ]);

    const handlePrimaryClick = useCallback(async () => {
        if (!mounted) return;
        if (!hasAddress) return;

        if (txLockRef.current || isSwapping || isApproving || isPending || isConfirming) return;

        if (networkUnknown) {
            pushError("Wallet network not detected yet. Try again in a moment.");
            return;
        }
        if (wrongNetwork) {
            pushError("Wrong network. Switch your wallet to Sei EVM (chain 1329).");
            return;
        }

        await executeSwap();
    }, [mounted, hasAddress, networkUnknown, wrongNetwork, pushError, executeSwap, isSwapping, isApproving, isPending, isConfirming]);

    const swapDisabled =
        !mounted ||
        !hasAddress ||
        networkUnknown ||
        wrongNetwork ||
        !amountInRaw ||
        !canReadOnSei ||
        insufficientBalance ||
        quote.isLoading ||
        quoteInputPending ||
        quote.isStale ||
        isApproving ||
        isSwapping ||
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
        if (quoteInputPending) return "Updating quote…";
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
        quoteInputPending,
        isApproving,
        isPending,
        isConfirming,
    ]);

    const helpLine = "Swaps route through Sei EVM";
    const panelHeight = "h-[clamp(540px,70vh,680px)] min-h-[520px]";
    const outDisplay = useMemo(() => formatOutDisplay(quote.outFormatted), [quote.outFormatted]);

    const showApproveToggle = fromSymbol !== "SEI";

    return (
        <section id="swap" className="scroll-mt-20 mx-auto max-w-6xl px-4 pb-14">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-2xl md:text-3xl font-bold">Swap</h2>
                    <p className="mt-2 text-slate-300/90 text-sm leading-snug">Swap tokens directly from the dApp.</p>
                </div>

                <Image src="/swap.png" width={72} height={72} className="rounded-full shrink-0 opacity-90" alt="Froggy icon" />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1.15fr] md:items-stretch auto-rows-fr">
                {/* Chart (DOM first, but SECOND on mobile) */}
                <div className={`order-2 md:order-1 min-h-0 rounded-2xl overflow-hidden border border-white/10 bg-brand-card ${panelHeight} flex flex-col`}>
                    <iframe
                        title="Price chart on GeckoTerminal"
                        src={URL.dexEmbed}
                        className="w-full flex-1 min-h-0"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        sandbox="allow-same-origin allow-scripts"
                    />
                    <div className="border-t border-white/10 bg-black/20 backdrop-blur px-3 py-2 flex items-center gap-2">
                        <div className="text-xs text-brand-subtle">Pair</div>
                        <code className="text-[11px] font-mono select-all truncate max-w-[40ch]">{ADDR.pair}</code>
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
                            <a href={URL.dexFull} className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5" target="_blank" rel="noreferrer">
                                Full chart ↗
                            </a>
                        </div>
                    </div>
                </div>

                {/* Swap card (DOM second, but FIRST on mobile) */}
                <div className={`order-1 md:order-2 min-h-0 rounded-2xl border border-white/10 bg-brand-card p-5 flex flex-col ${panelHeight} overflow-hidden`}>
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-sm text-brand-subtle">Quick Action</div>
                            <h3 className="mt-1 text-lg font-semibold truncate">
                                {fromSymbol} → {toSymbol}
                            </h3>
                            <p className="mt-1 text-xs text-brand-subtle">{helpLine}</p>
                        </div>
                    </div>

                    <div className="mt-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-4" style={{ scrollbarGutter: "stable" }}>
                        <div className="space-y-4 min-w-0">
                            {/* From / To selectors */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1 min-w-0">
                                    <label className="text-[11px] text-brand-subtle">Pay With</label>
                                    <select
                                        value={fromSymbol}
                                        onChange={(e) => setFromSymbol(e.currentTarget.value as FromSymbol)}
                                        className="h-9 w-full rounded-lg bg-black/20 px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                                    >
                                        <option value="SEI">SEI</option>
                                        <option value="FROG">FROG</option>
                                        <option value="WBTC">WBTC</option>
                                        <option value="USDY">USDY</option>
                                        <option value="DRG">DRG</option>
                                    </select>
                                </div>

                                <div className="grid gap-1 min-w-0">
                                    <label className="text-[11px] text-brand-subtle">Receive</label>
                                    <select
                                        value={toSymbol}
                                        onChange={(e) => setToSymbol(e.currentTarget.value as ToSymbol)}
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
                                                Bal: <span className="text-brand-text">{fromBalanceDisplay}</span>
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleMax}
                                            disabled={fromBalanceRaw === null || fromBalanceRaw === 0n}
                                            className={`text-[10px] leading-none font-semibold uppercase tracking-wide px-1.5 py-[2px] rounded transition-colors duration-150 ${fromBalanceRaw === null || fromBalanceRaw === 0n
                                                    ? "cursor-not-allowed opacity-40"
                                                    : "text-brand-primary/90 hover:text-brand-primary hover:bg-white/5"
                                                }`}
                                            aria-label="Set amount to max"
                                        >
                                            MAX
                                        </button>

                                        <span className="font-mono text-brand-text">{fromSymbol}</span>
                                    </div>
                                </div>

                                <input
                                    inputMode="decimal"
                                    placeholder="0.0"
                                    className={`h-11 w-full box-border rounded-xl bg-black/20 px-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-inset ${insufficientBalance ? "focus:ring-red-500/30" : "focus:ring-brand-primary/30"
                                        }`}
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />

                                <div className="flex items-center justify-between text-[11px] text-brand-subtle min-w-0">
                                    <span className="truncate">{insufficientBalance ? "Insufficient balance." : "Enter amount to swap."}</span>
                                    {fromUsdValue !== null && formatUsd(fromUsdValue) && (
                                        <span className="font-mono text-xs text-brand-text shrink-0">≈ {formatUsd(fromUsdValue)}</span>
                                    )}
                                </div>
                            </div>

                            {/* Output */}
                            <div className="grid gap-1 min-w-0">
                                <label className="text-xs text-brand-subtle">Estimated output</label>

                                <div
                                    className="h-11 w-full rounded-xl bg-black/20 text-left px-3 text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap flex items-center"
                                    role="status"
                                    aria-live="polite"
                                >
                                    {outDisplay ? `${outDisplay} ${toSymbol}` : `0.0 ${toSymbol}`}
                                </div>

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
                                            <>No quote available{quote.errorMessage ? ` (${quote.errorMessage})` : ""}.</>
                                        )}
                                    </span>

                                    {toUsdValue !== null && formatUsd(toUsdValue) && (
                                        <span className="font-mono text-xs text-brand-text shrink-0">≈ {formatUsd(toUsdValue)}</span>
                                    )}
                                </div>
                            </div>

                            {/* Approve behavior toggle */}
                            {showApproveToggle && (
                                <label className="flex items-center justify-between gap-3 rounded-xl bg-black/10 border border-white/10 px-3 py-2">
                                    <div className="text-[12px] font-semibold text-brand-text">Approve exact amount</div>

                                    <button
                                        type="button"
                                        onClick={() => setApproveExact((v) => !v)}
                                        disabled={isApproving || isPending || isConfirming}
                                        className={`h-6 w-11 rounded-full border transition-colors ${approveExact ? "bg-brand-primary/80 border-brand-primary/40" : "bg-black/20 border-white/10"
                                            } ${isApproving || isPending || isConfirming ? "opacity-50 cursor-not-allowed" : ""}`}
                                        aria-pressed={approveExact}
                                        aria-label="Toggle approve exact amount"
                                    >
                                        <span
                                            className={`block h-5 w-5 rounded-full bg-white transition-transform ${approveExact ? "translate-x-5" : "translate-x-0.5"
                                                }`}
                                        />
                                    </button>
                                </label>
                            )}

                            <button
                                type="button"
                                onClick={handlePrimaryClick}
                                disabled={swapDisabled}
                                className={`h-11 w-full rounded-2xl text-sm font-semibold border transition-transform duration-150 ${swapDisabled
                                        ? "cursor-not-allowed bg-black/20 text-white/45 border border-white/10 shadow-none"
                                        : "bg-brand-primary text-black border-brand-primary/30 hover:scale-[1.01] shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
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

            <SwapSuccessToast open={showSuccessToast} onClose={() => setShowSuccessToast(false)} txHash={txForToast} toSymbol={toSymbolForToast} />

            <ApprovalToast open={showApprovalToast} onClose={() => setShowApprovalToast(false)} txHash={approvalTxForToast} tokenSymbol={approvalTokenForToast} />

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