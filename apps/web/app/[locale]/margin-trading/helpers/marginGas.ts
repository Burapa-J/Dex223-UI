import { Abi, Address, encodeFunctionData } from "viem";

export type MarginGasRequest = {
  abi: Abi;
  address: Address;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

export function getMarginGasRequest(request: MarginGasRequest) {
  return {
    to: request.address,
    data: encodeFunctionData(request),
    value: request.value,
  };
}

export function getMarginGasRequestKey(
  request: MarginGasRequest,
  chainId: number,
  account: Address,
) {
  const { to, data, value } = getMarginGasRequest(request);
  return `${chainId}:${account.toLowerCase()}:${to.toLowerCase()}:${data}:${value ?? 0n}`;
}

export function getMarginGasLimit(
  customGasLimit: bigint | undefined,
  estimatedGas: bigint,
  matchesPreview: boolean,
) {
  if (!matchesPreview || customGasLimit === undefined) return undefined;
  if (customGasLimit <= 0n || customGasLimit < estimatedGas) {
    throw new Error("Custom gas limit is below the transaction estimate");
  }
  return customGasLimit;
}
