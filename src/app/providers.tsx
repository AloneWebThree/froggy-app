// app/providers.tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import {
    WagmiProvider,
    createConfig,
    http,
    useAccount,
    useConnect,
    useDisconnect,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sei } from "@/lib/sei";

// --- wagmi config: injected only (browser wallets) ---
export const config = createConfig({
    chains: [sei],
    transports: { [sei.id]: http("https://evm-rpc.sei-apis.com") },
    connectors: [
        injected({
            shimDisconnect: true,
        }),
    ],
});

// --- react-query client ---
const queryClient = new QueryClient();

// --- top-level providers wrapper ---
export function Providers({ children }: { children: ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    );
}

// --- reusable wallet button (desktop + mobile) ---
// --- reusable wallet button (desktop + mobile) ---
export function WalletButton() {
    const { address, isConnected } = useAccount();
    const { connect, connectors, isPending } = useConnect();
    const { disconnect } = useDisconnect();

    // HYDRATION FIX: don't trust wagmi connection state until after mount
    // HYDRATION FIX: don't trust wagmi connection state until after mount
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    const injectedConnector = connectors.find((c) => c.id === "injected");

    const shortAddr = (addr?: string) =>
        addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

    // IMPORTANT: before mounted, force the same UI as SSR (looks disconnected)
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

    // Not connected: single browser-wallet button
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

    // Connected: show short address, click to disconnect
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

