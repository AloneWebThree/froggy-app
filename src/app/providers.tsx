"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sei, SEI_RPC_URL } from "@/lib/chain/sei";

// --- wagmi config: injected only (browser wallets) ---
export const config = createConfig({
    chains: [sei],
    transports: { [sei.id]: http(SEI_RPC_URL) },
    connectors: [
        injected({
            shimDisconnect: true,
        }),
    ],
});

// Create ONE client instance for the whole app lifecycle.
// Avoids cache resets on remount / hot reload.
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

export function Providers({ children }: { children: ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
    );
}