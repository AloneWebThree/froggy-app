// src/lib/sei.ts
import { defineChain } from "viem";

export const sei = defineChain({
    id: 1329,
    name: "Sei EVM",
    nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
    rpcUrls: { default: { http: ["https://evm-rpc.sei-apis.com"] } },
    blockExplorers: {
        default: { name: "SeiScan", url: "https://seiscan.io" },
    },
});
