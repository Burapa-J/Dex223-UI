export function formatFloat(
  value: number | string,
  options?: {
    significantDigits?: number;
    trimZero?: boolean;
  },
) {
  const numberValue = Number(value);
  const maximumSignificantDigits = options?.significantDigits ?? 2;

  // Number(undefined) and Number("") of a half-loaded value are NaN, which used to be
  // rendered literally - "NaN" in a balance, and "NaNundefined" once formatNumberKilos
  // appended a suffix to it.
  if (!Number.isFinite(numberValue)) {
    return "0";
  }

  // The magnitude checks below were written against the raw value, so every negative
  // number fell into the `< 1e-10` branch and rendered as "< 0.0001" - a loss shown as
  // a tiny positive amount. Price impact reaches this function and can be negative.
  const isNegative = numberValue < 0;
  const sign = isNegative ? "-" : "";
  const magnitude = Math.abs(numberValue);

  if (magnitude < 1e-10) {
    if (options?.trimZero || magnitude === 0) {
      return "0";
    }

    return `${sign}< 0.0001`;
  }

  if (magnitude < 1) {
    return (
      sign +
      magnitude.toLocaleString("en-US", {
        maximumSignificantDigits: maximumSignificantDigits,
      })
    );
  } else {
    const _value = magnitude.toFixed(maximumSignificantDigits);
    if (options?.trimZero) {
      return sign + _value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    }
    return sign + _value;
  }
}

export function formatLeverage(value: number | string): string {
  return `${formatFloat(value, { trimZero: true, significantDigits: 2 })}x`;
}

export function formatNumber(num: string, maxPrecision = 15) {
  const [integerPart] = num.toString().split(".");

  if (integerPart.length >= maxPrecision) {
    // If the integer part alone exceeds or matches the precision, return it as-is
    return parseFloat(num)
      .toPrecision(maxPrecision)
      .replace(/\.?0+$/, "");
  } else {
    // Limit the total length to maxPrecision
    const precisionNeeded = maxPrecision - integerPart.length;
    return parseFloat(num)
      .toPrecision(precisionNeeded)
      .replace(/\.?0+$/, "");
  }
}

export function formatNumberKilos(
  num: number,
  options?: {
    significantDigits?: number;
    trimZero?: boolean;
  },
): string {
  if (!Number.isFinite(num)) {
    return "0";
  }

  // Compare on magnitude so -5000 formats as "-5.00K" rather than falling through to
  // formatFloat, and so log10 is never handed a negative number.
  if (Math.abs(num) < 1000) {
    return formatFloat(num, options); // Numbers less than 1000 remain as is.
  }

  if (num < 0) {
    return `-${formatNumberKilos(Math.abs(num), options)}`;
  }

  const suffixes = ["K", "M", "B", "T"]; // Thousand, Million, Billion, Trillion
  let power = Math.floor(Math.log10(num) / 3); // Determine the power of 1000
  power = Math.min(power, suffixes.length); // Ensure it doesn't exceed defined suffixes
  const scaled = num / Math.pow(1000, power);

  return scaled.toFixed(options?.significantDigits ?? 2).replace(/\.0$/, "") + suffixes[power - 1];
}
