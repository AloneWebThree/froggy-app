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
} from "@/lib/chain/froggyConfig";
import { requireAddress, getDecimals } from "@/lib/tokens/registry";
import { errToMessage } from "@/lib/utils/errors";
import { clampDecimals, formatTokenDisplay } from "@/lib/utils/format";
import { emitBalancesRefresh, onBalancesRefresh } from "@/lib/refresh/balancesRefresh";
import type { WriteContractParameters } from "wagmi/actions";

type PoolKey = "SEI_FROG" | "USDY_FROG" | "WBTC_FROG";
type LiqMode = "ADD" | "REMOVE";

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

const TOTAL_SUPPLY_ABI = [
    { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;

const LP_DECIMALS = 18;

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

type AnyWriteReq = WriteContractParameters;

function sanitizeTxRequest(req: AnyWriteReq): AnyWriteReq {
    const r: AnyWriteReq = { ...req };

    // Some wallets choke if gas is present but 0.
    if ((r as { gas?: bigint }).gas === 0n) delete (r as { gas?: bigint }).gas;

    // Same for fee fields if they come back as 0.
    if ((r as { gasPrice?: bigint }).gasPrice === 0n) delete (r as { gasPrice?: bigint }).gasPrice;
    if ((r as { maxFeePerGas?: bigint }).maxFeePerGas === 0n) delete (r as { maxFeePerGas?: bigint }).maxFeePerGas;
    if ((r as { maxPriorityFeePerGas?: bigint }).maxPriorityFeePerGas === 0n)
        delete (r as { maxPriorityFeePerGas?: bigint }).maxPriorityFeePerGas;

    return r;
}

function formatCompactNumber(n: number, maxFrac = 2) {
    if (!Number.isFinite(n)) return String(n);
    // Fixed locale prevents SSR/client locale mismatches.
    return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: maxFrac,
    }).format(n);
}

function reserveFmt(formatted: string) {
    const v = Number(formatted);
    if (!Number.isFinite(v)) return formatted;
    if (v >= 1_000_000) return formatCompactNumber(v, 1);
    if (v >= 10_000) return formatCompactNumber(v, 2);
    // Fixed locale prevents SSR/client locale mismatches.
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(v);
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

    // Avoid SSR hydration traps: generate the random refresh source only on the client.
    const refreshSourceRef = useRef<string>("liquidity");
    useEffect(() => {
        try {
            refreshSourceRef.current = `liquidity-${crypto.randomUUID()}`;
        } catch {
            refreshSourceRef.current = `liquidity-${Date.now()}`;
        }
    }, []);

    const routerAddress = DRAGON_ROUTER_ADDRESS as Address;
    const routerAbi = DRAGON_ROUTER_ABI as unknown as Abi;
    const erc20Abi = ERC20_ABI as unknown as Abi;

    const frog = requireAddress("FROG");
    const usdy = requireAddress("USDY");
    const wbtc = requireAddress("WBTC");

    const POOLS = useMemo(
        () =>
            [
                { key: "SEI_FROG" as const, label: "SEI / FROG" },
                { key: "USDY_FROG" as const, label: "USDY / FROG" },
                { key: "WBTC_FROG" as const, label: "WBTC / FROG" },
                // future: add more pools here
            ] satisfies Array<{ key: PoolKey; label: string }>,
        []
    );

    const [pool, setPool] = useState<PoolKey>("SEI_FROG");
    const [mode, setMode] = useState<LiqMode>("ADD");

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

        if (pool === "USDY_FROG") {
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
        }

        return {
            pair: ADDR.wbtcFrogPair as Address,
            tokenA_forReserves: wbtc,
            tokenB: frog,
            tokenASymbol: "WBTC" as const,
            tokenBSymbol: "FROG" as const,
            tokenADecimals: getDecimals("WBTC"),
            tokenBDecimals: getDecimals("FROG"),
            mode: "ERC20" as const,
        };
    }, [pool, frog, usdy, wbtc]);

    const [amountA, setAmountA] = useState("");
    const [amountB, setAmountB] = useState("");
    const [removePct, setRemovePct] = useState(0);
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

    const { data: wbtcBalRaw, refetch: refetchWbtcBal } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: wbtc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address as Address] : undefined,
        query: { enabled: !!address && canReadOnSei && poolMeta.tokenASymbol === "WBTC", staleTime: 5_000 },
    });

    const { data: frogBalRaw, refetch: refetchFrogBal } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: frog,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address as Address] : undefined,
        query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
    });

    // LP (pair) balance + totalSupply for Remove mode
    const { data: lpBalRaw, refetch: refetchLpBal } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: poolMeta.pair,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address as Address] : undefined,
        query: { enabled: !!address && canReadOnSei, staleTime: 5_000 },
    });

    const { data: lpTotalSupplyRaw } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: poolMeta.pair,
        abi: TOTAL_SUPPLY_ABI,
        functionName: "totalSupply",
        query: { enabled: canReadOnSei, staleTime: 10_000 },
    });

    const SEI_GAS_BUFFER_RAW = useMemo(() => parseUnits("0.01", 18), []);

    const tokenABalanceRaw = useMemo<bigint | null>(() => {
        if (!address || !canReadOnSei) return null;
        if (poolMeta.tokenASymbol === "SEI") {
            const raw = seiBal?.value;
            if (typeof raw !== "bigint") return null;
            return raw > SEI_GAS_BUFFER_RAW ? raw - SEI_GAS_BUFFER_RAW : 0n;
        }
        if (poolMeta.tokenASymbol === "USDY") return typeof usdyBalRaw === "bigint" ? usdyBalRaw : null;
        if (poolMeta.tokenASymbol === "WBTC") return typeof wbtcBalRaw === "bigint" ? wbtcBalRaw : null;
        return null;
    }, [address, canReadOnSei, poolMeta.tokenASymbol, seiBal?.value, usdyBalRaw, wbtcBalRaw, SEI_GAS_BUFFER_RAW]);

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

    // Listen for app-wide refresh signals (e.g., Swap changed balances).
    useEffect(() => {
        if (!mounted) return;

        return onBalancesRefresh((detail) => {
            if (detail?.source && detail.source === refreshSourceRef.current) return;
            void refetchSeiBal();
            void refetchUsdyBal();
            void refetchWbtcBal();
            void refetchFrogBal();
            void refetchLpBal();
            setRefreshTick((x) => x + 1);
        });
    }, [mounted, refetchSeiBal, refetchUsdyBal, refetchWbtcBal, refetchFrogBal, refetchLpBal]);

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
                    client.readContract({
                        address: poolMeta.pair,
                        abi: PAIR_ABI,
                        functionName: "token0",
                    }) as Promise<Address>,
                    client.readContract({
                        address: poolMeta.pair,
                        abi: PAIR_ABI,
                        functionName: "token1",
                    }) as Promise<Address>,
                    client.readContract({
                        address: poolMeta.pair,
                        abi: PAIR_ABI,
                        functionName: "getReserves",
                    }) as Promise<[bigint, bigint, number]>,
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

                // ready means "non-empty pool"; keep it strict for ratio UI and remove preview
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
            // Fixed locale prevents SSR/client locale mismatches.
            new Intl.NumberFormat("en-US", { maximumFractionDigits: x >= 1000 ? 2 : x >= 1 ? 4 : 8 }).format(x);

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

    const lpBalanceRaw = useMemo(() => {
        if (!address || !canReadOnSei) return null;
        return (lpBalRaw as bigint | undefined) ?? null;
    }, [address, canReadOnSei, lpBalRaw]);

    const lpBalDisplay = useMemo(() => {
        if (lpBalanceRaw === null) return null;
        return formatTokenDisplay(lpBalanceRaw, LP_DECIMALS);
    }, [lpBalanceRaw]);

    const clampedRemovePct = useMemo(() => Math.max(0, Math.min(100, removePct)), [removePct]);

    const lpToBurnRaw = useMemo(() => {
        if (lpBalanceRaw === null) return 0n;
        if (clampedRemovePct <= 0) return 0n;
        return (lpBalanceRaw * BigInt(clampedRemovePct)) / 100n;
    }, [lpBalanceRaw, clampedRemovePct]);

    const removePreview = useMemo(() => {
        const total = (lpTotalSupplyRaw as bigint | undefined) ?? null;
        if (!reserves.ready || total === null || total <= 0n || lpToBurnRaw <= 0n) {
            return { outA: 0n, outB: 0n, ready: false as const };
        }
        // proportional share of reserves (approx; ignores fees/slippage)
        const outA = (reserves.reserveA * lpToBurnRaw) / total;
        const outB = (reserves.reserveB * lpToBurnRaw) / total;
        return { outA, outB, ready: outA > 0n || outB > 0n };
    }, [reserves.ready, reserves.reserveA, reserves.reserveB, lpTotalSupplyRaw, lpToBurnRaw]);

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

                const safeReq = sanitizeTxRequest(request as unknown as AnyWriteReq);

                const hash = (await writeContractAsync({
                    ...(safeReq as unknown as Parameters<typeof writeContractAsync>[0]),
                    chainId: SEI_EVM_CHAIN_ID,
                })) as Hex;

                await seiPublicClient.waitForTransactionReceipt({ hash });

                // Refresh balances + reserves immediately (only what applies) + LP bal
                const refetches: Promise<unknown>[] = [refetchFrogBal(), refetchLpBal(), refetchSeiBal()];
                await Promise.allSettled(refetches);
                setRefreshTick((x) => x + 1);
                emitBalancesRefresh(refreshSourceRef.current);

                // Clear inputs to prevent accidental double-submit
                setAmountA("");
                setAmountB("");
                lastEditedRef.current = null;

                return;
            }

            // ERC20-ERC20 path
            const tokenA = poolMeta.tokenASymbol === "USDY" ? usdy : wbtc;

            await approveIfNeeded(tokenA, rawA);
            await approveIfNeeded(frog, rawB);

            const { request } = await seiPublicClient.simulateContract({
                address: routerAddress,
                abi: routerAbi,
                functionName: "addLiquidity",
                args: [tokenA, frog, rawA, rawB, minA, minB, address as Address, deadline],
                account: address as Address,
            });

            const safeReq = sanitizeTxRequest(request as unknown as AnyWriteReq);

            const hash = (await writeContractAsync({
                ...(safeReq as unknown as Parameters<typeof writeContractAsync>[0]),
                chainId: SEI_EVM_CHAIN_ID,
            })) as Hex;

            await seiPublicClient.waitForTransactionReceipt({ hash });

            // Refresh balances + reserves immediately (only what applies) + LP bal
            const refetches: Promise<unknown>[] = [refetchFrogBal(), refetchLpBal(), refetchUsdyBal(), refetchWbtcBal()];
            await Promise.allSettled(refetches);
            setRefreshTick((x) => x + 1);
            emitBalancesRefresh(refreshSourceRef.current);

            // Clear inputs to prevent accidental double-submit
            setAmountA("");
            setAmountB("");
            lastEditedRef.current = null;
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
        wbtc,
        frog,
        approveIfNeeded,
        writeContractAsync,
        refetchSeiBal,
        refetchUsdyBal,
        refetchWbtcBal,
        refetchFrogBal,
        refetchLpBal,
    ]);

    const removeLiquidity = useCallback(async () => {
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
                setError("Pool reserves not loaded yet. Try again in a moment.");
                return;
            }

            const total = (lpTotalSupplyRaw as bigint | undefined) ?? null;
            if (total === null || total <= 0n) {
                setError("LP supply not loaded yet. Try again.");
                return;
            }

            if (clampedRemovePct <= 0 || lpToBurnRaw <= 0n) {
                setError("Select an amount to remove.");
                return;
            }

            if (lpBalanceRaw !== null && lpToBurnRaw > lpBalanceRaw) {
                setError("Insufficient LP balance.");
                return;
            }

            const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

            // Preview-derived mins (approx)
            const minA = (removePreview.outA * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n;
            const minB = (removePreview.outB * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n;

            setBusy(true);

            // Approve LP token (pair) to router
            await approveIfNeeded(poolMeta.pair, lpToBurnRaw);

            if (poolMeta.mode === "SEI") {
                // removeLiquiditySEI(token, liquidity, amountTokenMin, amountSEIMin, to, deadline)
                const { request } = await seiPublicClient.simulateContract({
                    address: routerAddress,
                    abi: routerAbi,
                    functionName: "removeLiquiditySEI",
                    args: [frog, lpToBurnRaw, minB, minA, address as Address, deadline],
                    account: address as Address,
                });

                const safeReq = sanitizeTxRequest(request as unknown as AnyWriteReq);

                const hash = (await writeContractAsync({
                    ...(safeReq as unknown as Parameters<typeof writeContractAsync>[0]),
                    chainId: SEI_EVM_CHAIN_ID,
                })) as Hex;

                await seiPublicClient.waitForTransactionReceipt({ hash });

                await Promise.allSettled([refetchSeiBal(), refetchFrogBal(), refetchLpBal(), refetchUsdyBal(), refetchWbtcBal()]);
                setRefreshTick((x) => x + 1);
                emitBalancesRefresh(refreshSourceRef.current);

                // Clear remove state
                setRemovePct(0);

                return;
            }

            // ERC20-ERC20 path
            const tokenA = poolMeta.tokenASymbol === "USDY" ? usdy : wbtc;
            const { request } = await seiPublicClient.simulateContract({
                address: routerAddress,
                abi: routerAbi,
                functionName: "removeLiquidity",
                args: [tokenA, frog, lpToBurnRaw, minA, minB, address as Address, deadline],
                account: address as Address,
            });

            const safeReq = sanitizeTxRequest(request as unknown as AnyWriteReq);

            const hash = (await writeContractAsync({
                ...(safeReq as unknown as Parameters<typeof writeContractAsync>[0]),
                chainId: SEI_EVM_CHAIN_ID,
            })) as Hex;

            await seiPublicClient.waitForTransactionReceipt({ hash });

            await Promise.allSettled([refetchUsdyBal(), refetchWbtcBal(), refetchFrogBal(), refetchLpBal(), refetchSeiBal()]);
            setRefreshTick((x) => x + 1);
            emitBalancesRefresh(refreshSourceRef.current);

            // Clear remove state
            setRemovePct(0);
        } catch (e) {
            setError(errToMessage(e, "Failed to remove liquidity."));
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
        lpTotalSupplyRaw,
        clampedRemovePct,
        lpToBurnRaw,
        lpBalanceRaw,
        removePreview.outA,
        removePreview.outB,
        poolMeta.mode,
        poolMeta.pair,
        poolMeta.tokenASymbol,
        routerAddress,
        routerAbi,
        usdy,
        wbtc,
        frog,
        approveIfNeeded,
        writeContractAsync,
        refetchSeiBal,
        refetchUsdyBal,
        refetchWbtcBal,
        refetchFrogBal,
        refetchLpBal,
    ]);

    // Mode-aware disable:
    // - ADD: do NOT require non-empty reserves (supports first LP add)
    // - REMOVE: require reserves.ready for preview/mins
    const baseDisabled =
        !mounted || wrongNetwork || !canWriteOnSei || busy || isPending || (mode === "REMOVE" ? !reserves.ready : false);

    const buttonLabel = useMemo(() => {
        if (!mounted) return "Loading…";
        if (busy || isPending) return "Processing…";
        if (!hasAddress) return "Connect wallet";
        if (wrongNetwork) return "Wrong network";

        if (mode === "ADD") {
            if (!amountA || !amountB) return "Enter amounts";
            if (parsed.rawA === null || parsed.rawB === null) return "Enter valid amounts";
            if (insufficientA) return `Insufficient ${poolMeta.tokenASymbol}`;
            if (insufficientB) return `Insufficient ${poolMeta.tokenBSymbol}`;
            return "Add liquidity";
        }

        // REMOVE
        if (!reserves.ready) return "Loading pool…";
        if (lpBalanceRaw === null) return "Loading LP…";
        if (lpBalanceRaw === 0n) return "No LP to remove";
        if (clampedRemovePct <= 0) return "Select amount";
        return "Remove liquidity";
    }, [
        mounted,
        busy,
        isPending,
        hasAddress,
        wrongNetwork,
        mode,
        amountA,
        amountB,
        parsed.rawA,
        parsed.rawB,
        insufficientA,
        insufficientB,
        poolMeta.tokenASymbol,
        poolMeta.tokenBSymbol,
        reserves.ready,
        lpBalanceRaw,
        clampedRemovePct,
    ]);

    const submitDisabled = baseDisabled || (mode === "ADD" ? buttonLabel !== "Add liquidity" : buttonLabel !== "Remove liquidity");

    const resetPool = useCallback((next: PoolKey) => {
        lastEditedRef.current = null;
        setPool(next);
        setAmountA("");
        setAmountB("");
        setRemovePct(0);
        setError(null);
    }, []);

    const switchMode = useCallback((next: LiqMode) => {
        setMode(next);
        setError(null);
        if (next === "ADD") {
            lastEditedRef.current = null;
            setAmountA("");
            setAmountB("");
        } else {
            setRemovePct(0);
        }
    }, []);

    const statusPill = useMemo(() => {
        if (!mounted) return { text: "Loading…", cls: "text-brand-subtle border-white/10 bg-black/20" };
        if (!hasAddress) return { text: "Wallet disconnected", cls: "text-brand-subtle border-white/10 bg-black/20" };
        if (wrongNetwork) return { text: "Wrong network", cls: "text-red-200 border-red-400/30 bg-red-500/10" };
        if (isSeiEvm) return { text: "Sei EVM", cls: "text-brand-text border-brand-primary/30 bg-brand-primary/10" };
        return { text: "Network", cls: "text-brand-subtle border-white/10 bg-black/20" };
    }, [mounted, hasAddress, wrongNetwork, isSeiEvm]);

    return (
        <div className="p-5">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 rounded-xl bg-black/30 border border-white/10 p-1">
                            <button
                                type="button"
                                onClick={() => switchMode("ADD")}
                                className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${mode === "ADD"
                                        ? "bg-brand-primary/10 text-brand-text border-brand-primary/40"
                                        : "text-brand-subtle border-transparent hover:text-white hover:bg-white/5 hover:border-white/10"
                                    }`}
                            >
                                Add
                            </button>

                            <button
                                type="button"
                                onClick={() => switchMode("REMOVE")}
                                className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${mode === "REMOVE"
                                        ? "bg-red-500/10 text-red-200 border-red-400/40"
                                        : "text-brand-subtle border-transparent hover:text-white hover:bg-white/5 hover:border-white/10"
                                    }`}
                            >
                                Remove
                            </button>
                        </div>

                        <span
                            className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[9px] font-semibold leading-none ${statusPill.cls}`}
                        >
                            {statusPill.text}
                        </span>
                    </div>

                    {/* Reserves only (prices moved down into the form area) */}
                    <div className="mt-2 grid gap-1">
                        {reservesContent ? (
                            <div className="text-[11px] text-white/55">
                                <span className="text-white/45 mr-1">Reserves:</span>
                                <span className="font-mono text-white/70">{reservesContent}</span>
                            </div>
                        ) : (
                            <div className="text-[11px] text-white/45">
                                Reserves unavailable{mode === "ADD" ? " (pool may be empty — you can still add)." : "."}
                            </div>
                        )}
                    </div>
                </div>

                {/* Pool dropdown (scales to many pools) */}
                <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor="pool-select">
                        Pool
                    </label>
                    <div className="relative">
                        <select
                            id="pool-select"
                            value={pool}
                            onChange={(e) => resetPool(e.target.value as PoolKey)}
                            className="h-10 w-[168px] appearance-none rounded-lg bg-black/20 pl-3 pr-9 text-xs font-semibold text-white/80 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                        >
                            {POOLS.map((p) => (
                                <option key={p.key} value={p.key}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white/50">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path
                                    fillRule="evenodd"
                                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.936a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-3 grid gap-4">
                {mode === "ADD" ? (
                    <>
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

                        {/* Prices moved here (below the inputs) */}
                        {rateLine && (
                            <div className="text-[11px] text-white/55 pl-1 leading-tight">
                                <span className="text-white/45 mr-1">Price:</span>
                                <span className="font-mono text-white/70">{rateLine}</span>
                            </div>
                        )}

                        {error && <div className="text-xs text-red-300">{error}</div>}

                        <button
                            type="button"
                            onClick={addLiquidity}
                            disabled={submitDisabled}
                            className={`h-11 w-full rounded-2xl text-sm font-semibold transition-transform duration-150 ${submitDisabled
                                    ? "cursor-not-allowed bg-black/20 text-white/45 border border-white/10 shadow-none"
                                    : "bg-brand-primary text-black hover:scale-[1.01] shadow-[0_10px_25px_rgba(110,184,25,0.15)]"
                                }`}
                        >
                            {buttonLabel}
                        </button>

                        <div className="text-[11px] text-brand-subtle">
                            Slippage: {SLIPPAGE_BPS / 100}% • Earn APR Passively on LP
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between text-[11px] text-brand-subtle">
                                    <span>LP Tokens</span>

                                    <div className="flex items-center gap-2">
                                        {hasAddress && lpBalDisplay && (
                                            <span className="font-mono">
                                                Bal: <span className="text-brand-text">{lpBalDisplay}</span>
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setRemovePct(100)}
                                            disabled={!hasAddress || lpBalanceRaw === null || lpBalanceRaw === 0n}
                                            className={`text-[10px] leading-none font-semibold uppercase tracking-wide px-1.5 py-[2px] rounded transition-colors ${!hasAddress || lpBalanceRaw === null || lpBalanceRaw === 0n
                                                    ? "cursor-not-allowed opacity-40"
                                                    : "text-brand-primary/90 hover:text-brand-primary hover:bg-white/5"
                                                }`}
                                        >
                                            MAX
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {[25, 50, 75, 100].map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setRemovePct(p)}
                                                disabled={!hasAddress || lpBalanceRaw === null || lpBalanceRaw === 0n}
                                                className={`h-8 px-3 rounded-xl text-xs font-semibold border transition-colors ${clampedRemovePct === p
                                                        ? "bg-brand-primary/10 text-brand-text border-brand-primary/40"
                                                        : "text-brand-subtle border-transparent hover:text-white hover:bg-white/5 hover:border-white/10"
                                                    } ${!hasAddress || lpBalanceRaw === null || lpBalanceRaw === 0n
                                                        ? "opacity-40 cursor-not-allowed"
                                                        : ""
                                                    }`}
                                            >
                                                {p === 100 ? "Max" : `${p}%`}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-3">
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={clampedRemovePct}
                                            onChange={(e) => setRemovePct(Number(e.target.value))}
                                            disabled={!hasAddress || lpBalanceRaw === null || lpBalanceRaw === 0n}
                                            className="w-full"
                                        />
                                    </div>

                                    <div className="mt-2 flex items-center justify-between text-[11px] text-brand-subtle">
                                        <span>
                                            Remove: <span className="text-brand-text font-semibold">{clampedRemovePct}%</span>
                                        </span>

                                        <span className="font-mono">
                                            LP Tokens Returned:{" "}
                                            <span className="text-brand-text">
                                                {lpToBurnRaw > 0n ? formatTokenDisplay(lpToBurnRaw, LP_DECIMALS) : "0"}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Prices also visible in remove flow, under the control area */}
                                {rateLine && (
                                    <div className="text-[11px] text-white/55 pl-1 leading-tight">
                                        <span className="text-white/45 mr-1">Price:</span>
                                        <span className="font-mono text-white/70">{rateLine}</span>
                                    </div>
                                )}

                            <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                                <div className="text-[11px] text-brand-subtle">You receive (estimated)</div>
                                <div className="mt-1 text-xs">
                                    <span className="text-brand-text font-mono">
                                        {removePreview.ready
                                            ? `${formatTokenDisplay(removePreview.outA, poolMeta.tokenADecimals)} ${poolMeta.tokenASymbol} + ${formatTokenDisplay(
                                                removePreview.outB,
                                                poolMeta.tokenBDecimals
                                            )} ${poolMeta.tokenBSymbol}`
                                            : "—"}
                                    </span>
                                </div>
                            </div>

                            {error && <div className="text-xs text-red-300">{error}</div>}

                            <button
                                type="button"
                                onClick={removeLiquidity}
                                disabled={submitDisabled}
                                className={`h-11 w-full rounded-2xl text-sm font-semibold transition-transform duration-150 ${submitDisabled
                                        ? "cursor-not-allowed bg-black/20 text-white/45 border border-white/10 shadow-none"
                                        : "bg-red-400/90 text-black hover:scale-[1.01] shadow-[0_10px_25px_rgba(110,184,25,0.15)]"
                                    }`}
                            >
                                {buttonLabel}
                            </button>

                            <div className="text-[11px] text-brand-subtle">
                                Slippage: {SLIPPAGE_BPS / 100}% • Estimates shown before fees
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}