import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function splitIntoTwoUint256BE(src: Uint8Array): [Uint8Array, Uint8Array] {
  const limb0 = new Uint8Array(32);
  const limb1 = new Uint8Array(32);

  // copy first 32 bytes -> limb0[0..len0-1]
  const len0 = Math.min(32, src.length);
  limb0.set(src.subarray(0, len0), 0);

  // copy remaining bytes -> limb1[0..len1-1]
  const rem = src.subarray(len0);
  const len1 = Math.min(32, rem.length);
  limb1.set(rem.subarray(0, len1), 0);

  return [limb0, limb1];
}

/** Convert 32-byte big-endian bytes -> BigInt (0..2^256-1) */
export function be32ToBigInt(b32: Uint8Array): bigint {
  // Using hex is simple & clear; EVM uses big-endian for uint256 by convention.
  const hex = Buffer.from(b32).toString("hex");
  return BigInt(`0x${hex}`);
}