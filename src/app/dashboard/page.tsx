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
const SEI_EVM_CHAIN_ID = 1329; // Sei EVM mainnet chain id

// ===== CONTRACT ADDRESSES =====
const FROGGY_STREAK_ADDRESS = "0xB5668295f6A7174ca3813fFf59f822B595Cf65fE" as const;
const FROG_TOKEN_ADDRESS = "0xF9BDbF259eCe5ae17e29BF92EB7ABd7B8b465Db9" as const; // FROG token on Sei EVM

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

export default function DashboardPage() {
    const { address, isConnected, chainId } = useAccount();

    const shortAddress = useMemo(() => {
        if (!address) return "";
        if (address.length <= 10) return address;
        return `${address.slice(0, 6)}…${address.slice(-4)}`;
    }, [address]);

    const wrongNetwork =
        chainId !== undefined &&
        chainId !== null &&
        chainId !== SEI_EVM_CHAIN_ID;

    // ===== READ: getUserState (streak contract) =====
    const {
        data: userState,
        isLoading: isLoadingUser,
        isError: isUserError,
        refetch: refetchUserState,
    } = useReadContract({
        address: FROGGY_STREAK_ADDRESS,
        abi: FROGGY_STREAK_ABI,
        functionName: "getUserState",
        args: [address ?? "0x0000000000000000000000000000000000000000"],
        query: {
            enabled: !!address && !wrongNetwork,
        },
    });

    let currentStreak = 0;
    let bestStreak = 0;
    let totalCheckIns = 0;
    let lastCheckInDay: number | null = null; // NEW

    if (userState) {
        const u = userState as UserStateTuple;
        currentStreak = u[0];
        bestStreak = u[1];
        totalCheckIns = u[2];
        lastCheckInDay = Number(u[3]); // NEW: read lastCheckInDay
        // u[4] lastRecordedBalance (unused in UI for now)
    }

    // Track today's UTC day index once on the client
    const [currentUtcDay, setCurrentUtcDay] = useState<number | null>(null);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        const nowSeconds = Date.now() / 1000;
        const dayIndex = Math.floor(nowSeconds / 86400); // same as Solidity day index
        setCurrentUtcDay(dayIndex);
    }, []);

    // Has user already checked in today (UTC)?
    const hasCheckedInToday = useMemo(() => {
        if (lastCheckInDay === null || currentUtcDay === null) return false;
        return lastCheckInDay === currentUtcDay;
    }, [lastCheckInDay, currentUtcDay]);

    const streakStatus =
        currentStreak === 0
            ? { label: "Inactive", tone: "bg-red-500/15 text-red-300 border-red-500/30" }
            : { label: "Active", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };

    // ===== READ: FROG token balance =====
    const { data: frogBalanceRaw } = useReadContract({
        address: FROG_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address ?? "0x0000000000000000000000000000000000000000"],
        query: { enabled: !!address && !wrongNetwork },
    });

    const { data: frogDecimalsRaw } = useReadContract({
        address: FROG_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "decimals",
        args: [],
    });

    const frogBalance = useMemo(() => {
        if (!frogBalanceRaw || frogDecimalsRaw === undefined) return 0;
        const decimals =
            typeof frogDecimalsRaw === "number"
                ? frogDecimalsRaw
                : Number(frogDecimalsRaw);
        return Number(frogBalanceRaw) / 10 ** decimals;
    }, [frogBalanceRaw, frogDecimalsRaw]);

    // ===== WRITE: checkIn() =====
    const {
        data: txHash,
        writeContract,
        isPending: isCheckInPending,
        error: checkInError,
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
        isCheckInPending ||
        isConfirmingTx ||
        hasCheckedInToday; // NEW

    let checkInLabel: string;
    if (!isConnected) {
        checkInLabel = "Connect wallet to check in";
    } else if (wrongNetwork) {
        checkInLabel = "Switch to Sei EVM";
    } else if (isCheckInPending || isConfirmingTx) {
        checkInLabel = "Checking in...";
    } else if (hasCheckedInToday) { // NEW
        checkInLabel = "Checked in ✓";
    } else {
        checkInLabel = "Check in for today";
    }

    // User-friendly error messages
    let checkInErrorMessage: string | undefined;
    if (checkInError) {
        const e = checkInError as { shortMessage?: string; message?: string };
        let raw = e.shortMessage ?? e.message ?? "";

        if (raw.includes("Balance has not increased")) {
            raw =
                "You need to hold more FROG than at your last successful check-in before you can extend your streak.";
        } else if (raw.includes("Insufficient FROG balance")) {
            raw =
                "Your FROG balance is below the minimum required to participate in streaks.";
        } else if (raw.includes("Already checked in today")) {
            raw =
                "You have already checked in for the current UTC day. Come back after the daily reset.";
        }

        checkInErrorMessage = raw;
    }

    return (
        <div className="min-h-screen w-full bg-brand-bg text-brand-text">
            <main className="mx-auto max-w-5xl px-4 py-10">
                {/* Header row */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                                    Froggy Dashboard
                                </h1>

                                <a
                                    href="/"
                                    className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-brand-subtle border border-white/10 hover:bg-white/10 transition-colors"
                                >
                                    ← Back to Landing
                                </a>
                            </div>
                        </div>
                        <p className="mt-1 text-sm text-brand-subtle">
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
                    <section className="mt-10 rounded-2xl border border-white/10 bg-brand-card/70 p-6">
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
                                        {chainId === SEI_EVM_CHAIN_ID
                                            ? "Sei EVM mainnet"
                                            : chainId
                                                ? `Chain ID: ${chainId}`
                                                : "Chain: Unknown"}
                                    </span>
                                </div>

                                <div className="mt-3 space-y-2 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-brand-subtle">Address:</span>
                                        <code className="rounded bg-black/30 px-2 py-1 text-xs">
                                            {shortAddress}
                                        </code>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-brand-subtle">Balance:</span>
                                        <span className="text-sm font-mono">
                                            {frogBalance.toLocaleString(undefined, {
                                                maximumFractionDigits: 2,
                                            })}{" "}
                                            FROG
                                        </span>
                                    </div>

                                    <p className="mt-1 text-xs text-brand-subtle">
                                        This address is used to track your streaks and send rewards once they go live.
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
                                        Streak rule: your FROG balance must be higher than it was at
                                        your last successful check-in.
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
                        <section className="mt-6 grid gap-4 md:grid-cols-3">
                            {/* Current streak */}
                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-4">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-brand-subtle">
                                    <span>Current streak</span>
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
                                <div className="mt-1 text-xs text-brand-subtle">
                                    Consecutive days you&apos;ve checked in.
                                </div>
                            </div>

                            {/* Best streak */}
                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-4">
                                <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-brand-subtle">
                                    <span>Best streak</span>
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
                                        <span className="ml-1 text-base font-semibold text-brand-subtle">d</span>
                                    )}
                                </div>
                                <div className="mt-1 text-xs text-brand-subtle">
                                    Your longest streak so far.
                                </div>
                            </div>

                            {/* Total check-ins */}
                            <div className="rounded-2xl border border-white/10 bg-brand-card/80 p-4">
                                <div className="text-[11px] uppercase tracking-wide text-brand-subtle">
                                    Total check-ins
                                </div>
                                <div className="mt-2 text-3xl font-bold">
                                    {isLoadingUser || wrongNetwork ? "…" : totalCheckIns}
                                </div>
                                <div className="mt-1 text-xs text-brand-subtle">
                                    Successful daily check-ins recorded on-chain.
                                </div>
                            </div>
                        </section>


                        {/* Actions: check-in + claim */}
                        <section className="mt-8 rounded-2xl border border-white/10 bg-brand-card/80 p-6 space-y-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-semibold">Daily check-in</h2>
                                        <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-brand-subtle border border-white/10">
                                            1 per day
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-brand-subtle">
                                        Check in once per 24hr to extend your streak, DCA is king!
                                    </p>
                                    <p className="mt-1 text-[11px] text-brand-subtle">
                                        Daily reset: <span className="font-mono">00:00 UTC</span>.
                                    </p>

                                    {checkInErrorMessage && !wrongNetwork && (
                                        <p className="mt-2 text-xs text-red-400">
                                            {checkInErrorMessage}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleCheckIn}
                                    disabled={checkInDisabled}
                                    className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-brand-primary text-[#081318] hover:scale-[1.02] transition-transform focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed"
                                >
                                    {checkInLabel}
                                </button>
                            </div>

                            <div className="border-t border-white/10 pt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold">Rewards</h3>
                                        <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-brand-subtle border border-white/10">
                                            Coming soon
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-brand-subtle">
                                        Once streak milestones are live, you&apos;ll be able to claim on-chain rewards here based on your best streak and total check-ins.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    disabled
                                    className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-white/5 text-brand-text border border-white/15 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    Claim reward
                                </button>
                            </div>
                        </section>

                        {/* Market snapshot */}
                        <section className="mt-8 rounded-2xl border border-white/10 bg-brand-card/60 p-6">
                            <h2 className="text-lg font-semibold mb-2">Market snapshot</h2>
                            <p className="text-xs text-brand-subtle mb-3">
                                Quick view of $FROG stats while you manage your streaks.
                            </p>
                            <LiveStats />
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}
