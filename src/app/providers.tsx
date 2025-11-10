"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, ConnectButton, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { defineChain } from "viem";

const sei = defineChain({
    id: 1329,
    name: "Sei EVM",
    nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
    rpcUrls: { default: { http: ["https://evm-rpc.sei-apis.com"] } },
    blockExplorers: { default: { name: "SeiScan", url: "https://seiscan.io" } },
});

const config = createConfig({
    chains: [sei],
    connectors: [injected()], // MetaMask, Rabby (EIP-6963)
    transports: { [sei.id]: http("https://evm-rpc.sei-apis.com") },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={darkTheme({
                    accentColor: "#6eb819",          // your Froggy green
                    accentColorForeground: "#081318", // text color on button
                    overlayBlur: "small",
                    borderRadius: "large",
                })}
                    modalSize="compact">
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

export function WalletButton() {
    return <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />;
}
