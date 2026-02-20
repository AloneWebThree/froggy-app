"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { SEI_EVM_CHAIN_ID } from "@/lib/froggyConfig";

export type SwapGate = {
  mounted: boolean;

  // wallet
  address?: `0x${string}`;
  hasAddress: boolean;

  // chain
  accountChainId?: number;
  appChainId?: number;
  effectiveChainId?: number;

  networkReady: boolean;
  isSeiEvm: boolean;

  wrongNetwork: boolean;
  networkUnknown: boolean;

  canReadOnSei: boolean;
  canWriteOnSei: boolean;
};

export function useSwapGate(): SwapGate {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const { address, chainId: accountChainId } = useAccount();
  const appChainId = useChainId();

  const addressHex = (typeof address === "string" ? (address as `0x${string}`) : undefined);

  const hasAddress = mounted && !!addressHex;

  const effectiveChainId = useMemo(() => {
    return hasAddress ? accountChainId : appChainId;
  }, [hasAddress, accountChainId, appChainId]);

  const networkReady = mounted && effectiveChainId !== undefined;
  const isSeiEvm = mounted && effectiveChainId === SEI_EVM_CHAIN_ID;

  const wrongNetwork = hasAddress && networkReady && !isSeiEvm;
  const networkUnknown = hasAddress && !networkReady;

  const canReadOnSei = mounted && isSeiEvm;
  const canWriteOnSei = mounted && hasAddress && isSeiEvm;

  return {
    mounted,
    address: addressHex,
    hasAddress,
    accountChainId,
    appChainId,
    effectiveChainId,
    networkReady,
    isSeiEvm,
    wrongNetwork,
    networkUnknown,
    canReadOnSei,
    canWriteOnSei,
  };
}