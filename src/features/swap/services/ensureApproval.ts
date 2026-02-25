// src/lib/swap/ensureApproval.ts
import type { Abi, Address, PublicClient } from "viem";
import { maxUint256 } from "viem";
import { ERC20_ABI, SEI_EVM_CHAIN_ID } from "@/lib/chain/froggyConfig";

type WriteContractAsync = (args: {
  chainId: number;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
}) => Promise<`0x${string}` | string>;

function asTxHash(x: `0x${string}` | string, label: string): `0x${string}` {
  // wagmi/viem should return a 0x-prefixed 32-byte hash. Guard anyway.
  if (typeof x === "string" && /^0x[0-9a-fA-F]{64}$/.test(x)) return x as `0x${string}`;
  throw new Error(`${label} did not return a transaction hash.`);
}

type EnsureApprovalArgs = {
  token: Address;
  spender: Address;
  requiredAmount: bigint;
  currentAllowance: bigint;
  approveExact: boolean;
  writeContractAsync: WriteContractAsync;
  publicClient: PublicClient;
  chainId?: number;
};

/**
 * Ensures `spender` can spend at least `requiredAmount` of `token`.
 * Handles "approve(0) then approve(amount)" patterns for stricter ERC20s.
 */
export async function ensureApproval({
  token,
  spender,
  requiredAmount,
  currentAllowance,
  approveExact,
  writeContractAsync,
  publicClient,
  chainId = SEI_EVM_CHAIN_ID,
}: EnsureApprovalArgs) {
  if (currentAllowance >= requiredAmount) return;

  const approvalAmount = approveExact ? requiredAmount : maxUint256;

  // Some ERC20s require approve(0) before approve(non-zero)
  if (currentAllowance > 0n && approvalAmount !== 0n) {
    const zeroHash = await writeContractAsync({
      chainId,
      address: token,
      abi: ERC20_ABI as unknown as Abi,
      functionName: "approve",
      args: [spender, 0n],
    });

    await publicClient.waitForTransactionReceipt({
      hash: asTxHash(zeroHash, "approve(0)"),
    });
  }

  const approvalHash = await writeContractAsync({
    chainId,
    address: token,
    abi: ERC20_ABI as unknown as Abi,
    functionName: "approve",
    args: [spender, approvalAmount],
  });

  await publicClient.waitForTransactionReceipt({
    hash: asTxHash(approvalHash, "approve"),
  });
}
