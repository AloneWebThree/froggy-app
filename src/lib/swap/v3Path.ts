import { encodePacked, type Address } from "viem";

// UniswapV3 path encoding: tokenIn (20) + fee (3) + token (20) + fee (3) + tokenOut (20) ...
export function encodeV3Path(params: {
  tokens: readonly Address[];
  fees: readonly number[]; // uint24 each, length = tokens.length - 1
}) {
  const { tokens, fees } = params;

  if (tokens.length < 2) throw new Error("encodeV3Path: tokens length must be >= 2");
  if (fees.length !== tokens.length - 1) throw new Error("encodeV3Path: fees length mismatch");

  const types: ("address" | "uint24")[] = ["address"];
  const values: (Address | number)[] = [tokens[0]];

  for (let i = 0; i < fees.length; i++) {
    types.push("uint24", "address");
    values.push(fees[i], tokens[i + 1]);
  }

  return encodePacked(types, values);
}