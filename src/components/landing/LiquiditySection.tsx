"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Address, type Abi, type Hex, parseUnits, formatUnits } from "viem";
import {
    useAccount,
    useBalance,
    useChainId,
    usePublicClient,
    useReadContract,
    useWriteContract,
} from "wagmi";

import {
    ADDR,
    SEI_EVM_CHAIN_ID,
    DRAGON_ROUTER_ADDRESS,
    DRAGON_ROUTER_ABI,
    WSEI_ADDRESS,
    ERC20_ABI,
} from "@/lib/froggyConfig";
import { requireAddress, getDecimals } from "@/lib/swap/tokenRegistry";
import { errToMessage } from "@/lib/utils/errors";
import { clampDecimals, formatTokenDisplay } from "@/lib/utils/format";

type PoolKey = "SEI_FROG" | "USDY_FROG";

const PAIR_ABI = [
    {
        type: "function",
        name: "getReserves",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "reserve0", type: "uint112" },
            { name: "reserve1", type: "uint112" },
            { name: "blockTimestampLast", type: "uint32" },
        ],
    },
    { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
    { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const satisfies Abi;

function sanitizeAmountInput(input: string) {
    if (input === "") return "";
    let s = input.replace(/[^\d.]/g, "");

    const firstDot = s.indexOf(".");
    if (firstDot !== -1) {
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    }
    if (s.startsWith(".")) s = `0${s}`;

    const parts = s.split(".");
    let intPart = parts[0] ?? "";
    const fracPart = parts[1];

    if (intPart.length > 1) {
        intPart = intPart.replace(/^0+(?=\d)/, "");
        if (intPart === "") intPart = "0";
    }

    return fracPart !== undefined ? `${intPart}.${fracPart}` : intPart;
}

function formatCompactNumber(n: number, maxFrac = 2) {
    if (!Number.isFinite(n)) return String(n);
    return new Intl.NumberFormat(undefined, {
        notation: "compact",
        maximumFractionDigits: maxFrac,
    }).format(n);
}

function reserveFmt(formatted: string) {
    const v = Number(formatted);
    if (!Number.isFinite(v)) return formatted;
    if (v >= 1_000_000) return formatCompactNumber(v, 1);
    if (v >= 10_000) return formatCompactNumber(v, 2);
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(v);
}

export function LiquiditySection() {
    // Hydration-safe mount gate
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const { address, chainId: accountChainId, isConnected } = useAccount();
    const appChainId = useChainId();

    const hasAddress = mounted && !!address && isConnected;
    const effectiveChainId = hasAddress ? accountChainId : appChainId;

    const networkReady = mounted && effectiveChainId !== undefined;
    const isSeiEvm = mounted && effectiveChainId === SEI_EVM_CHAIN_ID;

    const wrongNetwork = hasAddress && networkReady && !isSeiEvm;
    const canReadOnSei = mounted && isSeiEvm;
    const canWriteOnSei = mounted && hasAddress && isSeiEvm;

    const seiPublicClient = usePublicClient({ chainId: SEI_EVM_CHAIN_ID });
    const { writeContractAsync, isPending } = useWriteContract();

    const routerAddress = DRAGON_ROUTER_ADDRESS as Address;
    const routerAbi = DRAGON_ROUTER_ABI as unknown as Abi;
    const erc20Abi = ERC20_ABI as unknown as Abi;

    const frog = requireAddress("FROG");
    const usdy = requireAddress("USDY");

    const [pool, setPool] = useState<PoolKey>("SEI_FROG");

    const poolMeta = useMemo(() => {
        if (pool === "SEI_FROG") {
            return {
                pair: ADDR.pair as Address,
                tokenA_forReserves: WSEI_ADDRESS as Address,
                tokenB: frog,
                tokenASymbol: "SEI" as const,
                tokenBSymbol: "FROG" as const,
                tokenADecimals: 18,
                tokenBDecimals: getDecimals("FROG"),
                mode: "SEI" as const,
            };
        }

        return {
            pair: ADDR.usdyFrogPair as Address,
            tokenA_forReserves: usdy,
            tokenB: frog,
            tokenASymbol: "USDY" as const,
            tokenBSymbol: "FROG" as const,
            tokenADecimals: getDecimals("USDY"),
            tokenBDecimals: getDecimals("FROG"),
            mode: "ERC20" as const,
        };
    }, [pool, frog, usdy]);

    const [amountA, setAmountA] = useState("");
    const [amountB, setAmountB] = useState("");
    const lastEditedRef = useRef<"A" | "B" | null>(null);

    // Debounce both sides (prevents ping-pong on fast typing)
    const [debouncedA, setDebouncedA] = useState("");
    const [debouncedB, setDebouncedB] = useState("");
    useEffect(() => {
        const t = setTimeout(() => setDebouncedA(amountA), 250);
        return () => clearTimeout(t);
    }, [amountA]);
    useEffect(() => {
        const t = setTimeout(() => setDebouncedB(amountB), 250);
        return () => clearTimeout(t);
    }, [amountB]);

    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!mounted) return;
        if (!hasAddress || wrongNetwork) setError(null);
    }, [mounted, hasAddress, wrongNetwork]);

    // ===== balances =====
    const { data: seiBal, refetch: refetchSeiBal } = useBalance({
        address,
        chainId: SEI_EVM_CHAIN_ID,
        query: { enabled: !!address && canReadOnSei && poolMeta.tokenASymbol === "SEI", staleTime: 5_000 },
    });

    const { data: usdyBalRaw, refetch: refetchUsdyBal } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: usdy,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address as Address] : undefined,
        query: { enabled: !!address && canReadOnSei && poolMeta.tokenASymbol === "USDY", staleTime: 5_000 },
    });

    const { data: frogBalRaw, refetch: refetchFrogBal } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: frog,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address as Address] : undefined,
        query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
    });

    const SEI_GAS_BUFFER_RAW = useMemo(() => parseUnits("0.01", 18), []);

    const tokenABalanceRaw = useMemo<bigint | null>(() => {
        if (!address || !canReadOnSei) return null;
        if (poolMeta.tokenASymbol === "SEI") {
            const raw = seiBal?.value;
            if (typeof raw !== "bigint") return null;
            return raw > SEI_GAS_BUFFER_RAW ? raw - SEI_GAS_BUFFER_RAW : 0n;
        }
        return typeof usdyBalRaw === "bigint" ? usdyBalRaw : null;
    }, [address, canReadOnSei, poolMeta.tokenASymbol, seiBal?.value, usdyBalRaw, SEI_GAS_BUFFER_RAW]);

    const tokenBBalanceRaw = useMemo<bigint | null>(() => {
        if (!address || !canReadOnSei) return null;
        return typeof frogBalRaw === "bigint" ? frogBalRaw : null;
    }, [address, canReadOnSei, frogBalRaw]);

    const tokenABalDisplay = useMemo(() => {
        if (tokenABalanceRaw === null) return null;
        return formatTokenDisplay(tokenABalanceRaw, poolMeta.tokenADecimals);
    }, [tokenABalanceRaw, poolMeta.tokenADecimals]);

    const frogBalDisplay = useMemo(() => {
        if (tokenBBalanceRaw === null) return null;
        return formatTokenDisplay(tokenBBalanceRaw, poolMeta.tokenBDecimals);
    }, [tokenBBalanceRaw, poolMeta.tokenBDecimals]);

    const onMaxA = useCallback(() => {
        if (tokenABalanceRaw === null) return;
        lastEditedRef.current = "A";
        const full = formatUnits(tokenABalanceRaw, poolMeta.tokenADecimals);
        setAmountA(clampDecimals(full, 6));
    }, [tokenABalanceRaw, poolMeta.tokenADecimals]);

    const onMaxFrog = useCallback(() => {
        if (tokenBBalanceRaw === null) return;
        lastEditedRef.current = "B";
        const full = formatUnits(tokenBBalanceRaw, poolMeta.tokenBDecimals);
        setAmountB(clampDecimals(full, 6));
    }, [tokenBBalanceRaw, poolMeta.tokenBDecimals]);

    // ===== reserves =====
    const [reserves, setReserves] = useState<{ reserveA: bigint; reserveB: bigint; ready: boolean }>({
        reserveA: 0n,
        reserveB: 0n,
        ready: false,
    });

    // Manual "tick" to refresh reserves immediately after tx
    const [refreshTick, setRefreshTick] = useState(0);

    useEffect(() => {
        const client = seiPublicClient;
        if (!canReadOnSei || !client) {
            setReserves({ reserveA: 0n, reserveB: 0n, ready: false });
            return;
        }

        let cancelled = false;

        const load = async () => {
            try {
                if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

                const [t0, t1, r] = await Promise.all([
                    client.readContract({ address: poolMeta.pair, abi: PAIR_ABI, functionName: "token0" }) as Promise<Address>,
                    client.readContract({ address: poolMeta.pair, abi: PAIR_ABI, functionName: "token1" }) as Promise<Address>,
                    client.readContract({ address: poolMeta.pair, abi: PAIR_ABI, functionName: "getReserves" }) as Promise<
                        [bigint, bigint, number]
                    >,
                ]);

                if (cancelled) return;

                const reserve0 = r[0];
                const reserve1 = r[1];

                const a = poolMeta.tokenA_forReserves.toLowerCase();
                const b = poolMeta.tokenB.toLowerCase();

                let reserveA = 0n;
                let reserveB = 0n;

                if (t0.toLowerCase() === a && t1.toLowerCase() === b) {
                    reserveA = reserve0;
                    reserveB = reserve1;
                } else if (t0.toLowerCase() === b && t1.toLowerCase() === a) {
                    reserveA = reserve1;
                    reserveB = reserve0;
                }

                setReserves({ reserveA, reserveB, ready: reserveA > 0n && reserveB > 0n });
            } catch {
                if (!cancelled) setReserves({ reserveA: 0n, reserveB: 0n, ready: false });
            }
        };

        void load();
        const i = setInterval(() => void load(), 20_000);

        const onVis = () => void load();
        if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);

        return () => {
            cancelled = true;
            clearInterval(i);
            if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
        };
    }, [canReadOnSei, seiPublicClient, poolMeta.pair, poolMeta.tokenA_forReserves, poolMeta.tokenB, refreshTick]);

    // ===== two-way ratio fill =====
    useEffect(() => {
        if (!reserves.ready) return;
        if (reserves.reserveA === 0n || reserves.reserveB === 0n) return;

        const who = lastEditedRef.current;

        if (who === "A" && (!debouncedA || debouncedA.trim() === "")) {
            setAmountB("");
            return;
        }
        if (who === "B" && (!debouncedB || debouncedB.trim() === "")) {
            setAmountA("");
            return;
        }

        try {
            if (who === "A") {
                const rawA = parseUnits(debouncedA as `${string}`, poolMeta.tokenADecimals);
                if (rawA <= 0n) {
                    setAmountB("");
                    return;
                }
                const rawB = (rawA * reserves.reserveB) / reserves.reserveA;
                setAmountB(clampDecimals(formatUnits(rawB, poolMeta.tokenBDecimals), 6));
                return;
            }

            if (who === "B") {
                const rawB = parseUnits(debouncedB as `${string}`, poolMeta.tokenBDecimals);
                if (rawB <= 0n) {
                    setAmountA("");
                    return;
                }
                const rawA = (rawB * reserves.reserveA) / reserves.reserveB;
                setAmountA(clampDecimals(formatUnits(rawA, poolMeta.tokenADecimals), 6));
                return;
            }
        } catch {
            // ignore
        }
    }, [
        reserves.ready,
        reserves.reserveA,
        reserves.reserveB,
        debouncedA,
        debouncedB,
        poolMeta.tokenADecimals,
        poolMeta.tokenBDecimals,
    ]);

    const reservesContent = useMemo(() => {
        if (!reserves.ready) return null;
        const aRaw = formatUnits(reserves.reserveA, poolMeta.tokenADecimals);
        const bRaw = formatUnits(reserves.reserveB, poolMeta.tokenBDecimals);
        return `${reserveFmt(aRaw)} ${poolMeta.tokenASymbol} • ${reserveFmt(bRaw)} ${poolMeta.tokenBSymbol}`;
    }, [
        reserves.ready,
        reserves.reserveA,
        reserves.reserveB,
        poolMeta.tokenADecimals,
        poolMeta.tokenBDecimals,
        poolMeta.tokenASymbol,
        poolMeta.tokenBSymbol,
    ]);

    const rateLine = useMemo(() => {
        if (!reserves.ready) return null;
        if (reserves.reserveA === 0n || reserves.reserveB === 0n) return null;

        const a = Number(formatUnits(reserves.reserveA, poolMeta.tokenADecimals));
        const b = Number(formatUnits(reserves.reserveB, poolMeta.tokenBDecimals));
        if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;

        const bPerA = b / a;
        const aPerB = a / b;

        const fmt = (x: number) =>
            new Intl.NumberFormat(undefined, { maximumFractionDigits: x >= 1000 ? 2 : x >= 1 ? 4 : 8 }).format(x);

        return `1 ${poolMeta.tokenASymbol} ≈ ${fmt(bPerA)} ${poolMeta.tokenBSymbol} • 1 ${poolMeta.tokenBSymbol} ≈ ${fmt(
            aPerB
        )} ${poolMeta.tokenASymbol}`;
    }, [
        reserves.ready,
        reserves.reserveA,
        reserves.reserveB,
        poolMeta.tokenADecimals,
        poolMeta.tokenBDecimals,
        poolMeta.tokenASymbol,
        poolMeta.tokenBSymbol,
    ]);

    const SLIPPAGE_BPS = 200;
    const txLockRef = useRef(false);
    const [busy, setBusy] = useState(false);

    // --- Core reliability fix ---
    // Do NOT trust a quick refetch after approve. Wait for receipt AND confirm allowance on-chain.
    const waitAllowance = useCallback(
        async (token: Address, owner: Address, spender: Address, need: bigint) => {
            const client = seiPublicClient;
            if (!client) throw new Error("Public client not ready.");

            const start = Date.now();
            const timeoutMs = 25_000;

            while (Date.now() - start < timeoutMs) {
                const a = (await client.readContract({
                    address: token,
                    abi: erc20Abi,
                    functionName: "allowance",
                    args: [owner, spender],
                })) as bigint;

                if (a >= need) return;
                await new Promise((r) => setTimeout(r, 900));
            }

            throw new Error("Approval not indexed yet. Try again in a moment.");
        },
        [seiPublicClient, erc20Abi]
    );

    const approveIfNeeded = useCallback(
        async (token: Address, required: bigint) => {
            const client = seiPublicClient;
            if (!client) throw new Error("Public client not ready.");
            if (!address) throw new Error("Wallet not connected.");

            const current = (await client.readContract({
                address: token,
                abi: erc20Abi,
                functionName: "allowance",
                args: [address as Address, routerAddress],
            })) as bigint;

            if (current >= required) return;

            const hash = (await writeContractAsync({
                chainId: SEI_EVM_CHAIN_ID,
                address: token,
                abi: erc20Abi,
                functionName: "approve",
                args: [routerAddress, required],
            })) as Hex;

            await client.waitForTransactionReceipt({ hash });
            await waitAllowance(token, address as Address, routerAddress, required);
        },
        [seiPublicClient, address, erc20Abi, routerAddress, writeContractAsync, waitAllowance]
    );

    const parsed = useMemo(() => {
        try {
            if (!amountA || !amountB) return { rawA: null as bigint | null, rawB: null as bigint | null };
            const rawA = parseUnits(amountA as `${string}`, poolMeta.tokenADecimals);
            const rawB = parseUnits(amountB as `${string}`, poolMeta.tokenBDecimals);
            return { rawA, rawB };
        } catch {
            return { rawA: null as bigint | null, rawB: null as bigint | null };
        }
    }, [amountA, amountB, poolMeta.tokenADecimals, poolMeta.tokenBDecimals]);

    const insufficientA = useMemo(() => {
        if (parsed.rawA === null || tokenABalanceRaw === null) return false;
        return parsed.rawA > tokenABalanceRaw;
    }, [parsed.rawA, tokenABalanceRaw]);

    const insufficientB = useMemo(() => {
        if (parsed.rawB === null || tokenBBalanceRaw === null) return false;
        return parsed.rawB > tokenBBalanceRaw;
    }, [parsed.rawB, tokenBBalanceRaw]);

    const addLiquidity = useCallback(async () => {
        if (txLockRef.current || busy || isPending) return;
        txLockRef.current = true;

        try {
            setError(null);

            if (!canWriteOnSei || !address) {
                setError("Connect wallet on Sei EVM (chain 1329).");
                return;
            }
            if (!seiPublicClient) {
                setError("Public client not ready yet. Try again.");
                return;
            }
            if (!reserves.ready) {
                setError("Reserves not loaded yet. Try again in a moment.");
                return;
            }
            if (!amountA || !amountB) {
                setError("Enter an amount.");
                return;
            }

            const rawA = parseUnits(amountA as `${string}`, poolMeta.tokenADecimals);
            const rawB = parseUnits(amountB as `${string}`, poolMeta.tokenBDecimals);

            if (rawA <= 0n || rawB <= 0n) {
                setError("Enter valid amounts.");
                return;
            }

            if (tokenABalanceRaw !== null && rawA > tokenABalanceRaw) {
                setError(`Insufficient ${poolMeta.tokenASymbol} balance.`);
                return;
            }
            if (tokenBBalanceRaw !== null && rawB > tokenBBalanceRaw) {
                setError(`Insufficient ${poolMeta.tokenBSymbol} balance.`);
                return;
            }

            const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
            const minA = (rawA * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n;
            const minB = (rawB * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n;

            setBusy(true);

            // Ensure approvals (waits receipt + confirms allowance)
            if (poolMeta.mode === "SEI") {
                await approveIfNeeded(frog, rawB);

                const { request } = await seiPublicClient.simulateContract({
                    address: routerAddress,
                    abi: routerAbi,
                    functionName: "addLiquiditySEI",
                    args: [frog, rawB, minB, minA, address as Address, deadline],
                    account: address as Address,
                    value: rawA,
                });

                const hash = (await writeContractAsync({
                    ...(request as unknown as Parameters<typeof writeContractAsync>[0]),
                    chainId: SEI_EVM_CHAIN_ID,
                })) as Hex;

                await seiPublicClient.waitForTransactionReceipt({ hash });

                // Refresh balances + reserves immediately
                await Promise.allSettled([refetchSeiBal(), refetchUsdyBal(), refetchFrogBal()]);
                setRefreshTick((x) => x + 1);

                return;
            }

            // ERC20-ERC20 path
            await approveIfNeeded(usdy, rawA);
            await approveIfNeeded(frog, rawB);

            const { request } = await seiPublicClient.simulateContract({
                address: routerAddress,
                abi: routerAbi,
                functionName: "addLiquidity",
                args: [usdy, frog, rawA, rawB, minA, minB, address as Address, deadline],
                account: address as Address,
            });

            const hash = (await writeContractAsync({
                ...(request as unknown as Parameters<typeof writeContractAsync>[0]),
                chainId: SEI_EVM_CHAIN_ID,
            })) as Hex;

            await seiPublicClient.waitForTransactionReceipt({ hash });

            // Refresh balances + reserves immediately
            await Promise.allSettled([refetchSeiBal(), refetchUsdyBal(), refetchFrogBal()]);
            setRefreshTick((x) => x + 1);
        } catch (e) {
            setError(errToMessage(e, "Failed to add liquidity."));
        } finally {
            setBusy(false);
            txLockRef.current = false;
        }
    }, [
        busy,
        isPending,
        canWriteOnSei,
        address,
        seiPublicClient,
        reserves.ready,
        amountA,
        amountB,
        poolMeta.mode,
        poolMeta.tokenADecimals,
        poolMeta.tokenBDecimals,
        poolMeta.tokenASymbol,
        poolMeta.tokenBSymbol,
        tokenABalanceRaw,
        tokenBBalanceRaw,
        routerAddress,
        routerAbi,
        usdy,
        frog,
        approveIfNeeded,
        writeContractAsync,
        refetchSeiBal,
        refetchUsdyBal,
        refetchFrogBal,
    ]);

    const submitDisabled = !mounted || wrongNetwork || !canWriteOnSei || !reserves.ready || busy || isPending;

    const buttonLabel = useMemo(() => {
        if (!mounted) return "Loading…";
        if (busy || isPending) return "Processing…";
        if (!hasAddress) return "Connect wallet";
        if (wrongNetwork) return "Wrong network";
        if (!reserves.ready) return "Loading pool…";
        if (!amountA || !amountB) return "Enter amounts";
        if (parsed.rawA === null || parsed.rawB === null) return "Enter valid amounts";
        if (insufficientA) return `Insufficient ${poolMeta.tokenASymbol}`;
        if (insufficientB) return `Insufficient ${poolMeta.tokenBSymbol}`;
        return "Add liquidity";
    }, [
        mounted,
        busy,
        isPending,
        hasAddress,
        wrongNetwork,
        reserves.ready,
        amountA,
        amountB,
        parsed.rawA,
        parsed.rawB,
        insufficientA,
        insufficientB,
        poolMeta.tokenASymbol,
        poolMeta.tokenBSymbol,
    ]);

    const resetPool = useCallback((next: PoolKey) => {
        lastEditedRef.current = null;
        setPool(next);
        setAmountA("");
        setAmountB("");
        setError(null);
    }, []);

    return (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/20 to-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.6)] p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-sm font-semibold">Add Liquidity</div>

                    {reservesContent ? (
                        <div className="mt-1 text-xs">
                            <span className="text-brand-subtle">Reserves: </span>
                            <span className="text-brand-text">{reservesContent}</span>
                        </div>
                    ) : (
                        <div className="mt-1 text-xs text-brand-subtle">Reserves unavailable.</div>
                    )}
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/10 p-1">
                    <button
                        type="button"
                        onClick={() => resetPool("SEI_FROG")}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${pool === "SEI_FROG"
                                ? "bg-brand-primary/10 text-brand-text border-brand-primary/40"
                                : "text-brand-subtle border-transparent hover:text-white hover:bg-white/5 hover:border-white/10"
                            }`}
                    >
                        SEI / FROG
                    </button>

                    <button
                        type="button"
                        onClick={() => resetPool("USDY_FROG")}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${pool === "USDY_FROG"
                                ? "bg-brand-primary/10 text-brand-text border-brand-primary/40"
                                : "text-brand-subtle border-transparent hover:text-white hover:bg-white/5 hover:border-white/10"
                            }`}
                    >
                        USDY / FROG
                    </button>
                </div>
            </div>

            <div className="mt-4 grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <div className="flex items-center justify-between text-[11px] text-brand-subtle">
                            <span>Amount ({poolMeta.tokenASymbol})</span>

                            <div className="flex items-center gap-2">
                                {hasAddress && tokenABalDisplay && (
                                    <span className="font-mono">
                                        Bal: <span className="text-brand-text">{tokenABalDisplay}</span>
                                    </span>
                                )}

                                <button
                                    type="button"
                                    onClick={onMaxA}
                                    disabled={!hasAddress || tokenABalanceRaw === null || tokenABalanceRaw === 0n}
                                    className={`text-[10px] leading-none font-semibold uppercase tracking-wide px-1.5 py-[2px] rounded transition-colors ${!hasAddress || tokenABalanceRaw === null || tokenABalanceRaw === 0n
                                            ? "cursor-not-allowed opacity-40"
                                            : "text-brand-primary/90 hover:text-brand-primary hover:bg-white/5"
                                        }`}
                                >
                                    MAX
                                </button>
                            </div>
                        </div>

                        <input
                            inputMode="decimal"
                            placeholder="0.0"
                            value={amountA}
                            onChange={(e) => {
                                lastEditedRef.current = "A";
                                setAmountA(sanitizeAmountInput(e.target.value));
                            }}
                            className="h-11 w-full rounded-xl bg-black/20 px-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                        />
                    </div>

                    <div className="grid gap-2">
                        <div className="flex items-center justify-between text-[11px] text-brand-subtle">
                            <span>Amount ({poolMeta.tokenBSymbol})</span>

                            <div className="flex items-center gap-2">
                                {hasAddress && frogBalDisplay && (
                                    <span className="font-mono">
                                        Bal: <span className="text-brand-text">{frogBalDisplay}</span>
                                    </span>
                                )}

                                <button
                                    type="button"
                                    onClick={onMaxFrog}
                                    disabled={!hasAddress || tokenBBalanceRaw === null || tokenBBalanceRaw === 0n}
                                    className={`text-[10px] leading-none font-semibold uppercase tracking-wide px-1.5 py-[2px] rounded transition-colors ${!hasAddress || tokenBBalanceRaw === null || tokenBBalanceRaw === 0n
                                            ? "cursor-not-allowed opacity-40"
                                            : "text-brand-primary/90 hover:text-brand-primary hover:bg-white/5"
                                        }`}
                                >
                                    MAX
                                </button>
                            </div>
                        </div>

                        <input
                            inputMode="decimal"
                            placeholder="0.0"
                            value={amountB}
                            onChange={(e) => {
                                lastEditedRef.current = "B";
                                setAmountB(sanitizeAmountInput(e.target.value));
                            }}
                            className="h-11 w-full rounded-xl bg-black/20 px-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                        />
                    </div>
                </div>

                {rateLine && <div className="text-[11px] text-brand-subtle">{rateLine}</div>}

                {error && <div className="text-xs text-red-300">{error}</div>}

                <button
                    type="button"
                    onClick={addLiquidity}
                    disabled={submitDisabled || buttonLabel !== "Add liquidity"}
                    className={`h-11 w-full rounded-2xl text-sm font-semibold transition-transform duration-150 shadow-[0_10px_25px_rgba(110,184,25,0.15)] ${submitDisabled || buttonLabel !== "Add liquidity"
                            ? "cursor-not-allowed bg-brand-subtle/30 text-brand-subtle"
                            : "bg-brand-primary text-black hover:scale-[1.01]"
                        }`}
                >
                    {buttonLabel}
                </button>

                <div className="text-[11px] text-brand-subtle">
                    Slippage: {SLIPPAGE_BPS / 100}% • Earn APR Passively on LP
                </div>
            </div>
        </div>
    );
}