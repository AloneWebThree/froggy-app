"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type SwapFormState<From extends string, To extends string> = {
  fromSymbol: From;
  toSymbol: To;

  amount: string;
  debouncedAmount: string;

  approveExact: boolean;

  // setters (support value OR functional-updater where useful)
  setFromSymbol: (next: From | ((prev: From) => From)) => void;
  setToSymbol: (next: To | ((prev: To) => To)) => void;

  setAmount: (v: string) => void;

  setApproveExact: (next: boolean | ((prev: boolean) => boolean)) => void;
};

export type UseSwapFormArgs<From extends string, To extends string> = {
  initialFrom: From;
  initialTo: To;

  initialAmount?: string;

  debounceMs?: number;

  getAllowedToSymbols: (from: From) => To[];
};

function resolveNext<T>(prev: T, next: T | ((p: T) => T)): T {
  return typeof next === "function" ? (next as (p: T) => T)(prev) : next;
}

export function useSwapForm<From extends string, To extends string>(
  args: UseSwapFormArgs<From, To>
): SwapFormState<From, To> {
  const {
    initialFrom,
    initialTo,
    initialAmount = "",
    debounceMs = 300,
    getAllowedToSymbols,
  } = args;

  const [fromSymbol, _setFromSymbol] = useState<From>(initialFrom);
  const [toSymbol, _setToSymbol] = useState<To>(initialTo);

  const [amount, setAmount] = useState<string>(initialAmount);
  const [debouncedAmount, setDebouncedAmount] = useState<string>(initialAmount);

  const [approveExact, _setApproveExact] = useState<boolean>(true);

  // stable wrappers (no `any`, pass eslint exhaustive-deps)
  const setFromSymbol = useCallback((next: From | ((prev: From) => From)) => {
    _setFromSymbol((prev) => resolveNext(prev, next));
  }, []);

  const setToSymbol = useCallback((next: To | ((prev: To) => To)) => {
    _setToSymbol((prev) => resolveNext(prev, next));
  }, []);

  const setApproveExact = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    _setApproveExact((prev) => resolveNext(prev, next));
  }, []);

  // Debounce amount input to reduce quote spam
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amount), debounceMs);
    return () => clearTimeout(t);
  }, [amount, debounceMs]);

  // When changing the from token, revert to exact approvals (matches current behavior)
  useEffect(() => {
    _setApproveExact(true);
  }, [fromSymbol]);

  // Keep toSymbol valid for current fromSymbol
  useEffect(() => {
    const allowed = getAllowedToSymbols(fromSymbol);
    if (!allowed || allowed.length === 0) return;
    if (!allowed.includes(toSymbol)) _setToSymbol(allowed[0]);
  }, [fromSymbol, toSymbol, getAllowedToSymbols]);

  return useMemo(
    () => ({
      fromSymbol,
      toSymbol,
      amount,
      debouncedAmount,
      approveExact,
      setFromSymbol,
      setToSymbol,
      setAmount,
      setApproveExact,
    }),
    [fromSymbol, toSymbol, amount, debouncedAmount, approveExact, setFromSymbol, setToSymbol, setApproveExact]
  );
}