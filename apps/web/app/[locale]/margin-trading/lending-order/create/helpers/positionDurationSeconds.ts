/**
 * Length of one loan in seconds, from the "Margin positions duration" field (days). The interest
 * "for the entire period" is what one position pays over its full duration, the same figure the
 * order details page shows. The wizard used the time left until the order deadline instead, so a
 * 30-day loan at 0.4% a month showed 0.016% when the deadline was a day away (Dario, order 7).
 */
export function positionDurationSeconds(days: string | number | undefined): number {
  const value = Number(days);
  return Number.isFinite(value) && value > 0 ? value * 24 * 60 * 60 : 0;
}
