// src/components/landing/SwapSection.tsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { type Address, type Abi, parseUnits } from "viem";
import {
  useAccount,
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
  useSwitchChain,
  useReadContract,
} from "wagmi";

import LiveStats from "@/components/LiveStats";
import { CopyButton } from "@/components/landing/CopyButton";
import {
  ADDR,
  URL,
  SEI_EVM_CHAIN_ID,
  DRAGON_ROUTER_ADDRESS,
  DRAGON_ROUTER_ABI,
  WSEI_ADDRESS,
  ERC20_ABI,
  USDC_ADDRESS,
  USDY_ADDRESS,
  DRG_TOKEN_ADDRESS,
} from "@/lib/froggyConfig";

import {
  SwapSuccessToast,
  type ToSymbol,
} from "@/components/ui/SwapSuccessToast";
import { SwapErrorToast } from "@/components/ui/SwapErrorToast";

import { parseSeiInput } from "@/lib/swap/parseSeiInput";
import { useSeiUsdPrice } from "@/lib/swap/hooks/useSeiUsdPrice";
import { useSwapQuote } from "@/lib/swap/hooks/useSwapQuote";
import { useTokenUsdPriceFromRouter } from "@/lib/swap/hooks/useTokenUsdPriceFromRouter";

type FromSymbol = "SEI" | "USDY" | "DRG";
type UnknownErr = { shortMessage?: string; message?: string };

const USDY_DECIMALS = 18;
const DRG_DECIMALS = 18;

function errToMessage(err: unknown, fallback: string) {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as UnknownErr;
    return e.shortMessage || e.message || fallback;
  }
  return fallback;
}

function formatUsd(value: number) {
  if (!Number.isFinite(value)) return null;
  const opts =
    value >= 1
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 4 };
  return `$${value.toLocaleString(undefined, opts)}`;
}

export function SwapSection() {
  const [amount, setAmount] = useState("");
  const [fromSymbol, setFromSymbol] = useState<FromSymbol>("SEI");
  const [toSymbol, setToSymbol] = useState<ToSymbol>("FROG");

  // Hydration-safe mount gate
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Wallet / chain
  const { address, chainId: accountChainId } = useAccount(); // wallet chainId
  const appChainId = useChainId(); // configured/selected chain
  const { switchChainAsync } = useSwitchChain();

  const hasAddress = mounted && !!address;

  // Use wallet chain when connected; fall back to app chain when not connected
  const effectiveChainId = hasAddress ? accountChainId : appChainId;

  const networkReady = mounted && effectiveChainId !== undefined;
  const isSeiEvm = mounted && effectiveChainId === SEI_EVM_CHAIN_ID;

  const wrongNetwork = hasAddress && networkReady && !isSeiEvm;
  const networkUnknown = hasAddress && !networkReady;

  // Gate reads/writes
  const canReadOnSei = mounted && isSeiEvm;
  const canWriteOnSei = mounted && hasAddress && isSeiEvm;

  // Toasts
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [txForToast, setTxForToast] = useState<`0x${string}` | undefined>();
  const lastToastedHashRef = useRef<string | null>(null);

  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState<
    string | undefined
  >();

  const pushError = useCallback((msg: string) => {
    setErrorToastMessage(msg);
    setShowErrorToast(true);
  }, []);

  // Clear stale error toast when user edits inputs
  useEffect(() => {
    if (!showErrorToast && !errorToastMessage) return;
    setShowErrorToast(false);
    setErrorToastMessage(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, toSymbol, fromSymbol]);

  // Constrain supported destinations based on source token.
  const allowedToSymbols: ToSymbol[] = useMemo(() => {
    // USDY -> FROG and USDY -> SEI
    if (fromSymbol === "USDY") return ["FROG", "SEI"];

    // DRG routes requested:
    // - DRG -> SEI
    // - DRG -> SEI -> FROG (output FROG)
    if (fromSymbol === "DRG") return ["FROG", "SEI"];

    // SEI -> FROG/USDC/USDY/DRG
    return ["FROG", "USDC", "USDY", "DRG"];
  }, [fromSymbol]);

  // If From changes and To becomes invalid, snap To to first allowed option
  useEffect(() => {
    if (!allowedToSymbols.includes(toSymbol)) setToSymbol(allowedToSymbols[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromSymbol]);

  // Prices
  const seiUsdPrice = useSeiUsdPrice(30_000);

  // Token USD prices (router-derived)
  const frogUsdPrice = useTokenUsdPriceFromRouter({
    seiUsdPrice: canReadOnSei ? seiUsdPrice : null,
    routerAddress: DRAGON_ROUTER_ADDRESS as Address,
    routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
    tokenDecimals: 18,
    seiRoute: [WSEI_ADDRESS as Address, ADDR.token as Address],
  });

  const usdyUsdPrice = useTokenUsdPriceFromRouter({
    seiUsdPrice: canReadOnSei ? seiUsdPrice : null,
    routerAddress: DRAGON_ROUTER_ADDRESS as Address,
    routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
    tokenDecimals: USDY_DECIMALS,
    seiRoute: [
      WSEI_ADDRESS as Address,
      ADDR.token as Address,
      USDY_ADDRESS as Address,
    ], // SEI -> FROG -> USDY
  });

  const drgUsdPrice = useTokenUsdPriceFromRouter({
    seiUsdPrice: canReadOnSei ? seiUsdPrice : null,
    routerAddress: DRAGON_ROUTER_ADDRESS as Address,
    routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
    tokenDecimals: DRG_DECIMALS,
    seiRoute: [WSEI_ADDRESS as Address, DRG_TOKEN_ADDRESS as Address], // SEI -> DRG
  });

  // Amount parsing
  const parsedSei = parseSeiInput(amount);

  const amountInNumber = useMemo(() => {
    if (fromSymbol === "SEI") return parsedSei.number;
    const n = Number(amount);
    return Number.isFinite(n) ? n : 0;
  }, [amount, fromSymbol, parsedSei.number]);

  const amountInRaw: bigint | null = useMemo(() => {
    if (!amount || amount.trim() === "") return null;

    if (fromSymbol === "SEI") return parsedSei.units;

    try {
      if (!/^\d*\.?\d*$/.test(amount)) return null;

      if (fromSymbol === "USDY") {
        const units = parseUnits(amount as `${string}`, USDY_DECIMALS);
        return units > 0n ? units : null;
      }

      // DRG
      const units = parseUnits(amount as `${string}`, DRG_DECIMALS);
      return units > 0n ? units : null;
    } catch {
      return null;
    }
  }, [amount, fromSymbol, parsedSei.units]);

  // From-side USD estimate
  const fromUsdValue = useMemo(() => {
    if (amountInNumber <= 0) return null;

    if (fromSymbol === "SEI") {
      return seiUsdPrice !== null ? amountInNumber * seiUsdPrice : null;
    }

    if (fromSymbol === "USDY") {
      return usdyUsdPrice !== null ? amountInNumber * usdyUsdPrice : null;
    }

    // DRG
    return drgUsdPrice !== null ? amountInNumber * drgUsdPrice : null;
  }, [amountInNumber, fromSymbol, seiUsdPrice, usdyUsdPrice, drgUsdPrice]);

  // Route/path for quoting + swapping
  const v2Path: Address[] = useMemo(() => {
    if (fromSymbol === "SEI") {
      if (toSymbol === "USDC")
        return [WSEI_ADDRESS as Address, USDC_ADDRESS as Address];
      if (toSymbol === "USDY")
        return [
          WSEI_ADDRESS as Address,
          ADDR.token as Address,
          USDY_ADDRESS as Address,
        ];
      if (toSymbol === "DRG")
        return [WSEI_ADDRESS as Address, DRG_TOKEN_ADDRESS as Address];
      // FROG
      return [WSEI_ADDRESS as Address, ADDR.token as Address];
    }

    if (fromSymbol === "USDY") {
      if (toSymbol === "FROG")
        return [USDY_ADDRESS as Address, ADDR.token as Address];
      // USDY -> SEI must end in WSEI for swapExactTokensForSEI
      return [
        USDY_ADDRESS as Address,
        ADDR.token as Address,
        WSEI_ADDRESS as Address,
      ];
    }

    // fromSymbol === "DRG"
    if (toSymbol === "FROG") {
      // DRG -> SEI -> FROG === DRG -> WSEI -> FROG
      return [
        DRG_TOKEN_ADDRESS as Address,
        WSEI_ADDRESS as Address,
        ADDR.token as Address,
      ];
    }

    // DRG -> SEI must end in WSEI for swapExactTokensForSEI
    return [DRG_TOKEN_ADDRESS as Address, WSEI_ADDRESS as Address];
  }, [fromSymbol, toSymbol]);

  // Output decimals (SEI is 18; WSEI unwrap is 18)
  const outDecimals = useMemo(() => {
    if (toSymbol === "USDC") return 6;
    return 18;
  }, [toSymbol]);

  // Quote gating: only request quote on Sei and with a valid amount
  const quote = useSwapQuote({
    routerAddress: DRAGON_ROUTER_ADDRESS as Address,
    routerAbi: DRAGON_ROUTER_ABI as unknown as Abi,
    amountIn: canReadOnSei ? amountInRaw : null,
    path: v2Path,
    decimals: outDecimals,
    slippageBps: 200,
  });

  // To-side USD estimate
  const tokenOutAmount = quote.outFormatted ? parseFloat(quote.outFormatted) : 0;

  const toUsdValue = useMemo(() => {
    if (
      !quote.outFormatted ||
      !Number.isFinite(tokenOutAmount) ||
      tokenOutAmount <= 0
    )
      return null;

    if (toSymbol === "USDC") return tokenOutAmount; // assume $1
    if (toSymbol === "USDY")
      return usdyUsdPrice !== null ? tokenOutAmount * usdyUsdPrice : null;
    if (toSymbol === "SEI")
      return seiUsdPrice !== null ? tokenOutAmount * seiUsdPrice : null;
    if (toSymbol === "DRG")
      return drgUsdPrice !== null ? tokenOutAmount * drgUsdPrice : null;

    // FROG
    return frogUsdPrice !== null ? tokenOutAmount * frogUsdPrice : null;
  }, [
    frogUsdPrice,
    usdyUsdPrice,
    seiUsdPrice,
    drgUsdPrice,
    quote.outFormatted,
    tokenOutAmount,
    toSymbol,
  ]);

  // Allowances (only relevant when ERC-20 is input)
  const { data: usdyAllowance } = useReadContract({
    address: USDY_ADDRESS as Address,
    abi: ERC20_ABI as unknown as Abi,
    functionName: "allowance",
    args: [address as Address, DRAGON_ROUTER_ADDRESS as Address],
    query: {
      enabled: !!address && canReadOnSei && fromSymbol === "USDY",
      staleTime: 5_000,
    },
  });

  const { data: drgAllowance } = useReadContract({
    address: DRG_TOKEN_ADDRESS as Address,
    abi: ERC20_ABI as unknown as Abi,
    functionName: "allowance",
    args: [address as Address, DRAGON_ROUTER_ADDRESS as Address],
    query: {
      enabled: !!address && canReadOnSei && fromSymbol === "DRG",
      staleTime: 5_000,
    },
  });

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isTxConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash as `0x${string}` | undefined,
    });

  useEffect(() => {
    if (!isTxConfirmed || !txHash) return;
    if (lastToastedHashRef.current === txHash) return;

    lastToastedHashRef.current = txHash;

    const id = requestAnimationFrame(() => {
      setTxForToast(txHash as `0x${string}`);
      setShowSuccessToast(true);
    });
    return () => cancelAnimationFrame(id);
  }, [isTxConfirmed, txHash]);

  const executeSwap = useCallback(async () => {
    // HARD BLOCK: never attempt a write unless wallet is on 1329
    if (!canWriteOnSei || !address) {
      pushError("Wrong network. Switch your wallet to Sei EVM (chain 1329).");
      return;
    }

    if (!amountInRaw) {
      pushError("Enter a valid amount.");
      return;
    }

    if (!quote.minOut) {
      pushError(quote.errorMessage || "No quote available for this amount.");
      return;
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

    try {
      setErrorToastMessage(undefined);

      // SEI-native in
      if (fromSymbol === "SEI") {
        await writeContractAsync({
          chainId: SEI_EVM_CHAIN_ID,
          address: DRAGON_ROUTER_ADDRESS as Address,
          abi: DRAGON_ROUTER_ABI as unknown as Abi,
          functionName: "swapExactSEIForTokens",
          args: [quote.minOut, v2Path, address as Address, deadline],
          value: amountInRaw,
        });
        return;
      }

      // USDY in
      if (fromSymbol === "USDY") {
        const allowance =
          typeof usdyAllowance === "bigint" ? usdyAllowance : 0n;

        if (allowance < amountInRaw) {
          await writeContractAsync({
            chainId: SEI_EVM_CHAIN_ID,
            address: USDY_ADDRESS as Address,
            abi: ERC20_ABI as unknown as Abi,
            functionName: "approve",
            args: [DRAGON_ROUTER_ADDRESS as Address, amountInRaw],
          });

          // IMPORTANT: don't try to swap immediately; wait for approval to be mined,
          // allowance to refresh, then user clicks again.
          return;
        }

        if (toSymbol === "FROG") {
          await writeContractAsync({
            chainId: SEI_EVM_CHAIN_ID,
            address: DRAGON_ROUTER_ADDRESS as Address,
            abi: DRAGON_ROUTER_ABI as unknown as Abi,
            functionName: "swapExactTokensForTokens",
            args: [
              amountInRaw,
              quote.minOut,
              v2Path,
              address as Address,
              deadline,
            ],
          });
          return;
        }

        // USDY -> SEI
        await writeContractAsync({
          chainId: SEI_EVM_CHAIN_ID,
          address: DRAGON_ROUTER_ADDRESS as Address,
          abi: DRAGON_ROUTER_ABI as unknown as Abi,
          functionName: "swapExactTokensForSEI",
          args: [amountInRaw, quote.minOut, v2Path, address as Address, deadline],
        });
        return;
      }

      // DRG in
      const allowance = typeof drgAllowance === "bigint" ? drgAllowance : 0n;

      if (allowance < amountInRaw) {
        await writeContractAsync({
          chainId: SEI_EVM_CHAIN_ID,
          address: DRG_TOKEN_ADDRESS as Address,
          abi: ERC20_ABI as unknown as Abi,
          functionName: "approve",
          args: [DRAGON_ROUTER_ADDRESS as Address, amountInRaw],
        });

        // IMPORTANT: don't try to swap immediately; wait for approval to be mined,
        // allowance to refresh, then user clicks again.
        return;
      }

      if (toSymbol === "FROG") {
        // DRG -> WSEI -> FROG
        await writeContractAsync({
          chainId: SEI_EVM_CHAIN_ID,
          address: DRAGON_ROUTER_ADDRESS as Address,
          abi: DRAGON_ROUTER_ABI as unknown as Abi,
          functionName: "swapExactTokensForTokens",
          args: [
            amountInRaw,
            quote.minOut,
            v2Path,
            address as Address,
            deadline,
          ],
        });
        return;
      }

      // DRG -> SEI (ends in WSEI, router unwraps)
      await writeContractAsync({
        chainId: SEI_EVM_CHAIN_ID,
        address: DRAGON_ROUTER_ADDRESS as Address,
        abi: DRAGON_ROUTER_ABI as unknown as Abi,
        functionName: "swapExactTokensForSEI",
        args: [amountInRaw, quote.minOut, v2Path, address as Address, deadline],
      });
    } catch (err: unknown) {
      pushError(errToMessage(err, "Transaction was rejected or failed."));
    }
  }, [
    canWriteOnSei,
    address,
    amountInRaw,
    quote.minOut,
    quote.errorMessage,
    v2Path,
    writeContractAsync,
    pushError,
    fromSymbol,
    toSymbol,
    usdyAllowance,
    drgAllowance,
  ]);

  const handlePrimaryClick = useCallback(async () => {
    if (!mounted) return;
    if (!hasAddress) return;

    if (networkUnknown) {
      pushError("Wallet network not detected yet. Try again in a moment.");
      return;
    }

    if (wrongNetwork) {
      try {
        await switchChainAsync({ chainId: SEI_EVM_CHAIN_ID });
      } catch (err: unknown) {
        pushError(
          errToMessage(
            err,
            "Failed to switch network. Please switch to Sei EVM in your wallet."
          )
        );
      }
      return;
    }

    await executeSwap();
  }, [
    mounted,
    hasAddress,
    networkUnknown,
    wrongNetwork,
    switchChainAsync,
    pushError,
    executeSwap,
  ]);

  const swapDisabled =
    !mounted ||
    !hasAddress ||
    networkUnknown ||
    wrongNetwork ||
    !amountInRaw ||
    !canReadOnSei ||
    quote.isLoading ||
    isPending ||
    isConfirming ||
    !quote.minOut;

  const primaryLabel = useMemo(() => {
    if (!mounted) return "Loading…";
    if (!hasAddress) return "Connect wallet to swap";
    if (networkUnknown) return "Detecting network…";
    if (wrongNetwork) return "Switch to Sei EVM";
    if (!amountInRaw) return "Enter amount";
    if (!canReadOnSei) return "Switch to Sei EVM";
    if (quote.isLoading) return "Fetching quote…";
    if (isPending || isConfirming) return "Processing…";

    if (fromSymbol === "USDY" && amountInRaw) {
      const allowance =
        typeof usdyAllowance === "bigint" ? usdyAllowance : 0n;
      if (allowance < amountInRaw) return "Approve";
    }

    if (fromSymbol === "DRG" && amountInRaw) {
      const allowance = typeof drgAllowance === "bigint" ? drgAllowance : 0n;
      if (allowance < amountInRaw) return "Approve";
    }

    return "Swap now";
  }, [
    mounted,
    hasAddress,
    networkUnknown,
    wrongNetwork,
    amountInRaw,
    canReadOnSei,
    quote.isLoading,
    isPending,
    isConfirming,
    fromSymbol,
    usdyAllowance,
    drgAllowance,
  ]);

  const helpLine = "Swaps route through Sei EVM";
  const panelHeight = "h-[clamp(540px,70vh,680px)] min-h-[520px]";

  return (
    <section className="mx-auto max-w-6xl px-4 pb-14">
      <h2 className="text-2xl md:text-3xl font-bold">Swap</h2>
      <p className="mt-2 text-slate-300/90 text-sm leading-snug">
        Swap tokens directly from the dApp.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1.15fr] md:items-stretch">
        {/* Left: chart */}
        <div
          className={`rounded-2xl overflow-hidden border border-white/10 bg-brand-card ${panelHeight} flex flex-col`}
        >
          <iframe
            title="Price chart on GeckoTerminal"
            src={URL.dexEmbed}
            className="w-full flex-1"
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-same-origin allow-scripts allow-popups"
          />
          <div className="border-t border-white/10 bg-black/20 backdrop-blur px-3 py-2 flex items-center gap-2">
            <div className="text-xs text-brand-subtle">Pair</div>
            <code className="text-[11px] font-mono select-all truncate max-w-[40ch]">
              {ADDR.pair}
            </code>
            <div className="ml-auto flex items-center gap-2">
              <CopyButton value={ADDR.pair} label="pair address" />
              <a
                href={URL.pairExplorer}
                className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5"
                target="_blank"
                rel="noreferrer"
              >
                Explorer ↗
              </a>
              <a
                href={URL.dexFull}
                className="text-xs rounded-lg px-2 py-1 border border-white/10 hover:bg-white/5"
                target="_blank"
                rel="noreferrer"
              >
                Full chart ↗
              </a>
            </div>
          </div>
        </div>

        {/* Right: swap card */}
        <div
          id="swap"
          className={`rounded-2xl border border-white/10 bg-brand-card p-5 flex flex-col ${panelHeight} overflow-hidden`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-brand-subtle">Quick Action</div>
              <h3 className="mt-1 text-lg font-semibold truncate">
                {fromSymbol} → {toSymbol}
              </h3>
              <p className="mt-1 text-xs text-brand-subtle">{helpLine}</p>
            </div>
            <Image
              src="/froggy-cape.png"
              width={88}
              height={88}
              className="rounded-full shrink-0"
              alt="Froggy icon"
            />
          </div>

          <div
            className="mt-4 flex-1 overflow-y-auto overflow-x-hidden pr-4"
            style={{ scrollbarGutter: "stable" }}
          >
            <div className="space-y-4 min-w-0">
              {/* From / To selectors */}
              <div className="grid grid-cols-2 gap-3">
                {/* From */}
                <div className="grid gap-1 min-w-0">
                  <label className="text-[11px] text-brand-subtle">
                    Pay With
                  </label>
                  <select
                    value={fromSymbol}
                    onChange={(e) =>
                      setFromSymbol(e.currentTarget.value as FromSymbol)
                    }
                    className="h-9 w-full rounded-lg bg-black/20 px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                  >
                    <option value="SEI">SEI</option>
                    <option value="USDY">USDY</option>
                    <option value="DRG">DRG</option>
                  </select>
                </div>

                {/* To */}
                <div className="grid gap-1 min-w-0">
                  <label className="text-[11px] text-brand-subtle">
                    Receive
                  </label>
                  <select
                    value={toSymbol}
                    onChange={(e) =>
                      setToSymbol(e.currentTarget.value as ToSymbol)
                    }
                    className="h-9 w-full rounded-lg bg-black/20 px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                  >
                    {allowedToSymbols.map((sym) => (
                      <option key={sym} value={sym}>
                        {sym}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount input */}
              <div className="grid gap-2 min-w-0">
                <div className="flex items-center justify-between text-xs text-brand-subtle">
                  <span>Amount</span>
                  <span className="font-mono text-brand-text">
                    {fromSymbol === "SEI"
                      ? "SEI (native)"
                      : fromSymbol === "USDY"
                        ? "USDY"
                        : "DRG"}
                  </span>
                </div>

                <input
                  inputMode="decimal"
                  placeholder="0.0"
                  className="h-11 w-full box-border rounded-xl bg-black/20 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary/30"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.trim())}
                />

                <div className="flex items-center justify-between text-[11px] text-brand-subtle min-w-0">
                  <span className="truncate">Enter amount to swap.</span>
                  {fromUsdValue !== null && formatUsd(fromUsdValue) && (
                    <span className="font-mono text-xs text-brand-text shrink-0">
                      ≈ {formatUsd(fromUsdValue)}
                    </span>
                  )}
                </div>
              </div>

              {/* Output */}
              <div className="grid gap-1 min-w-0">
                <label className="text-xs text-brand-subtle">
                  Estimated output
                </label>
                <button
                  type="button"
                  className="h-11 w-full rounded-xl bg-black/20 text-left px-3 text-sm font-mono overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  {quote.outFormatted
                    ? `${quote.outFormatted.slice(0, 14)} ${toSymbol}`
                    : `0.0 ${toSymbol}`}
                </button>

                <div className="flex items-center justify-between text-[11px] text-brand-subtle min-w-0">
                  <span className="truncate">
                    {!amountInRaw ? (
                      <>Output depends on price and fees.</>
                    ) : !canReadOnSei ? (
                      <>Switch to Sei EVM to fetch a quote.</>
                    ) : quote.isLoading ? (
                      <>Fetching quote…</>
                    ) : quote.outFormatted ? (
                      <>Estimated output with slippage protection.</>
                    ) : (
                      <>
                        No quote available
                        {quote.errorMessage ? ` (${quote.errorMessage})` : ""}.
                      </>
                    )}
                  </span>

                  {toUsdValue !== null && formatUsd(toUsdValue) && (
                    <span className="font-mono text-xs text-brand-text shrink-0">
                      ≈ {formatUsd(toUsdValue)}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrimaryClick}
                disabled={swapDisabled}
                className={`h-11 w-full rounded-2xl text-sm font-semibold transition-transform duration-150 ${
                  swapDisabled
                    ? "cursor-not-allowed bg-brand-subtle/30 text-brand-subtle"
                    : "bg-brand-primary text-black hover:scale-[1.01]"
                }`}
              >
                {primaryLabel}
              </button>

              <div className="border-t border-white/10 pt-3" />
              <LiveStats />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href={URL.tokenExplorer}
              className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5"
              target="_blank"
              rel="noreferrer"
            >
              View on Seitrace
            </a>
            <a
              href={URL.dexFull}
              className="text-xs rounded-lg border border-white/10 px-3 py-2 text-center hover:bg-white/5"
              target="_blank"
              rel="noreferrer"
            >
              View full chart
            </a>
          </div>
        </div>
      </div>

      <SwapSuccessToast
        open={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
        txHash={txForToast}
        toSymbol={toSymbol}
      />

      <SwapErrorToast
        open={showErrorToast}
        onClose={() => {
          setShowErrorToast(false);
          setErrorToastMessage(undefined);
        }}
        errorMessage={errorToastMessage}
      />
    </section>
  );
}