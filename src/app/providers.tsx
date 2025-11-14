// app/providers.tsx
"use client";

import { ReactNode } from "react";
import {
    WagmiProvider,
    createConfig,
    http,
    useAccount,
    useConnect,
    useDisconnect,
} from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain } from "viem";

// --- Sei EVM chain definition ---
const sei = defineChain({
    id: 1329,
    name: "Sei EVM",
    nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
    rpcUrls: { default: { http: ["https://evm-rpc.sei-apis.com"] } },
    blockExplorers: {
        default: { name: "SeiTrace", url: "https://seitrace.com/?chain=pacific-1" },
    },
});

const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// --- wagmi config: injected + (optional) WalletConnect ---
export const config = createConfig({
    chains: [sei],
    transports: { [sei.id]: http("https://evm-rpc.sei-apis.com") },
    connectors: [
        injected({
            shimDisconnect: true,
        }),
        ...(wcProjectId
            ? [
                walletConnect({
                    projectId: wcProjectId,
                    showQrModal: true,
                    metadata: {
                        name: "Froggy dApp",
                        description: "Zero-tax community token on Sei",
                        url: "https://frogonsei.app",
                        icons: ["https://frogonsei.app/favicon.png"],
                    },
                }),
            ]
            : []),
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

// --- reusable wallet button used in header + mobile menu ---
export function WalletButton() {
    const { address, isConnected } = useAccount();
    const { connect, connectors, isPending } = useConnect();
    const { disconnect } = useDisconnect();

    const injectedConnector = connectors.find((c) => c.id === "injected");
    const wcConnector = connectors.find((c) => c.id === "walletConnect");

    const shortAddr = (addr?: string) =>
        addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

    if (!isConnected) {
        return (
            <div className="flex gap-2">
                {/* Browser Wallet */}
                <button
                    type="button"
                    disabled={isPending || !injectedConnector}
                    onClick={() => injectedConnector && connect({ connector: injectedConnector })}
                    className="rounded-xl px-4 py-2 text-sm font-semibold bg-brand-primary text-[#081318] hover:scale-[1.02] transition-transform focus:outline-none focus:ring-2 focus:ring-brand-primary/50 disabled:opacity-60"
                >
                    {isPending && injectedConnector ? "Connecting…" : "Browser Wallet"}
                </button>

                {/* WalletConnect (only active if configured) */}
                <button
                    type="button"
                    disabled={isPending || !wcConnector}
                    onClick={() => wcConnector && connect({ connector: wcConnector })}
                    className="rounded-xl px-4 py-2 text-sm font-semibold bg-white/5 text-brand-text border border-white/15 hover:bg-white/10 hover:scale-[1.02] transition-transform focus:outline-none focus:ring-2 focus:ring-brand-primary/40 disabled:opacity-60"
                >
                    {isPending && wcConnector ? "Connecting…" : "WalletConnect"}
                </button>
            </div>
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
