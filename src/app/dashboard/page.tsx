"use client";

import { useEffect, useMemo, useState } from "react";
import {
    useAccount,
    useReadContract,
    useWriteContract,
    useWaitForTransactionReceipt,
} from "wagmi";
import { WalletButton } from "../providers";
import LiveStats from "@/components/LiveStats";

// ===== CONSTANTS =====
const SEI_EVM_CHAIN_ID = 1329 as const; // Sei EVM mainnet chain id
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// ===== CONTRACT ADDRESSES =====
// V1 0xB5668295f6A7174ca3813fFf59f822B595Cf65fE
// v2 0x691ada7728fD5BDC50203d58dA3AbF2BC91c5C41
const FROGGY_STREAK_ADDRESS =
    "0x691ada7728fD5BDC50203d58dA3AbF2BC91c5C41" as const;
const FROG_TOKEN_ADDRESS =
    "0xF9BDbF259eCe5ae17e29BF92EB7ABd7B8b465Db9" as const; // FROG token on Sei EVM

// ===== ABIs =====
const FROGGY_STREAK_ABI = [
    {
        inputs: [{ internalType: "address", name: "user", type: "address" }],
        name: "getUserState",
        outputs: [
            { internalType: "uint32", name: "currentStreak", type: "uint32" },
            { internalType: "uint32", name: "bestStreak", type: "uint32" },
            { internalType: "uint32", name: "totalCheckIns", type: "uint32" },
            { internalType: "uint64", name: "lastCheckInDay", type: "uint64" },
            { internalType: "uint256", name: "lastRecordedBalance", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "checkIn",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

const ERC20_ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "decimals",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
    },
] as const;

// uint32 -> number, uint64/uint256 -> bigint
type UserStateTuple = readonly [number, number, number, bigint, bigint];

function normalizeUserState(userState: UserStateTuple | undefined) {
    if (!userState) {
        return {
            currentStreak: 0,
            bestStreak: 0,
            totalCheckIns: 0,
            lastCheckInDay: null as number | null,
            lastRecordedBalance: null as bigint | null,
        };
    }

    return {
        currentStreak: userState[0],
        bestStreak: userState[1],
        totalCheckIns: userState[2],
        lastCheckInDay: Number(userState[3]),
        lastRecordedBalance: userState[4],
    };
}

export default function DashboardPage() {
    const { address, isConnected, chainId } = useAccount();

    const isOnSeiEvm = chainId === SEI_EVM_CHAIN_ID;
    const wrongNetwork =
        chainId !== undefined && chainId !== null && !isOnSeiEvm;

    const shortAddress = useMemo(() => {
        if (!address) return "";
        if (address.length <= 10) return address;
        return `${address.slice(0, 6)}…${address.slice(-4)}`;
    }, [address]);

    // ===== READ: getUserState (streak contract) =====
    const {
        data: userStateRaw,
        isLoading: isLoadingUser,
        isError: isUserError,
        refetch: refetchUserState,
    } = useReadContract({
        address: FROGGY_STREAK_ADDRESS,
        abi: FROGGY_STREAK_ABI,
        functionName: "getUserState",
        args: [address ?? ZERO_ADDRESS],
        query: {
            enabled: !!address && !wrongNetwork,
        },
    });

    const {
        currentStreak,
        bestStreak,
        totalCheckIns,
        lastCheckInDay,
        lastRecordedBalance,
    } = normalizeUserState(userStateRaw as UserStateTuple | undefined);

    // Track today's UTC day index once on the client
    const [currentUtcDay, setCurrentUtcDay] = useState<number | null>(null);

    useEffect(() => {
        const nowSeconds = Date.now() / 1000;
        const dayIndex = Math.floor(nowSeconds / 86400);

        // wrap state update in a microtask for safer hydration
        Promise.resolve().then(() => setCurrentUtcDay(dayIndex));
    }, []);

    // Has user already checked in today (UTC)?
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

        // Fallback for any weirdness
        return "Last check-in: recently.";
    }, [isLoadingUser, wrongNetwork, lastCheckInDay, currentUtcDay, totalCheckIns]);

    const historyWindow = useMemo(
        () => {
            // Need real data + a known "today"
            if (
                currentUtcDay === null ||
                lastCheckInDay === null ||
                totalCheckIns === 0
            ) {
                return [] as {
                    dayIndex: number;
                    label: string;
                    status: "checked" | "missed";
                }[];
            }

            // Streak days run from streakStartDay → lastCheckInDay (inclusive)
            const streakStartDay =
                currentStreak > 0 ? lastCheckInDay - (currentStreak - 1) : null;

            const days: {
                dayIndex: number;
                label: string;
                status: "checked" | "missed";
            }[] = [];

            // Build a 7-day window ending today (oldest → newest)
            for (let offset = 6; offset >= 0; offset--) {
                const dayIndex = currentUtcDay - offset;
                const diff = currentUtcDay - dayIndex;

                let label: string;
                if (diff === 0) label = "Today";
                else if (diff === 1) label = "Yesterday";
                else label = `${diff}d ago`;

                let status: "checked" | "missed" = "missed";

                if (
                    streakStartDay !== null &&
                    dayIndex >= streakStartDay &&
                    dayIndex <= lastCheckInDay
                ) {
                    status = "checked";
                }

                days.push({ dayIndex, label, status });
            }

            return days;
        },
        [currentUtcDay, lastCheckInDay, currentStreak, totalCheckIns],
    );


    const streakStatus = useMemo(
        () =>
            currentStreak === 0
                ? {
                    label: "Inactive",
                    tone: "bg-red-500/15 text-red-300 border-red-500/30",
                }
                : {
                    label: "Active",
                    tone: "bg-brand-primary/15 text-brand-primary border-brand-primary/40",
                },
        [currentStreak],
    );

    // ===== READ: FROG token balance =====
    const {
        data: frogBalanceRaw,
        isLoading: isLoadingBalance,
    } = useReadContract({
        address: FROG_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address ?? ZERO_ADDRESS],
        query: { enabled: !!address && !wrongNetwork },
    });

    const {
        data: frogDecimalsRaw,
        isLoading: isLoadingDecimals,
    } = useReadContract({
        address: FROG_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "decimals",
        args: [],
    });

    const isBalanceLoading = isLoadingBalance || isLoadingDecimals;

    const frogBalance = useMemo(() => {
        if (!frogBalanceRaw || frogDecimalsRaw === undefined) return 0;
        const decimals =
            typeof frogDecimalsRaw === "number"
                ? frogDecimalsRaw
                : Number(frogDecimalsRaw);
        return Number(frogBalanceRaw as bigint) / 10 ** decimals;
    }, [frogBalanceRaw, frogDecimalsRaw]);

    // Check if current raw balance > lastRecordedBalance (both in raw units)
    const hasIncreasedBalance: boolean = useMemo(() => {
        if (frogBalanceRaw === undefined || frogBalanceRaw === null) return true;
        if (lastRecordedBalance === null) return true; // let contract enforce for first-time users
        return (frogBalanceRaw as bigint) > lastRecordedBalance;
    }, [frogBalanceRaw, lastRecordedBalance]);

    // ===== WRITE: checkIn() =====
    const {
        data: txHash,
        writeContract,
        isPending: isCheckInPending,
    } = useWriteContract();

    const {
        isLoading: isConfirmingTx,
        isSuccess: isTxConfirmed,
    } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    // After confirmed check-in tx, refetch streak state
    useEffect(() => {
        if (isTxConfirmed) {
            refetchUserState();
        }
    }, [isTxConfirmed, refetchUserState]);

    const handleCheckIn = () => {
        if (!address || wrongNetwork) return;
        writeContract({
            address: FROGGY_STREAK_ADDRESS,
            abi: FROGGY_STREAK_ABI,
            functionName: "checkIn",
            account: address,
        });
    };

    const checkInDisabled =
        !isConnected ||
        wrongNetwork ||
        isBalanceLoading ||
        isCheckInPending ||
        isConfirmingTx ||
        hasCheckedInToday ||
        !hasIncreasedBalance;

    const checkInLabel: string = (() => {
        if (!isConnected) return "Connect wallet to check in";
        if (wrongNetwork) return "Switch to Sei EVM";
        if (isBalanceLoading) return "Loading balance…";
        if (isCheckInPending || isConfirmingTx) return "Checking in...";
        if (hasCheckedInToday) return "Checked in ✓";
        if (!hasIncreasedBalance) return "Increase your FROG balance to check in";
        return "Check in for today";
    })();

    const checkInColor: string = (() => {
        if (!isConnected) {
            return "bg-[#3c3c3c] text-white/60 border border-white/10";
        }
        if (wrongNetwork) {
            return "bg-yellow-500 text-black hover:bg-yellow-400";
        }
        if (isBalanceLoading) {
            return "bg-brand-primary/40 text-black/60 animate-pulse";
        }
        if (isCheckInPending || isConfirmingTx) {
            return "bg-brand-primary/70 text-black animate-pulse";
        }
        if (hasCheckedInToday) {
            // Success / completed — FROGGY GREEN
            return "bg-[#6EB819] text-[#031f18] hover:bg-[#63a417]";
        }
        if (!hasIncreasedBalance) {
            // Froggy blush
            return "bg-[#e86a6a] text-black hover:bg-[#d45d5d]";
        }
        // Ready
        return "bg-brand-primary text-[#081318] hover:scale-[1.02]";
    })();

    return (
        <div className="min-h-screen w-full bg-brand-bg text-brand-text">
            <main className="mx-auto max-w-5xl px-4 py-8">
                {/* Header row */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                                Froggy Dashboard
                            </h1>

                            <a
                                href="/"
                                className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3.5 py-1.5 text-xs md:text-sm font-medium text-brand-subtle border border-white/15 hover:bg-white/10 hover:border-white/30 transition-colors"
                            >
                                <span className="text-base leading-none">←</span>
                                <span>Back to landing</span>
                            </a>
                        </div>
                        <p className="mt-2 text-sm text-brand-subtle">
                            Lock in your daily $FROG streak and earn on-chain rewards over time.
                        </p>
                    </div>

                    {/* Desktop wallet button */}
                    <div className="hidden md:block">
                        <WalletButton />
                    </div>
                </div>

                {/* Mobile wallet button (single CTA on small screens) */}
                <div className="mt-4 md:hidden">
                    <WalletButton />
                </div>

                {/* If not connected, guard the rest of the page */}
                {!isConnected && (
                    <section className="mt-8 rounded-2xl border border-white/10 bg-brand-card/70 p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">Connect your wallet</h2>
                                <p className="mt-2 text-sm text-brand-subtle">
                                    Connect a Sei EVM wallet to start tracking your streak and unlocking
                                    rewards.
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

                        {/* Extra CTA on desktop only (no duplicate on mobile) */}
                        <div className="mt-5 hidden md:block">
                            <WalletButton />
                        </div>
                    </section>
                )}

                {/* Main content when connected */}
                {isConnected && (
                    <>
                        {/* Wallet + streak status */}
                        <section className="mt-8 grid gap-4 md:grid-cols-[2fr,1.3fr]">
                            {/* Wallet card */}
                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold tracking-tight">
                                        Your wallet
                                    </h2>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-brand-subtle border border-white/10">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        {isOnSeiEvm
                                            ? "Sei EVM mainnet"
                                            : chainId
                                                ? `Chain ID: ${chainId}`
                                                : "Chain: Unknown"}
                                    </span>
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
                                            {frogBalance.toLocaleString(undefined, {
                                                maximumFractionDigits: 4,
                                                minimumFractionDigits: 0,
                                            })}{" "}
                                            FROG
                                        </span>
                                    </div>

                                    <p className="mt-1 text-xs text-brand-subtle">
                                        This address is used to track your streaks and send rewards once
                                        they go live.
                                    </p>

                                    {wrongNetwork && (
                                        <p className="mt-3 text-xs text-yellow-300">
                                            You are on the wrong network. Switch to the Sei EVM mainnet
                                            (chain ID {SEI_EVM_CHAIN_ID}) to use streaks.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Streak status card */}
                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-5">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold tracking-tight">
                                        Streak status
                                    </h2>
                                    <span
                                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${streakStatus.tone}`}
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                        {streakStatus.label}
                                    </span>
                                </div>

                                <div className="mt-3 text-sm">
                                    <p className="text-brand-subtle text-xs">
                                        Daily reset time: 00:00 UTC
                                    </p>
                                    <p className="mt-1 text-xs text-brand-subtle">
                                        Missing a day will reset your current streak back to 1.
                                    </p>
                                    <p className="mt-1 text-[11px] text-brand-subtle">
                                        Streak rule: your FROG balance must be higher than it was at your
                                        last successful check-in.
                                    </p>
                                    {isUserError && !wrongNetwork && (
                                        <p className="mt-2 text-xs text-red-400">
                                            Could not load streak data. Make sure you&apos;re on the
                                            correct network.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Streak overview metrics */}
                        <section className="mt-8 grid gap-4 md:grid-cols-3">
                            {/* Current streak */}
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
                                        <span className="ml-1 text-base font-semibold text-brand-subtle">
                                            d
                                        </span>
                                    )}
                                </div>

                                <div className="mt-1 text-xs text-brand-subtle">
                                    Consecutive days you&apos;ve checked in.
                                </div>

                                {!isLoadingUser && !wrongNetwork && (
                                    <div className="mt-0.5 text-[11px] text-brand-subtle/80">
                                        {lastCheckInSummary}
                                    </div>
                                )}
                            </div>

                            {/* Best streak */}
                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-4 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-brand-subtle">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[13px] opacity-70">🏆</span>
                                        <span>Best streak</span>
                                    </div>
                                    {!isLoadingUser &&
                                        !wrongNetwork &&
                                        currentStreak > 0 &&
                                        currentStreak === bestStreak && (
                                            <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold text-brand-primary">
                                                New high
                                            </span>
                                        )}
                                </div>
                                <div className="mt-2 text-3xl font-bold">
                                    {isLoadingUser || wrongNetwork ? "…" : bestStreak}
                                    {!isLoadingUser && !wrongNetwork && bestStreak > 0 && (
                                        <span className="ml-1 text-base font-semibold text-brand-subtle">
                                            d
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1 text-xs text-brand-subtle">
                                    Your longest streak so far.
                                </div>
                            </div>

                            {/* Total check-ins */}
                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-4 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-brand-subtle">
                                    <span className="text-[13px] opacity-70">✅</span>
                                    <span>Total check-ins</span>
                                </div>
                                <div className="mt-2 text-3xl font-bold flex items-baseline gap-1">
                                    <span>
                                        {isLoadingUser || wrongNetwork ? "…" : totalCheckIns}
                                    </span>
                                    {!isLoadingUser &&
                                        !wrongNetwork &&
                                        totalCheckIns > 0 && (
                                            <span className="text-base font-semibold text-brand-subtle">
                                                checks
                                            </span>
                                        )}
                                </div>
                                <div className="mt-1 text-xs text-brand-subtle">
                                    Successful daily check-ins recorded on-chain.
                                </div>
                            </div>
                        </section>

                        {/* Actions: check-in + claim */}
                        <section className="mt-8 rounded-2xl border border-white/10 bg-brand-card/80 p-6 space-y-5 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-semibold">Daily check-in</h2>
                                        <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-brand-subtle border border-white/10">
                                            1 per day
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-brand-subtle">
                                        Check in once per day to extend your streak.
                                    </p>
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
                                </div>
                            </div>
                            {/* Streak history (last 7 days preview) */}
                            <section className="mt-8 rounded-2xl border border-white/10 bg-brand-card/70 p-6">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold">Streak history</h2>
                                        <p className="mt-1 text-xs text-brand-subtle leading-tight">
                                            Snapshot of your last 7 days based on on-chain check-ins.
                                        </p>
                                    </div>

                                    <div className="hidden sm:flex items-center gap-3 text-[11px] text-brand-subtle">
                                        <span className="inline-flex items-center gap-1">
                                            <span className="h-2 w-2 rounded-full bg-[#6EB819]" />
                                            <span>Checked in</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="h-2 w-2 rounded-full bg-white/15" />
                                            <span>Missed / no activity</span>
                                        </span>
                                    </div>
                                </div>

                                {historyWindow.length === 0 || wrongNetwork || isLoadingUser ? (
                                    <p className="mt-4 text-xs text-brand-subtle leading-tight">
                                        Once you start checking in on Sei EVM, your recent 7-day pattern will show up here.
                                    </p>
                                ) : (
                                    <div className="mt-4 flex flex-col gap-3">
                                        <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-3">
                                            {historyWindow.map((day) => {
                                                const isToday =
                                                    currentUtcDay !== null && day.dayIndex === currentUtcDay;

                                                return (
                                                    <div
                                                        key={day.dayIndex}
                                                        className={[
                                                            "flex flex-col items-center justify-center",
                                                            "rounded-xl border px-3 py-2.5 min-w-[72px] text-center",
                                                            "border-white/5 bg-transparent",
                                                            isToday ? "border-white/15 bg-white/[0.03]" : "",
                                                        ].join(" ")}
                                                    >
                                                        <span
                                                            className={[
                                                                "mb-1 rounded-full h-2 w-2",
                                                                day.status === "checked"
                                                                    ? "bg-[#6EB819]"
                                                                    : "bg-white/15",
                                                            ].join(" ")}
                                                        />
                                                        <span
                                                            className={[
                                                                "text-[11px] font-medium",
                                                                isToday ? "text-brand-text" : "text-brand-text/90",
                                                            ].join(" ")}
                                                        >
                                                            {day.label}
                                                        </span>
                                                        <span className="mt-0.5 text-[10px] text-brand-subtle">
                                                            {day.status === "checked" ? "Checked in" : "No check-in"}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <p className="text-[11px] text-brand-subtle/80 leading-tight">
                                            Streaks reset when you miss a day. The green dots show the continuous run
                                            that built your current streak.
                                        </p>
                                    </div>
                                )}
                            </section>

                            <div className="mt-4 border-t border-white/10 pt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold">Rewards</h3>
                                        <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-brand-subtle border border-white/10">
                                            Coming soon
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-brand-subtle">
                                        Once streak milestones are live, you&apos;ll be able to claim
                                        on-chain rewards here based on your best streak and total
                                        check-ins.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    disabled
                                    className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-white/5 text-brand-text border border-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Claim reward
                                </button>
                            </div>
                        </section>

                        {/* Market snapshot */}
                        <section className="mt-8 rounded-2xl border border-white/10 bg-brand-card/70 p-6">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div>
                                    <h2 className="text-lg font-semibold">Market snapshot</h2>
                                    <p className="text-xs text-brand-subtle">
                                        Quick view of $FROG stats while you manage your streaks.
                                    </p>
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
