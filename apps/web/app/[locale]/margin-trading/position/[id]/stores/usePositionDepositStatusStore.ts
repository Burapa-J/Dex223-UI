import { createOperationStatusStore } from "@/stores/factories/createOperationStatusStore";

export enum PositionDepositStatus {
  INITIAL,

  PENDING_APPROVE,
  LOADING_APPROVE,
  ERROR_APPROVE,

  PENDING_TRANSFER,
  LOADING_TRANSFER,
  ERROR_TRANSFER,

  PENDING_DEPOSIT,
  LOADING_DEPOSIT,
  ERROR_DEPOSIT,

  SUCCESS,
}

export enum SwapError {
  OUT_OF_GAS,
  UNKNOWN,
  // A non-base deposit is valued through the oracle, which has no pool for this asset (contracts #197).
  NO_ORACLE_PRICE,
}

export const useDepositPositionStatusStore = createOperationStatusStore({
  initialStatus: PositionDepositStatus.INITIAL,
  operations: ["approve", "transfer", "deposit"],
  errorType: SwapError.UNKNOWN,
});
