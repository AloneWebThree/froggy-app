// src/lib/sei.ts
import { defineChain } from "viem";

export const SEI_RPC_URL =
  process.env.NEXT_PUBLIC_SEI_RPC_URL ?? "https://evm-rpc.sei-apis.com";

export const sei = defineChain({
  id: 1329,
  name: "Sei EVM",
  nativeCurrency: { name: "SEI", symbol: "SEI", decimals: 18 },
  rpcUrls: { default: { http: [SEI_RPC_URL] } },
  blockExplorers: {
    default: { name: "SeiScan", url: "https://seiscan.io" },
  },
});
