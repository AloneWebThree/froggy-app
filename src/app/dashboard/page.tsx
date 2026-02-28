"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { formatUnits } from "viem";
import {
    useAccount,
    usePublicClient,
    useReadContract,
    useWriteContract,
    useWaitForTransactionReceipt,
} from "wagmi";

import { WalletButton } from "@/components/layout/WalletButton";
import LiveStats from "@/components/layout/LiveStats";

import {
    SEI_EVM_CHAIN_ID,
    ZERO_ADDRESS,
    FROGGY_STREAK_ADDRESS,
    FROGGY_STREAK_ABI,
    ERC20_ABI,
    FROGGY_REWARDS_ADDRESS,
    FROGGY_REWARDS_ABI,
} from "@/lib/chain/froggyConfig";

import { requireAddress } from "@/lib/tokens/registry";
import { normalizeUserState, type UserStateTuple } from "@/features/streak/normalizeUserState";

function shortAddr(addr?: `0x${string}`) {
    if (!addr) return "";
    const s = addr.toString();
    if (s.length <= 10) return s;
    return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
    return typeof v === "object" && v !== null;
}

function getStringProp(obj: UnknownRecord, key: string): string | null {
    const val = obj[key];
    return typeof val === "string" ? val : null;
}

function getObjectProp(obj: UnknownRecord, key: string): UnknownRecord | null {
    const val = obj[key];
    return isRecord(val) ? val : null;
}

function pickErrorMessage(err: unknown): string | null {
    if (!isRecord(err)) return null;

    const direct =
        getStringProp(err, "reason") ??
        getStringProp(err, "shortMessage") ??
        getStringProp(err, "details") ??
        getStringProp(err, "message");

    if (direct) return direct;

    const cause = getObjectProp(err, "cause");
    if (cause) {
        const fromCause =
            getStringProp(cause, "reason") ??
            getStringProp(cause, "shortMessage") ??
            getStringProp(cause, "details") ??
            getStringProp(cause, "message");

        if (fromCause) return fromCause;
    }

    return null;
}

function isDefiniteRevertMessage(msg: string) {
    const m = msg.toLowerCase();
    return (
        m.includes("check-ins paused") ||
        m.includes("insufficient frog balance") ||
        m.includes("already checked in today") ||
        m.includes("balance has not increased since last check-in")
    );
}

async function refetchWithRetry(fn: () => Promise<unknown>, tries = 3, delayMs = 350) {
    for (let i = 0; i < tries; i++) {
        try {
            await fn();
            return;
        } catch {
            // ignore and retry
        }
        if (i < tries - 1) {
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

type RewardsPreview = readonly [
    boolean, // isActive
    boolean, // canAccrueToday
    bigint, // aprBps
    bigint, // rewardToday
    bigint, // balanceSnapshot
    bigint, // balanceUsed
    number, // currentStreak (uint32)
    bigint, // today (uint64)
    bigint, // lastCheckInDay (uint64)
    bigint, // lastAccruedDay_ (uint64)
    bigint, // accruedSoFar (uint256)
    bigint // capRaw (uint256)
];

export default function DashboardPage() {
    // ---- Hydration-safe gating ----
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const { address, isConnected, chainId } = useAccount();
    const publicClient = usePublicClient({ chainId: SEI_EVM_CHAIN_ID });

    // Only trust wallet state after mount (prevents SSR/CSR mismatch)
    const uiConnected = mounted && isConnected;

    const isOnSeiEvm = mounted && chainId === SEI_EVM_CHAIN_ID;
    const wrongNetwork = mounted && chainId != null && chainId !== SEI_EVM_CHAIN_ID;

    const shortAddress = useMemo(() => shortAddr(address), [address]);

    // ===== READ: getUserState (streak contract) =====
    const {
        data: userStateRaw,
        isLoading: isLoadingUser,
        isError: isUserError,
        refetch: refetchUserState,
    } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: FROGGY_STREAK_ADDRESS,
        abi: FROGGY_STREAK_ABI,
        functionName: "getUserState",
        args: [address ?? ZERO_ADDRESS],
        query: { enabled: mounted && !!address && !wrongNetwork },
    });

    const { currentStreak, bestStreak, totalCheckIns, lastCheckInDay, lastRecordedBalance } =
        normalizeUserState(userStateRaw as UserStateTuple | undefined);

    // Track today's UTC day index on the client
    const [currentUtcDay, setCurrentUtcDay] = useState<number | null>(null);

    useEffect(() => {
        if (!mounted) return;

        const nowSeconds = Date.now() / 1000;
        setCurrentUtcDay(Math.floor(nowSeconds / 86400));

        const id = window.setInterval(() => {
            const s = Date.now() / 1000;
            setCurrentUtcDay(Math.floor(s / 86400));
        }, 60_000);

        return () => window.clearInterval(id);
    }, [mounted]);

    const hasCheckedInToday = useMemo(() => {
        if (lastCheckInDay === null || currentUtcDay === null) return false;
        return lastCheckInDay === currentUtcDay;
    }, [lastCheckInDay, currentUtcDay]);

    const lastCheckInSummary = useMemo(() => {
        if (isLoadingUser || wrongNetwork) return "";
        if (lastCheckInDay === null || currentUtcDay === null || totalCheckIns === 0) {
            return "No check-ins yet.";
        }

        const diff = currentUtcDay - lastCheckInDay;
        if (diff === 0) return "Last check-in: today.";
        if (diff === 1) return "Last check-in: yesterday.";
        if (diff > 1) return `Last check-in: ${diff} days ago.`;
        return "Last check-in: recently.";
    }, [isLoadingUser, wrongNetwork, lastCheckInDay, currentUtcDay, totalCheckIns]);

    // ===== Milestone badges =====
    const milestoneBadges = useMemo(() => {
        const milestones = [7, 14, 21, 30, 60, 90];
        return milestones.map((m) => {
            const earned = bestStreak >= m;
            const progress = earned ? 1 : currentStreak > 0 ? Math.min(currentStreak / m, 1) : 0;
            return { days: m, earned, progress };
        });
    }, [bestStreak, currentStreak]);

    const streakStatus = useMemo(
        () =>
            currentStreak === 0
                ? { label: "Inactive", tone: "bg-red-500/15 text-red-300 border-red-500/30" }
                : {
                    label: "Active",
                    tone: "bg-brand-primary/15 text-brand-primary border-brand-primary/40",
                },
        [currentStreak]
    );

    // ===== READ: FROG token balance + decimals =====
    const {
        data: frogBalanceRaw,
        isLoading: isLoadingBalance,
        refetch: refetchFrogBalance,
    } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: requireAddress("FROG"),
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address ?? ZERO_ADDRESS],
        query: { enabled: mounted && !!address && !wrongNetwork },
    });

    const { data: frogDecimalsRaw, isLoading: isLoadingDecimals } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: requireAddress("FROG"),
        abi: ERC20_ABI,
        functionName: "decimals",
        args: [],
        query: { enabled: mounted && !!address && !wrongNetwork },
    });

    const isBalanceLoading = isLoadingBalance || isLoadingDecimals;

    const frogDecimals = useMemo(() => {
        if (frogDecimalsRaw === undefined) return 18;
        return typeof frogDecimalsRaw === "number" ? frogDecimalsRaw : Number(frogDecimalsRaw);
    }, [frogDecimalsRaw]);

    const frogBalance = useMemo(() => {
        if (!frogBalanceRaw || frogDecimalsRaw === undefined) return 0;
        try {
            return Number(formatUnits(frogBalanceRaw as bigint, frogDecimals));
        } catch {
            return 0;
        }
    }, [frogBalanceRaw, frogDecimalsRaw, frogDecimals]);

    const hasIncreasedBalance = useMemo((): boolean => {
        if (frogBalanceRaw == null) return false;

        if (lastCheckInDay === 0) return true;
        if (lastRecordedBalance == null) return true;

        return (frogBalanceRaw as bigint) > lastRecordedBalance;
    }, [frogBalanceRaw, lastCheckInDay, lastRecordedBalance]);

    // =====================================================================
    // REWARDS (READ): preview + claimable + poolBalance
    // =====================================================================

    const {
        data: rewardsPreviewRaw,
        isLoading: isLoadingRewards,
        refetch: refetchRewardsPreview,
    } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: FROGGY_REWARDS_ADDRESS,
        abi: FROGGY_REWARDS_ABI,
        functionName: "preview",
        args: [address ?? ZERO_ADDRESS],
        query: { enabled: mounted && !!address && !wrongNetwork },
    });

    const {
        data: claimableRaw,
        isLoading: isLoadingClaimable,
        refetch: refetchClaimable,
    } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: FROGGY_REWARDS_ADDRESS,
        abi: FROGGY_REWARDS_ABI,
        functionName: "claimable",
        args: [address ?? ZERO_ADDRESS],
        query: { enabled: mounted && !!address && !wrongNetwork },
    });

    // Pool balance is global; does not require wallet chain context.
    const {
        data: rewardsPoolRaw,
        isLoading: isLoadingPool,
        refetch: refetchPool,
    } = useReadContract({
        chainId: SEI_EVM_CHAIN_ID,
        address: FROGGY_REWARDS_ADDRESS,
        abi: FROGGY_REWARDS_ABI,
        functionName: "poolBalance",
        args: [],
        query: { enabled: mounted },
    });

    const refetchRewards = useCallback(async () => {
        await Promise.all([refetchRewardsPreview(), refetchClaimable(), refetchPool()]);
    }, [refetchRewardsPreview, refetchClaimable, refetchPool]);

    const preview = rewardsPreviewRaw as RewardsPreview | undefined;
    const hasPreview = Array.isArray(preview) && preview.length >= 12;

    const rIsActive = hasPreview ? preview[0] : false;
    const rCanAccrueToday = hasPreview ? preview[1] : false;
    const rAprBps = hasPreview ? preview[2] : 0n;
    const rRewardTodayRaw = hasPreview ? preview[3] : 0n;
    const rBalanceSnapshotRaw = hasPreview ? preview[4] : 0n;

    // keeping these for future UI/debug parity
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const rBalanceUsedRaw = hasPreview ? preview[5] : 0n;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const rRewardsStreak = hasPreview ? preview[6] : 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const rRewardsTodayDay = hasPreview ? preview[7] : 0n;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const rRewardsLastCheckInDay = hasPreview ? preview[8] : 0n;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const rRewardsLastAccruedDay = hasPreview ? preview[9] : 0n;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const rAccruedSoFarRaw = hasPreview ? preview[10] : 0n;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const rCapRaw = hasPreview ? preview[11] : 0n;

    const rewardsLoading = isLoadingRewards || isLoadingPool || isLoadingClaimable;

    const aprPct = useMemo(() => Number(rAprBps) / 100, [rAprBps]);

    const rewardToday = useMemo(() => {
        try {
            return Number(formatUnits(rRewardTodayRaw, frogDecimals));
        } catch {
            return 0;
        }
    }, [rRewardTodayRaw, frogDecimals]);

    const snapshotBalance = useMemo(() => {
        try {
            return Number(formatUnits(rBalanceSnapshotRaw, frogDecimals));
        } catch {
            return 0;
        }
    }, [rBalanceSnapshotRaw, frogDecimals]);

    // FIX #1: action logic uses bigint, not number (prevents rounding-to-zero bugs)
    const claimableBI = useMemo(() => (claimableRaw as bigint | undefined) ?? 0n, [claimableRaw]);

    const claimable = useMemo(() => {
        try {
            return Number(formatUnits(claimableBI, frogDecimals));
        } catch {
            return 0;
        }
    }, [claimableBI, frogDecimals]);

    const poolBalance = useMemo(() => {
        try {
            return Number(formatUnits((rewardsPoolRaw as bigint | undefined) ?? 0n, frogDecimals));
        } catch {
            return 0;
        }
    }, [rewardsPoolRaw, frogDecimals]);

    // ===== WRITE: checkIn() =====
    const [didAttemptCheckIn, setDidAttemptCheckIn] = useState(false);
    const [localCheckInError, setLocalCheckInError] = useState<string | null>(null);
    const [isSimPreparing, setIsSimPreparing] = useState(false);

    const shouldEnableCheckIn = useMemo(() => {
        return (
            mounted &&
            !!address &&
            !wrongNetwork &&
            !isBalanceLoading &&
            !hasCheckedInToday &&
            frogBalanceRaw != null &&
            hasIncreasedBalance
        );
    }, [
        mounted,
        address,
        wrongNetwork,
        isBalanceLoading,
        hasCheckedInToday,
        frogBalanceRaw,
        hasIncreasedBalance,
    ]);

    const {
        data: txHash,
        writeContractAsync,
        error: writeError,
        isPending: isCheckInPending,
    } = useWriteContract();

    const { isLoading: isConfirmingTx, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({
        chainId: SEI_EVM_CHAIN_ID,
        hash: txHash,
        query: { enabled: !!txHash },
    });

    // Clear local state on wallet changes (prevents stale errors/attempts)
    useEffect(() => {
        setDidAttemptCheckIn(false);
        setLocalCheckInError(null);
    }, [address]);

    useEffect(() => {
        if (!isTxConfirmed) return;

        let cancelled = false;

        (async () => {
            await refetchWithRetry(() => refetchUserState(), 3, 350);
            await refetchWithRetry(() => refetchFrogBalance(), 3, 350);

            // Rewards can change after check-in (active, snapshot, etc.)
            await refetchWithRetry(() => refetchRewards(), 3, 350);

            if (!cancelled) setLocalCheckInError(null);
        })();

        return () => {
            cancelled = true;
        };
    }, [isTxConfirmed, refetchUserState, refetchFrogBalance, refetchRewards]);

    const txErrorMessage = useMemo(() => pickErrorMessage(writeError), [writeError]);

    useEffect(() => {
        if (!uiConnected || wrongNetwork || hasCheckedInToday) {
            setLocalCheckInError(null);
        }
    }, [uiConnected, wrongNetwork, hasCheckedInToday]);

    useEffect(() => {
        if (!uiConnected || wrongNetwork) return;

        const onFocus = () => {
            if (isConfirmingTx || isTxConfirmed) return;
            refetchUserState();
            refetchFrogBalance();
            refetchRewards();
        };

        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [
        uiConnected,
        wrongNetwork,
        isConfirmingTx,
        isTxConfirmed,
        refetchUserState,
        refetchFrogBalance,
        refetchRewards,
    ]);

    const handleCheckIn = async () => {
        if (!shouldEnableCheckIn) return;
        if (!address) return;

        setDidAttemptCheckIn(true);
        setLocalCheckInError(null);

        try {
            if (publicClient) {
                setIsSimPreparing(true);
                try {
                    const sim = await publicClient.simulateContract({
                        address: FROGGY_STREAK_ADDRESS,
                        abi: FROGGY_STREAK_ABI,
                        functionName: "checkIn",
                        account: address,
                    });

                    setIsSimPreparing(false);
                    await writeContractAsync(sim.request);
                    return;
                } catch (e) {
                    setIsSimPreparing(false);

                    const msg = pickErrorMessage(e) || "Simulation failed.";
                    if (isDefiniteRevertMessage(msg)) {
                        setLocalCheckInError(msg);
                        return;
                    }
                }
            }

            await writeContractAsync({
                chainId: SEI_EVM_CHAIN_ID,
                address: FROGGY_STREAK_ADDRESS,
                abi: FROGGY_STREAK_ABI,
                functionName: "checkIn",
                account: address,
            });
        } catch (e) {
            setLocalCheckInError(pickErrorMessage(e) || "Transaction failed.");
        } finally {
            setIsSimPreparing(false);
        }
    };

    const checkInDisabled =
        !uiConnected ||
        wrongNetwork ||
        isBalanceLoading ||
        isSimPreparing ||
        isCheckInPending ||
        isConfirmingTx ||
        hasCheckedInToday ||
        frogBalanceRaw == null ||
        !hasIncreasedBalance;

    const checkInLabel = useMemo(() => {
        if (!uiConnected) return "Connect wallet to check in";
        if (wrongNetwork) return "Switch to Sei EVM";
        if (isBalanceLoading) return "Loading balance…";
        if (frogBalanceRaw == null) return "Cannot load balance…";
        if (isSimPreparing) return "Preparing…";
        if (isCheckInPending || isConfirmingTx) return "Checking in...";
        if (hasCheckedInToday) return "Checked in ✓";
        if (!hasIncreasedBalance) {
            return lastCheckInDay === 0 ? "First check-in" : "Balance must be higher than last check-in";
        }
        return "Check in";
    }, [
        uiConnected,
        wrongNetwork,
        isBalanceLoading,
        frogBalanceRaw,
        isSimPreparing,
        isCheckInPending,
        isConfirmingTx,
        hasCheckedInToday,
        hasIncreasedBalance,
        lastCheckInDay,
    ]);

    const checkInColor: string = (() => {
        if (!uiConnected) return "bg-[#3c3c3c] text-white/60 border border-white/10";
        if (wrongNetwork) return "bg-yellow-500 text-black hover:bg-yellow-400";
        if (isBalanceLoading || isSimPreparing) return "bg-brand-primary/40 text-black/60 animate-pulse";
        if (frogBalanceRaw == null) return "bg-yellow-300 text-black hover:bg-yellow-200";
        if (isCheckInPending || isConfirmingTx) return "bg-brand-primary/70 text-black animate-pulse";
        if (hasCheckedInToday) return "bg-[#6EB819] text-[#031f18] hover:bg-[#63a417]";
        if (!hasIncreasedBalance) return "bg-[#e86a6a] text-black hover:bg-[#d45d5d]";
        return "bg-brand-primary text-[#081318] hover:scale-[1.02]";
    })();

    const showCheckInError =
        !!(localCheckInError || txErrorMessage) &&
        !wrongNetwork &&
        !hasCheckedInToday &&
        didAttemptCheckIn &&
        uiConnected;

    // =====================================================================
    // REWARDS (WRITE): single smart action button
    // =====================================================================

    const {
        data: rewardsTxHash,
        writeContractAsync: writeRewardsAsync,
        error: rewardsWriteError,
        isPending: isRewardsPending,
    } = useWriteContract();

    const { isLoading: isRewardsConfirming, isSuccess: isRewardsConfirmed } = useWaitForTransactionReceipt({
        chainId: SEI_EVM_CHAIN_ID,
        hash: rewardsTxHash,
        query: { enabled: !!rewardsTxHash },
    });

    const [rewardsLocalError, setRewardsLocalError] = useState<string | null>(null);
    const rewardsErrorMessage = useMemo(
        () => rewardsLocalError ?? pickErrorMessage(rewardsWriteError),
        [rewardsLocalError, rewardsWriteError]
    );

    useEffect(() => {
        if (!isRewardsConfirmed) return;

        let cancelled = false;

        (async () => {
            await refetchWithRetry(() => refetchRewards(), 3, 350);
            await refetchWithRetry(() => refetchFrogBalance(), 3, 350);
            if (!cancelled) setRewardsLocalError(null);
        })();

        return () => {
            cancelled = true;
        };
    }, [isRewardsConfirmed, refetchRewards, refetchFrogBalance]);

    const rewardsBusy = isRewardsPending || isRewardsConfirming;

    // Decide what the button does:
    // 1) If canAccrueToday => accrue()
    // 2) else if claimable > 0 => claim()
    // 3) else => disabled
    const rewardsAction = useMemo<"ACCRUE" | "CLAIM" | "NONE">(() => {
        if (!uiConnected || wrongNetwork) return "NONE";
        if (rewardsLoading || rewardsBusy) return "NONE";
        if (rCanAccrueToday) return "ACCRUE";
        if (claimableBI > 0n) return "CLAIM";
        return "NONE";
    }, [uiConnected, wrongNetwork, rewardsLoading, rewardsBusy, rCanAccrueToday, claimableBI]);

    const rewardsActionDisabled =
        !uiConnected || wrongNetwork || rewardsLoading || rewardsBusy || rewardsAction === "NONE";

    // FIX #3: label reflects why it's NONE (not always "completed")
    const rewardsActionLabel = useMemo(() => {
        if (!uiConnected) return "Connect wallet";
        if (wrongNetwork) return "Switch to Sei EVM";
        if (rewardsLoading) return "Loading…";
        if (rewardsBusy) return "Working…";
        if (rCanAccrueToday) return "Compound Earnings";
        if (claimableBI > 0n) return "Withdraw Rewards";
        if (!rIsActive) return "Check in to activate";
        return "Actions Completed";
    }, [uiConnected, wrongNetwork, rewardsLoading, rewardsBusy, rCanAccrueToday, claimableBI, rIsActive]);

    const rewardsActionTone = useMemo(() => {
        if (rewardsActionDisabled) return "bg-white/5 text-brand-text border border-white/15 opacity-40 cursor-not-allowed";
        if (rewardsAction === "ACCRUE") return "bg-brand-secondary text-white hover:scale-[1.02] border-transparent";
        return "bg-brand-primary text-[#081318] hover:scale-[1.02] border-transparent";
    }, [rewardsActionDisabled, rewardsAction]);

    // FIX #4: simulate rewards tx before sending (like check-in)
    const handleRewardsAction = async () => {
        if (!address || wrongNetwork) return;
        if (rewardsActionDisabled) return;

        setRewardsLocalError(null);

        try {
            const fn = rewardsAction === "ACCRUE" ? "accrue" : "claim";

            if (publicClient) {
                const sim = await publicClient.simulateContract({
                    address: FROGGY_REWARDS_ADDRESS,
                    abi: FROGGY_REWARDS_ABI,
                    functionName: fn,
                    account: address,
                });
                await writeRewardsAsync(sim.request);
                return;
            }

            await writeRewardsAsync({
                chainId: SEI_EVM_CHAIN_ID,
                address: FROGGY_REWARDS_ADDRESS,
                abi: FROGGY_REWARDS_ABI,
                functionName: fn,
                account: address,
            });
        } catch (e) {
            setRewardsLocalError(pickErrorMessage(e) || "Rewards action failed.");
        }
    };

    // =====================================================================

    return (
        <div className="min-h-screen w-full bg-brand-bg text-brand-text">
            <main className="mx-auto max-w-5xl px-4 py-8">
                {/* Header row */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Froggy Dashboard</h1>

                            <Link
                                href="/"
                                className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3.5 py-1.5 text-xs md:text-sm font-medium text-brand-subtle border border-white/15 hover:bg-white/10 hover:border-white/30 transition-colors"
                            >
                                <span className="text-base leading-none">←</span>
                                <span>Back to landing</span>
                            </Link>
                        </div>
                        <p className="mt-2 text-sm text-brand-subtle">
                            Lock in your daily $FROG streak and earn on-chain rewards over time.
                        </p>
                    </div>

                    <div className="hidden md:block">
                        <WalletButton />
                    </div>
                </div>

                <div className="mt-4 md:hidden">
                    <WalletButton />
                </div>

                {/* Hydration-safe: render a stable section until mounted */}
                {!mounted && (
                    <section className="mt-8 rounded-2xl border border-white/10 bg-brand-card/70 p-6">
                        <h2 className="text-lg font-semibold">Loading wallet…</h2>
                        <p className="mt-2 text-sm text-brand-subtle">Syncing your wallet state.</p>
                    </section>
                )}

                {mounted && !uiConnected && (
                    <section className="mt-8 rounded-2xl border border-white/10 bg-brand-card/70 p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">Connect your wallet</h2>
                                <p className="mt-2 text-sm text-brand-subtle">
                                    Connect a Sei EVM wallet to start tracking your streak and unlocking rewards.
                                </p>

                                <ol className="mt-4 space-y-1.5 text-xs text-brand-subtle">
                                    <li>1. Click &quot;Connect wallet&quot;.</li>
                                    <li>2. Approve the request in your wallet.</li>
                                    <li>3. Come back once per day to extend your streak.</li>
                                </ol>
                            </div>

                            <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-brand-subtle border border-white/10">
                                🔒 Wallet required
                            </span>
                        </div>

                        <div className="mt-5 hidden md:block">
                            <WalletButton />
                        </div>
                    </section>
                )}

                {mounted && uiConnected && (
                    <>
                        {/* Wallet + streak status */}
                        <section className="mt-8 grid gap-4 md:grid-cols-[2fr,1.3fr]">
                            {/* Wallet card */}
                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold tracking-tight">Your wallet</h2>

                                    <div className="flex items-center gap-2">
                                        <Link
                                            href="/dashboard/faq"
                                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/10 transition"
                                        >
                                            FAQ
                                        </Link>

                                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-brand-subtle border border-white/10">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                            {isOnSeiEvm ? "Sei EVM mainnet" : chainId ? `Chain ID: ${chainId}` : "Chain: Unknown"}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-3 space-y-2 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-brand-subtle">Address:</span>
                                        <code className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[13px]">
                                            {shortAddress}
                                        </code>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-brand-subtle">Balance:</span>
                                        <span className="text-sm font-mono">
                                            {isBalanceLoading || wrongNetwork
                                                ? "Loading…"
                                                : `${frogBalance.toLocaleString(undefined, {
                                                    maximumFractionDigits: 4,
                                                    minimumFractionDigits: 0,
                                                })} FROG`}
                                        </span>
                                    </div>

                                    <p className="mt-1 text-xs text-brand-subtle">
                                        This address is used to track your streaks and claim rewards.
                                    </p>

                                    {wrongNetwork && (
                                        <p className="mt-3 text-xs text-yellow-300">
                                            You are on the wrong network. Switch to the Sei EVM mainnet (chain ID {SEI_EVM_CHAIN_ID}) to use
                                            streaks.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Streak status card */}
                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold tracking-tight">Streak status</h2>
                                    <span
                                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${streakStatus.tone}`}
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                        {streakStatus.label}
                                    </span>
                                </div>

                                <div className="mt-3 text-sm">
                                    <p className="text-brand-subtle text-xs">Daily reset time: 00:00 UTC</p>
                                    <p className="mt-1 text-xs text-brand-subtle">Missing a day will reset your current streak back to 1.</p>
                                    <p className="mt-1 text-[11px] text-brand-subtle">
                                        Streak rule: your FROG balance must be higher than it was at your last successful check-in.
                                    </p>
                                    {isUserError && !wrongNetwork && (
                                        <p className="mt-2 text-xs text-red-400">
                                            Could not load streak data. Make sure you&apos;re on the correct network.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Streak overview metrics */}
                        <section className="mt-8 grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-4 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-brand-subtle">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[13px] opacity-70">🔥</span>
                                        <span>Current streak</span>
                                    </div>
                                    {currentStreak > 0 && !wrongNetwork && !isLoadingUser && (
                                        <span className="rounded-full bg-brand-secondary/5 px-2 py-0.5 text-[10px] font-medium text-brand-secondary">
                                            Live
                                        </span>
                                    )}
                                </div>

                                <div className="mt-2 text-3xl font-bold">
                                    {isLoadingUser || wrongNetwork ? "…" : currentStreak}
                                    {!isLoadingUser && !wrongNetwork && currentStreak > 0 && (
                                        <span className="ml-1 text-base font-semibold text-brand-subtle">d</span>
                                    )}
                                </div>

                                <div className="mt-1 text-xs text-brand-subtle">Consecutive days you&apos;ve checked in.</div>

                                {!isLoadingUser && !wrongNetwork && (
                                    <div className="mt-0.5 text-[11px] text-brand-subtle/80">{lastCheckInSummary}</div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-4 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-brand-subtle">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[13px] opacity-70">🏆</span>
                                        <span>Best streak</span>
                                    </div>
                                    {!isLoadingUser && !wrongNetwork && currentStreak > 0 && currentStreak === bestStreak && (
                                        <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold text-brand-primary">
                                            New high
                                        </span>
                                    )}
                                </div>
                                <div className="mt-2 text-3xl font-bold">
                                    {isLoadingUser || wrongNetwork ? "…" : bestStreak}
                                    {!isLoadingUser && !wrongNetwork && bestStreak > 0 && (
                                        <span className="ml-1 text-base font-semibold text-brand-subtle">d</span>
                                    )}
                                </div>
                                <div className="mt-1 text-xs text-brand-subtle">Your longest streak so far.</div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-4 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-brand-subtle">
                                    <span className="text-[13px] opacity-70">✅</span>
                                    <span>Total check-ins</span>
                                </div>
                                <div className="mt-2 text-3xl font-bold flex items-baseline gap-1">
                                    <span>{isLoadingUser || wrongNetwork ? "…" : totalCheckIns}</span>
                                    {!isLoadingUser && !wrongNetwork && totalCheckIns > 0 && (
                                        <span className="text-base font-semibold text-brand-subtle">checks</span>
                                    )}
                                </div>
                                <div className="mt-1 text-xs text-brand-subtle">Successful daily check-ins recorded on-chain.</div>
                            </div>
                        </section>

                        {/* Actions: check-in + milestones + rewards */}
                        <section className="mt-8 rounded-2xl border border-white/10 bg-brand-card/80 p-6 space-y-5 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-semibold">Daily check-in</h2>
                                        <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-brand-subtle border border-white/10">
                                            1 per day
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-brand-subtle">Check in once per day to extend your streak.</p>
                                </div>

                                <div className="flex flex-col items-stretch md:items-end gap-1 max-w-xs w-full md:w-auto">
                                    <button
                                        type="button"
                                        onClick={handleCheckIn}
                                        disabled={checkInDisabled}
                                        className={`rounded-xl px-5 py-2.5 text-sm font-semibold
                      transition-transform focus:outline-none focus:ring-2 focus:ring-brand-primary/50
                      disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed
                      hover:translate-y-[-1px] active:translate-y-[0px]
                      ${checkInColor}`}
                                    >
                                        {checkInLabel}
                                    </button>

                                    {showCheckInError && (
                                        <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                                            <div className="font-semibold mb-1">Check-in error</div>
                                            <div className="break-words">{localCheckInError || txErrorMessage}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Milestone badges */}
                            <section className="mt-2 rounded-2xl border border-white/10 bg-brand-card/70 p-6">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold">Milestone badges</h2>
                                        <p className="mt-1 text-xs text-brand-subtle leading-tight">
                                            Earn badges when your <span className="text-brand-text">best streak</span> hits each milestone.
                                            Progress fills based on your current streak.
                                        </p>
                                    </div>

                                    <span className="hidden sm:inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-brand-subtle border border-white/10">
                                        {isLoadingUser || wrongNetwork ? "Loading…" : `Best: ${bestStreak}d`}
                                    </span>
                                </div>

                                {wrongNetwork || isLoadingUser ? (
                                    <p className="mt-4 text-xs text-brand-subtle leading-tight">Connect on Sei EVM to view badge progress.</p>
                                ) : (
                                    <>
                                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                            {milestoneBadges.map((b) => {
                                                const tone = b.earned
                                                    ? "border-brand-primary/40 bg-brand-primary/10 text-brand-text"
                                                    : "border-white/10 bg-black/10 text-brand-subtle";

                                                return (
                                                    <div key={b.days} className={`rounded-xl border p-3 text-center ${tone}`}>
                                                        <div className="text-[11px] uppercase tracking-wide opacity-80">
                                                            {b.earned ? "Unlocked" : "Locked"}
                                                        </div>

                                                        <div className="mt-1 text-lg font-bold">{b.days}d</div>

                                                        <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full bg-brand-primary"
                                                                style={{ width: `${Math.round(b.progress * 100)}%` }}
                                                            />
                                                        </div>

                                                        <div className="mt-1 text-[10px] text-brand-subtle">
                                                            {b.earned
                                                                ? "Earned"
                                                                : currentStreak > 0
                                                                    ? `${Math.min(currentStreak, b.days)}/${b.days}`
                                                                    : "Start a streak"}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <p className="mt-3 text-[11px] text-brand-subtle/80 leading-tight">
                                            Badges don’t disappear if you miss a day—once earned, you keep them.
                                        </p>
                                    </>
                                )}
                            </section>

                            {/* Rewards */}
                            <div className="mt-4 border-t border-white/10 pt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold">Rewards</h3>
                                        <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary border border-brand-primary/20">
                                            Live
                                        </span>
                                    </div>

                                    <p className="mt-1 text-xs text-brand-subtle">
                                        Compound moves today’s reward into your claimable. Claim transfers your rewards to your wallet.
                                    </p>

                                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                                            <div className="text-[11px] uppercase tracking-wide text-brand-subtle">Tier APR</div>
                                            <div className="mt-1 text-sm font-mono">
                                                {wrongNetwork || rewardsLoading ? "…" : `${aprPct.toFixed(2)}%`}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                                            <div className="text-[11px] uppercase tracking-wide text-brand-subtle">Snapshot balance</div>
                                            <div className="mt-1 text-sm font-mono">
                                                {wrongNetwork || rewardsLoading
                                                    ? "…"
                                                    : `${snapshotBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} FROG`}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                                            <div className="text-[11px] uppercase tracking-wide text-brand-subtle">Compoundable</div>
                                            <div className="mt-1 text-sm font-mono">
                                                {wrongNetwork || rewardsLoading
                                                    ? "…"
                                                    : rCanAccrueToday
                                                        ? `${rewardToday.toLocaleString(undefined, { maximumFractionDigits: 6 })} FROG`
                                                        : rIsActive
                                                            ? "Already compounded"
                                                            : "Check in today"}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                                            <div className="text-[11px] uppercase tracking-wide text-brand-subtle">Claimable</div>
                                            <div className="mt-1 text-sm font-mono">
                                                {wrongNetwork || rewardsLoading
                                                    ? "…"
                                                    : `${claimable.toLocaleString(undefined, { maximumFractionDigits: 6 })} FROG`}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 text-[11px] text-brand-subtle/80">
                                        Pool balance:{" "}
                                        <span className="text-brand-text font-medium">
                                            {wrongNetwork || rewardsLoading
                                                ? "…"
                                                : `${poolBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} FROG`}
                                        </span>
                                        {" • "}
                                        Active streak today:{" "}
                                        <span className="text-brand-text font-medium">
                                            {wrongNetwork || rewardsLoading ? "…" : rIsActive ? "Yes" : "No"}
                                        </span>
                                        {" • "}
                                        Compound available:{" "}
                                        <span className="text-brand-text font-medium">
                                            {wrongNetwork || rewardsLoading ? "…" : rCanAccrueToday ? "Yes" : "No"}
                                        </span>
                                    </div>

                                    {!!rewardsErrorMessage && !wrongNetwork && (
                                        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                                            <div className="font-semibold mb-1">Rewards error</div>
                                            <div className="break-words">{rewardsErrorMessage}</div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-stretch md:items-end gap-2 md:min-w-[220px] md:mt-2">
                                    <button
                                        type="button"
                                        onClick={handleRewardsAction}
                                        disabled={rewardsActionDisabled}
                                        className={`rounded-xl px-5 py-2.5 text-sm font-semibold border transition ${rewardsActionTone}`}
                                    >
                                        {rewardsActionLabel}
                                    </button>

                                    {/* FIX #7: disable refresh when disconnected */}
                                    <button
                                        type="button"
                                        onClick={() => refetchRewards()}
                                        disabled={!uiConnected || wrongNetwork || rewardsLoading}
                                        className="rounded-xl px-5 py-2.5 text-xs font-semibold bg-white/5 text-brand-text border border-white/15 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10 transition"
                                    >
                                        Refresh rewards
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Market snapshot */}
                        <section className="mt-8 rounded-2xl border border-white/10 bg-brand-card/70 p-6">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div>
                                    <h2 className="text-lg font-semibold">Market snapshot</h2>
                                    <p className="text-xs text-brand-subtle">Quick view of $FROG stats while you manage your streaks.</p>
                                </div>
                                <span className="hidden sm:inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-brand-subtle border border-white/10">
                                    Live on-chain data
                                </span>
                            </div>

                            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                                <LiveStats />
                            </div>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}