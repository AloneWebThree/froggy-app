"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

// Reusable wallet button (desktop + mobile)
export function WalletButton() {
    const { address, isConnected } = useAccount();
    const { connect, connectors, isPending } = useConnect();
    const { disconnect } = useDisconnect();

    // Hydration-safe mount gate
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const injectedConnector = useMemo(
        () => connectors.find((c) => c.id === "injected"),
        [connectors]
    );

    const shortAddr = (addr?: string) =>
        addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

    // BEFORE mount: force the “disconnected” UI so SSR === first client render
    if (!mounted) {
        return (
            <button
                type="button"
                disabled
                className="rounded-xl px-4 py-2 text-sm font-semibold bg-brand-primary text-[#081318] hover:scale-[1.02] transition-transform focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:opacity-60"
            >
                Connect Wallet
            </button>
        );
    }

    if (!isConnected) {
        return (
            <button
                type="button"
                disabled={isPending || !injectedConnector}
                onClick={() => injectedConnector && connect({ connector: injectedConnector })}
                className="rounded-xl px-4 py-2 text-sm font-semibold bg-brand-primary text-[#081318] hover:scale-[1.02] transition-transform focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:opacity-60"
            >
                {isPending && injectedConnector ? "Connecting…" : "Connect Wallet"}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={() => disconnect()}
            className="rounded-xl px-4 py-2 text-sm font-mono bg-white/5 border border-white/10 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
        >
            {shortAddr(address)}
        </button>
    );
}
