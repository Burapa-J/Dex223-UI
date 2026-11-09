import type { Hash, TransactionReceipt } from "viem";

type ReceiptClient = {
  waitForTransactionReceipt: (args: { hash: Hash }) => Promise<TransactionReceipt>;
  getTransactionReceipt: (args: { hash: Hash }) => Promise<TransactionReceipt>;
};

export async function readSwapReceipt(
  client: ReceiptClient,
  hash: Hash,
  error?: unknown,
): Promise<TransactionReceipt | null> {
  const carried = receiptOnError(error);
  if (carried) return carried;

  try {
    return await client.waitForTransactionReceipt({ hash });
  } catch (error) {
    console.error(error);
    const carried = receiptOnError(error);
    if (carried) {
      return carried;
    }

    try {
      return await client.getTransactionReceipt({ hash });
    } catch (readError) {
      console.error(readError);
      return null;
    }
  }
}

export function swapOutcomeFromReceipt(
  receipt: { status: "success" | "reverted"; gasUsed: bigint } | null,
  gasLimit?: bigint,
): "success" | "out_of_gas" | "failed" | "pending" {
  if (!receipt) {
    return "pending";
  }

  if (receipt.status === "success") {
    return "success";
  }

  if (!gasLimit) {
    return "failed";
  }

  const ninetyEightPercent = (gasLimit * BigInt(98)) / BigInt(100);
  if (receipt.gasUsed >= ninetyEightPercent && receipt.gasUsed <= gasLimit) {
    return "out_of_gas";
  }

  return "failed";
}

function receiptOnError(error: unknown): TransactionReceipt | null {
  if (!error || typeof error !== "object" || !("transactionReceipt" in error)) {
    return null;
  }

  const receipt = (error as { transactionReceipt?: TransactionReceipt }).transactionReceipt;
  if (!receipt || (receipt.status !== "success" && receipt.status !== "reverted")) {
    return null;
  }

  return receipt;
}
