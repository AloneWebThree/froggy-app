// src/lib/swap/hooks/useSwapQuote.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, type Address, type Abi } from "viem";
import { useReadContract } from "wagmi";

function getErrMsg(err: unknown) {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as { shortMessage?: string; message?: string; cause?: unknown };
    return e.shortMessage || e.message;
  }
  return undefined;
}

export function useSwapQuote(params: {
  routerAddress: Address;
  routerAbi: Abi;
  amountIn: bigint | null;
  path: readonly Address[];
  decimals?: number;
  slippageBps?: number;
}) {
  const {
    routerAddress,
    routerAbi,
    amountIn,
    path,
    decimals = 18,
    slippageBps = 200,
  } = params;

  const { data, isLoading, isFetching, isError, error } = useReadContract({
    address: routerAddress,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: amountIn !== null ? [amountIn, [...path]] : undefined,
    query: {
      enabled: amountIn !== null,
      // reduce “flicker” + avoid hammering RPC while typing
      staleTime: 10_000,
      gcTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 2500),
    },
  }) as unknown as {
    data?: readonly bigint[];
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    error?: unknown;
  };

  // Keep last good values to avoid “sometimes 0.0 / no quote” during refetch
  const lastGoodRef = useRef<{
    outRaw: bigint;
    outFormatted: string;
    minOut: bigint;
  } | null>(null);

  const computed = useMemo(() => {
    if (!data || data.length < 2) return null;

    // IMPORTANT: multi-hop support (output is always the last element)
    const out = data[data.length - 1];
    if (out <= 0n) return null;

    const minOut = (out * BigInt(10_000 - slippageBps)) / 10_000n;
    return {
      outRaw: out,
      outFormatted: formatUnits(out, decimals),
      minOut,
    };
  }, [data, decimals, slippageBps]);

  const [outRaw, setOutRaw] = useState<bigint | null>(null);
  const [outFormatted, setOutFormatted] = useState<string | null>(null);
  const [minOut, setMinOut] = useState<bigint | null>(null);

  useEffect(() => {
    if (computed) {
      lastGoodRef.current = computed;
      setOutRaw(computed.outRaw);
      setOutFormatted(computed.outFormatted);
      setMinOut(computed.minOut);
      return;
    }

    // If we’re fetching and have a last good quote, keep it
    if ((isLoading || isFetching) && lastGoodRef.current) {
      const last = lastGoodRef.current;
      setOutRaw(last.outRaw);
      setOutFormatted(last.outFormatted);
      setMinOut(last.minOut);
      return;
    }

    // Otherwise, genuinely no quote
    setOutRaw(null);
    setOutFormatted(null);
    setMinOut(null);
  }, [computed, isLoading, isFetching]);

  return {
    isLoading: isLoading || isFetching,
    isError,
    errorMessage: getErrMsg(error),
    outRaw,
    outFormatted,
    minOut,
  };
}