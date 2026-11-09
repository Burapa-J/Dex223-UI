import type { Address, PublicClient } from "viem";
import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  parseUnits,
  UserRejectedRequestError,
} from "viem";

export const MINT_TEST_TOKEN_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_recipient", type: "address" },
      { internalType: "uint256", name: "_quantity", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "NotOwner",
    type: "error",
  },
] as const;

type MintCandidate = {
  address0: Address;
  decimals: number;
};

export function isUserRejected(error: unknown): boolean {
  if (error instanceof BaseError && error.walk((err) => err instanceof UserRejectedRequestError)) {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /user rejected|user denied|rejected the request/i.test(message);
}

export function mintRevertReason(error: unknown): string | undefined {
  if (!(error instanceof BaseError)) return undefined;
  const reverted = error.walk((err) => err instanceof ContractFunctionRevertedError);
  if (!(reverted instanceof ContractFunctionRevertedError)) return undefined;
  if (reverted.reason) return reverted.reason;
  const errorName = reverted.data?.errorName;
  if (errorName && errorName !== "Error" && errorName !== "Panic") return errorName;
  return undefined;
}

export function isDefiniteMintRevert(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  if (error.walk((err) => err instanceof ContractFunctionRevertedError)) return true;
  if (error.walk((err) => err instanceof ContractFunctionZeroDataError)) return true;
  const text = `${error.shortMessage ?? ""} ${error.message ?? ""}`.toLowerCase();
  return /revert|returned no data|function .* does not exist/.test(text);
}

const MINT_CHECK_BATCH = 5;

export async function findMintableTokens<T extends MintCandidate>(
  publicClient: PublicClient,
  tokens: T[],
  account: Address,
  amount: string,
): Promise<{ mintable: T[]; unchecked: T[] }> {
  const mintable: T[] = [];
  const unchecked: T[] = [];

  for (let index = 0; index < tokens.length; index += MINT_CHECK_BATCH) {
    const batch = tokens.slice(index, index + MINT_CHECK_BATCH);
    const results = await Promise.all(
      batch.map(async (token) => {
        let quantity: bigint;
        try {
          quantity = parseUnits(amount, token.decimals);
        } catch {
          return { token, outcome: "revert" as const };
        }

        try {
          await publicClient.simulateContract({
            abi: MINT_TEST_TOKEN_ABI,
            address: token.address0,
            functionName: "mint",
            args: [account, quantity],
            account,
          });
          return { token, outcome: "ok" as const };
        } catch (error) {
          return {
            token,
            outcome: isDefiniteMintRevert(error) ? ("revert" as const) : ("unknown" as const),
          };
        }
      }),
    );

    for (const result of results) {
      if (result.outcome === "ok") mintable.push(result.token);
      if (result.outcome === "unknown") unchecked.push(result.token);
    }
  }

  return { mintable, unchecked };
}
