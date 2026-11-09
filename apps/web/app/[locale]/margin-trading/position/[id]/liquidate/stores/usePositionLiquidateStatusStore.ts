import { createOperationStatusStore } from "@/stores/factories/createOperationStatusStore";

export enum PositionLiquidateStatus {
  INITIAL,

  PENDING_FREEZE,
  LOADING_FREEZE,
  ERROR_FREEZE,

  PENDING_BLOCK_CONFIRMATION,
  LOADING_BLOCK_CONFIRMATION,
  ERROR_BLOCK_CONFIRMATION,

  PENDING_LIQUIDATE,
  LOADING_LIQUIDATE,
  ERROR_LIQUIDATE,

  SUCCESS,
  ALREADY_CLOSED,
  FREEZE_RENEWED,
}

export enum SwapError {
  OUT_OF_GAS,
  UNKNOWN,
}

export const usePositionLiquidateStatusStore = createOperationStatusStore({
  initialStatus: PositionLiquidateStatus.INITIAL,
  operations: ["positionFreeze", "positionLiquidate"],
  errorType: SwapError.UNKNOWN,
});
