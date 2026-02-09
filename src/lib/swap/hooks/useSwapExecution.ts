"use client";

import { useCallback, useState } from "react";
import type { Address, Abi } from "viem";
import { useWriteContract } from "wagmi";

type UnknownErr = { shortMessage?: string; message?: string };

export function useSwapExecution(params: {
  routerAddress: Address;
  routerAbi: Abi;
  path: Address[];
}) {
  const { routerAddress, routerAbi, path } = params;

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const executeSwap = useCallback(
    async (args: {
      address: Address; // recipient + msg.sender
      amountIn: bigint; // msg.value
      minOut: bigint; // slippage-protected min
      deadlineSeconds?: number; // default 600
    }) => {
      const { address, amountIn, minOut, deadlineSeconds = 600 } = args;

      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

      try {
        setErrorMessage(undefined);

        const hash = (await writeContractAsync({
          address: routerAddress,
          abi: routerAbi,
          functionName: "swapExactSEIForTokens",
          args: [minOut, path, address, deadline],
          value: amountIn,
        })) as `0x${string}`;

        return hash;
      } catch (err: unknown) {
        const fallback = "Transaction was rejected or failed.";
        let msg = fallback;

        if (err && typeof err === "object") {
          const e = err as UnknownErr;
          msg = e.shortMessage || e.message || fallback;
        } else if (typeof err === "string") {
          msg = err;
        }

        setErrorMessage(msg);
        return undefined;
      }
    },
    [path, routerAbi, routerAddress, writeContractAsync]
  );

  return {
    executeSwap,
    txHash: txHash as `0x${string}` | undefined,
    isPending,
    errorMessage,
    clearError: () => setErrorMessage(undefined),
  };
}