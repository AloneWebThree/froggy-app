"use client";

import { useMemo } from "react";
import { formatUnits, type Abi, type Address } from "viem";
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

type QuoteHookResult = {
  data?: bigint;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error?: unknown;
};

function getErrMsg(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as { shortMessage?: string; message?: string };
    return e.shortMessage || e.message;
  }
  return undefined;
}

export function useSwapQuoteV3(params: {
  quoterAddress: Address;
  pathBytes: `0x${string}`;
  amountIn: bigint | null;
  outDecimals: number;
  slippageBps?: number; // default 200 (2%)
}) {
  const { quoterAddress, pathBytes, amountIn, outDecimals, slippageBps = 200 } = params;

  const { data, isLoading, isFetching, isError, error } = useReadContract({
    address: quoterAddress,
    abi: QUOTER_V2_ABI as unknown as Abi,
    functionName: "quoteExactInput",
    args: amountIn !== null ? [pathBytes, amountIn] : undefined,
    query: {
      enabled: amountIn !== null,
      staleTime: 10_000,
      gcTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 2500),
    },
  }) as unknown as QuoteHookResult;

  const amountOut = data;

  const computed = useMemo(() => {
    if (!amountOut || amountOut <= 0n) {
      return { outFormatted: null as string | null, minOut: null as bigint | null };
    }
    const minOut = (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
    return {
      outFormatted: formatUnits(amountOut, outDecimals),
      minOut,
    };
  }, [amountOut, outDecimals, slippageBps]);

  return {
    isLoading: isLoading || isFetching,
    isError,
    errorMessage: getErrMsg(error),
    outFormatted: computed.outFormatted,
    minOut: computed.minOut,
  };
}