"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    RainbowKitProvider,
    ConnectButton,
    darkTheme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
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

// --- wagmi config: injected only (Rabby, MetaMask, etc.) ---
export const config = createConfig({
    chains: [sei],
    transports: { [sei.id]: http("https://evm-rpc.sei-apis.com") },
    connectors: [
        injected({
            shimDisconnect: true, // lets RainbowKit remember/disconnect properly
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
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: "#6eb819", // Froggy green
                        accentColorForeground: "#081318",
                        overlayBlur: "small",
                        borderRadius: "large",
                    })}
                    initialChain={sei}
                    modalSize="compact"
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

// --- reusable connect button used in your header ---
export function WalletButton() {
    return (
        <ConnectButton
            chainStatus="icon"
            showBalance={false}
            accountStatus="address"
        />
    );
}
