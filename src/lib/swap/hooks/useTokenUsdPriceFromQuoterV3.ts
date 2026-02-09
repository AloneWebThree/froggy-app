"use client";

import { useEffect, useState } from "react";
import { formatUnits, type Address, type Abi } from "viem";
import { useReadContract } from "wagmi";

const QUOTER_V2_ABI = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [
      { name: "path", type: "bytes" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

export function useTokenUsdPriceFromQuoterV3(params: {
  seiUsdPrice: number | null;
  quoterAddress: Address;
  pathBytes: `0x${string}`; // 1 SEI -> token
  tokenDecimals: number;
}) {
  const { seiUsdPrice, quoterAddress, pathBytes, tokenDecimals } = params;
  const [tokenUsdPrice, setTokenUsdPrice] = useState<number | null>(null);

  const oneSei = 1_000_000_000_000_000_000n;

  const { data } = useReadContract({
    address: quoterAddress,
    abi: QUOTER_V2_ABI as unknown as Abi,
    functionName: "quoteExactInput",
    args: seiUsdPrice !== null ? [pathBytes, oneSei] : undefined,
    query: { enabled: seiUsdPrice !== null, staleTime: 30_000, gcTime: 120_000, refetchOnWindowFocus: false },
  });

  const amountOut = (data as bigint | undefined) ?? undefined;

  useEffect(() => {
    if (seiUsdPrice === null || !amountOut || amountOut <= 0n) return;

    const tokensPerSei = Number(formatUnits(amountOut, tokenDecimals));
    if (!Number.isFinite(tokensPerSei) || tokensPerSei <= 0) return;

    const price = seiUsdPrice / tokensPerSei;
    if (Number.isFinite(price) && price > 0) setTokenUsdPrice(price);
  }, [amountOut, seiUsdPrice, tokenDecimals]);

  return tokenUsdPrice;
}