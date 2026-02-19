// src/lib/swap/hooks/useApprove.ts
"use client";

import { useWriteContract } from "wagmi";
import type { Abi, Address } from "viem";
import { ERC20_ABI, SEI_EVM_CHAIN_ID } from "@/lib/froggyConfig";

type ApproveArgs = {
  token: Address;
  spender: Address;
  amount: bigint;
  chainId?: number;
};

export function useApprove() {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();

  async function approve({ token, spender, amount, chainId = SEI_EVM_CHAIN_ID }: ApproveArgs) {
    return writeContractAsync({
      chainId,
      address: token,
      abi: ERC20_ABI as unknown as Abi,
      functionName: "approve",
      args: [spender, amount],
    });
  }

  return { approve, hash, isPending, error };
}
