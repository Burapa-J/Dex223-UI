/**
 * Per-gas price for a conversion review, taken from the settings the transaction will submit.
 * EIP-1559 is capped at maxFeePerGas: base fee plus the priority fee cannot be shown above it.
 * Each price field is a required key so a legacy price and an EIP-1559 price stay distinct.
 */
type LegacyGasPrice = { gasPrice: bigint | undefined };
type Eip1559GasPrice = {
  maxFeePerGas: bigint | undefined;
  maxPriorityFeePerGas: bigint | undefined;
};

export function feePerGasWei(
  settings: LegacyGasPrice | Eip1559GasPrice | undefined,
  baseFee?: bigint,
): bigint | undefined {
  if (!settings) {
    return undefined;
  }

  if ("gasPrice" in settings) {
    return settings.gasPrice;
  }

  if (settings.maxFeePerGas === undefined) {
    return undefined;
  }

  if (baseFee === undefined) {
    return settings.maxFeePerGas;
  }

  const withTip = baseFee + (settings.maxPriorityFeePerGas ?? BigInt(0));
  return settings.maxFeePerGas < withTip ? settings.maxFeePerGas : withTip;
}
