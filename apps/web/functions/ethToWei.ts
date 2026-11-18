import { parseUnits } from "viem";

/**
 * ETH amount to wei, or undefined when it isn't a plain decimal. `toFixed` switches to exponent
 * notation from 1e21, which parseUnits rejects; that threw during render and took down the whole
 * edit-order page (Dario, order 7: test-token prices on Sepolia made a 10 dUSDT20 reward 3.4e27 ETH).
 */
export function ethToWei(value: number): bigint | undefined {
  if (!Number.isFinite(value) || value <= 0 || value >= 1e21) return undefined;
  try {
    return parseUnits(value.toFixed(18), 18);
  } catch {
    return undefined;
  }
}
