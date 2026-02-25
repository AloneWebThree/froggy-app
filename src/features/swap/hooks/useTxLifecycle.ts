// src/lib/swap/hooks/useTxLifecycle.ts
"use client";

import { useWaitForTransactionReceipt } from "wagmi";

export function useTxLifecycle(hash?: `0x${string}`) {
  const { isLoading, isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  return {
    isConfirming: isLoading,
    isConfirmed: isSuccess,
    isFailed: isError,
    error,
  };
}
