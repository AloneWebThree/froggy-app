"use client";

import { useCallback, useState } from "react";
import type { Address, Abi } from "viem";
import { useWriteContract } from "wagmi";

const SWAP_ROUTER02_ABI = [
  {
    type: "function",
    name: "exactInput",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

type UnknownErr = { shortMessage?: string; message?: string };

export function useSwapExecutionV3(params: {
  swapRouter02: Address;
}) {
  const { swapRouter02 } = params;

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const executeSwapV3 = useCallback(
    async (args: {
      recipient: Address;
      amountIn: bigint; // msg.value
      minOut: bigint;
      pathBytes: `0x${string}`;
      deadlineSeconds?: number; // default 600
    }) => {
      const { recipient, amountIn, minOut, pathBytes, deadlineSeconds = 600 } = args;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

      try {
        setErrorMessage(undefined);

        const hash = (await writeContractAsync({
          address: swapRouter02,
          abi: SWAP_ROUTER02_ABI as unknown as Abi,
          functionName: "exactInput",
          args: [
            {
              path: pathBytes,
              recipient,
              deadline,
              amountIn,
              amountOutMinimum: minOut,
            },
          ],
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
    [swapRouter02, writeContractAsync]
  );

  return {
    executeSwapV3,
    txHash: txHash as `0x${string}` | undefined,
    isPending,
    errorMessage,
    clearError: () => setErrorMessage(undefined),
  };
}