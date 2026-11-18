import { decodeErrorResult, type Hash, type Hex, type PublicClient } from "viem";

import { getTxErrorCategory } from "@/app/[locale]/revenue/lib/txError";

/**
 * The margin module reverts with short codes (MM01-MM38, Dex223-contracts
 * docs/margin-revert-codes.md) to stay under the contract size limit. These helpers find the code
 * in a viem / wallet error so the UI can show the sentence from `MarginErrors.<code>`.
 */

export type MarginRevert = {
  /** "MM22" etc. when the revert came from the margin module. */
  code?: string;
  /** The wallet's or RPC's short message, shown when there is no code. */
  shortMessage?: string;
  /** The transaction that reverted on chain, if one was sent. */
  hash?: Hash;
};

const CODE = /\bMM\d{2}\b/;

function codeFromRevertData(data: unknown): string | undefined {
  if (typeof data !== "string" || !data.startsWith("0x08c379a0")) return undefined;
  try {
    const decoded = decodeErrorResult({ data: data as Hex });
    const reason = String(decoded.args?.[0] ?? "");
    return reason.match(CODE)?.[0];
  } catch {
    return undefined;
  }
}

/** Finds an MMxx code anywhere in a (nested) viem error. */
export function getMarginRevertCode(error: unknown): string | undefined {
  let current: any = error;
  for (let depth = 0; current && depth < 8; depth++) {
    if (typeof current === "string") return current.match(CODE)?.[0];

    for (const value of [
      current.reason,
      current.data?.errorName === "Error" ? current.data?.args?.[0] : undefined,
      current.shortMessage,
      current.details,
      current.message,
    ]) {
      const found = typeof value === "string" ? value.match(CODE)?.[0] : undefined;
      if (found) return found;
    }
    const fromData = codeFromRevertData(current.data) ?? codeFromRevertData(current.data?.data);
    if (fromData) return fromData;

    current = current.cause;
  }
  return undefined;
}

export function isUserRejection(error: unknown) {
  return getTxErrorCategory(error) === "rejected";
}

export function toMarginRevert(error: unknown, hash?: Hash): MarginRevert {
  const code = getMarginRevertCode(error);
  const shortMessage = code
    ? undefined
    : String((error as any)?.shortMessage ?? (error as any)?.message ?? "").split("\n")[0] ||
      undefined;
  return { code, shortMessage, hash };
}

/**
 * A mined transaction that reverted carries no reason in its receipt. Replaying it against the
 * block it was mined in returns the same revert, and with it the code.
 */
export async function getMinedRevert(
  publicClient: PublicClient,
  hash: Hash,
): Promise<MarginRevert> {
  try {
    const [tx, receipt] = await Promise.all([
      publicClient.getTransaction({ hash }),
      publicClient.getTransactionReceipt({ hash }),
    ]);
    await publicClient.call({
      account: tx.from,
      to: tx.to ?? undefined,
      data: tx.input,
      value: tx.value,
      gas: tx.gas,
      blockNumber: receipt.blockNumber,
    });
    return { hash };
  } catch (error) {
    return toMarginRevert(error, hash);
  }
}
