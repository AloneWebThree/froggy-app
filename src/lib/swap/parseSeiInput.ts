import { parseUnits } from "viem";

export function parseSeiInput(input: string): {
  raw: string;
  units: bigint | null;
  number: number;
} {
  const raw = input.trim().replace(",", ".");
  if (!raw) return { raw, units: null, number: 0 };

  // allow: "1", "1.", "1.2", ".2"
  const normalized = raw.startsWith(".") ? `0${raw}` : raw;

  // reject anything not numeric-ish
  if (!/^\d+(\.\d*)?$/.test(normalized)) return { raw: normalized, units: null, number: 0 };

  // avoid NaN from "1."
  const cleaned = normalized.endsWith(".") ? normalized.slice(0, -1) : normalized;
  if (!cleaned) return { raw: normalized, units: null, number: 0 };

  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return { raw: normalized, units: null, number: 0 };

  try {
    const units = parseUnits(cleaned, 18);
    if (units <= 0n) return { raw: normalized, units: null, number: 0 };
    return { raw: normalized, units, number: n };
  } catch {
    return { raw: normalized, units: null, number: 0 };
  }
}