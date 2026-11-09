const BPS = 10_000n;
const SECONDS_IN_MONTH = 30n * 24n * 60n * 60n;

export function fullDurationInterest(
  loanAmount: bigint,
  interestRate: bigint | number | string,
  durationSeconds: bigint | number | string,
): bigint {
  const rate = BigInt(interestRate);
  const duration = BigInt(durationSeconds);
  if (loanAmount <= 0n || rate <= 0n || duration <= 0n) {
    return 0n;
  }

  return (loanAmount * rate * duration) / (BPS * SECONDS_IN_MONTH);
}

export function liquidationLevel(
  loanAmount: bigint,
  interest: bigint,
  maintenanceBps: bigint,
): bigint {
  return ((loanAmount + interest) * (BPS + maintenanceBps)) / BPS;
}

export function accruedLiquidationLevel(expectedBalance: bigint, maintenanceBps: bigint): bigint {
  if (expectedBalance <= 0n) {
    return 0n;
  }

  const numerator = expectedBalance * (BPS + maintenanceBps);
  return (numerator + BPS - 1n) / BPS;
}

export function scaleDecimals(amount: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) {
    return amount;
  }

  if (fromDecimals > toDecimals) {
    return amount / 10n ** BigInt(fromDecimals - toDecimals);
  }

  return amount * 10n ** BigInt(toDecimals - fromDecimals);
}

export function liquidationDropPercent(room: bigint, positionValue: bigint): number {
  if (positionValue <= 0n || room <= 0n) {
    return 0;
  }

  return Number((room * 100n + positionValue / 2n) / positionValue);
}

export function formatGroupedAmount(amount: bigint, decimals: number): string {
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(formatUnitsSafe(absolute, decimals)));

  return negative ? `-${formatted}` : formatted;
}

function formatUnitsSafe(amount: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = amount % scale;
  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fractionText}`;
}

export function formatMaintenanceMultiplier(maintenanceBps: bigint): string {
  const scaled = BPS + maintenanceBps;
  const whole = scaled / BPS;
  const fraction = scaled % BPS;
  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(4, "0").replace(/0+$/, "")}`;
}

export function formatMaintenancePercent(maintenanceBps: bigint): string {
  const whole = maintenanceBps / 100n;
  const fraction = maintenanceBps % 100n;
  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(2, "0").replace(/0+$/, "")}`;
}

export function formatShortDate(timestampSeconds: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestampSeconds * 1000));
}

export function formatFrozenAt(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatShortDate(timestampSeconds)} at ${hours}:${minutes}`;
}
