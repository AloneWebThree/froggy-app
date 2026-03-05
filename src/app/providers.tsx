"use client";

import { ReactNode, useEffect } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sei, SEI_RPC_URL } from "@/lib/chain/sei";

export const config = createConfig({
    chains: [sei],
    transports: { [sei.id]: http(SEI_RPC_URL) },
    connectors: [injected({ shimDisconnect: true })],
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,     // <-- change
            refetchOnReconnect: true,       // <-- add
            retry: 1,
        },
    },
});

export function Providers({ children }: { children: ReactNode }) {
    useEffect(() => {
        // Wallet webviews are weird: "focus" is unreliable.
        // These three together cover most in-app browser resume cases.
        const refetchAll = () => {
            queryClient.invalidateQueries();
        };

        const onVis = () => {
            if (document.visibilityState === "visible") refetchAll();
        };

        const onPageShow = (e: PageTransitionEvent) => {
            // iOS BFCache: you come back to a frozen page that looks “loaded” but is stale.
            if (e.persisted) refetchAll();
            else refetchAll();
        };

        window.addEventListener("focus", refetchAll);
        document.addEventListener("visibilitychange", onVis);
        window.addEventListener("pageshow", onPageShow);

        return () => {
            window.removeEventListener("focus", refetchAll);
            document.removeEventListener("visibilitychange", onVis);
            window.removeEventListener("pageshow", onPageShow);
        };
    }, []);

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
    );
}