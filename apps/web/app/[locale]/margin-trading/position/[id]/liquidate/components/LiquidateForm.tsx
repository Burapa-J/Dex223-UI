import Alert from "@repo/ui/alert";
import Checkbox from "@repo/ui/checkbox";
import Tooltip from "@repo/ui/tooltip";
import { useLocale, useTranslations } from "next-intl";
import React, { useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

import MarginGasSettings from "@/app/[locale]/margin-trading/components/MarginGasSettings";
import usePositionLiquidationCost from "@/app/[locale]/margin-trading/hooks/usePositionLiquidationCost";
import usePositionStatus from "@/app/[locale]/margin-trading/position/[id]/hooks/usePositionStatus";
import ConfirmLiquidatePositionDialog from "@/app/[locale]/margin-trading/position/[id]/liquidate/components/ConfirmLiquidatePositionDialog";
import useLiquidatePosition from "@/app/[locale]/margin-trading/position/[id]/liquidate/hooks/useLiquidatePosition";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { useSwapRecentTransactionsStore } from "@/app/[locale]/swap/stores/useSwapRecentTransactions";
import Button, { ButtonColor } from "@/components/buttons/Button";
import IconButton, {
  IconButtonSize,
  IconButtonVariant,
  IconSize,
} from "@/components/buttons/IconButton";
import RadioButton from "@/components/buttons/RadioButton";
import { formatFloat } from "@/functions/formatFloat";
import { useNativeCurrency } from "@/hooks/useNativeCurrency";
import { Currency } from "@/sdk_bi/entities/currency";

function PositionInfoCard({
  label1,
  label2,
  value1,
  value2,
  tooltip1,
  tooltip2,
  currency,
  currency2,
}: {
  label1: string;
  label2: string;
  value1: string;
  value2: string;
  tooltip1: string;
  tooltip2: string;
  currency: Currency;
  currency2?: Currency;
}) {
  return (
    <div className="bg-quaternary-bg rounded-3 px-5 py-2.5">
      <div className="text-tertiary-text text-14 flex items-center gap-1">
        {label1} <Tooltip iconSize={20} text={tooltip1} /> / {label2}{" "}
        <Tooltip iconSize={20} text={tooltip2} />
      </div>
      <div className="">
        {value1} <span className="text-secondary-text">{currency.symbol}</span> / {value2}{" "}
        <span className="text-secondary-text">{(currency2 ?? currency).symbol}</span>
      </div>
    </div>
  );
}

enum TypeOfReceivedAssets {
  LOANED_CURRENCY,
  BORROWER_CURRENCIES,
}

enum ActionWithAssets {
  RETURN_TO_ORDER,
  SEND_TO_ADDRESS,
}

export default function LiquidateForm({ position }: { position: MarginPosition }) {
  const t = useTranslations("Margin");
  const locale = useLocale();
  const nativeCurrency = useNativeCurrency();
  const { formatted: liquidationCost } = usePositionLiquidationCost(position);
  const [isLiquidateDialogOpened, setIsLiquidateDialogOpened] = useState(false);

  const { handleLiquidatePosition } = useLiquidatePosition(position);

  const [checkedPrices, setCheckedPrices] = useState(false);
  const [checkedTerms, setCheckedTerms] = useState(false);

  const { address } = useAccount();
  const { isOpened: showRecentTransactions, setIsOpened: setShowRecentTransactions } =
    useSwapRecentTransactionsStore();

  const { expectedBalance, actualBalance } = usePositionStatus(position);

  return (
    <div className="w-full max-w-[600px] bg-primary-bg rounded-5 card-spacing-x card-spacing-b">
      <div className="h-[60px] mb-2.5 flex justify-between items-center -mx-3">
        <IconButton
          variant={IconButtonVariant.BACK}
          iconSize={IconSize.REGULAR}
          buttonSize={IconButtonSize.LARGE}
          onClick={() => {
            window.history.back();
          }}
        />
        <h3 className="font-bold text-20">{t("liquidation")}</h3>
        <div className="flex items-center relative left-3">
          <IconButton
            buttonSize={IconButtonSize.LARGE}
            active={showRecentTransactions}
            iconName="recent-transactions"
            onClick={() => setShowRecentTransactions(!showRecentTransactions)}
          />
        </div>
      </div>
      <p className="text-secondary-text mb-4">{t("liquidation_intro")}</p>

      <div className="flex flex-col gap-5">
        <div className="bg-tertiary-bg rounded-3 flex flex-col gap-3 pb-5 px-5 pt-3">
          <div className="flex justify-between items-center">
            <h2 className="text-secondary-text font-bold">{t("position_to_liquidate")}</h2>
            <div className="px-4 py-2 rounded-2 bg-quaternary-bg text-12">
              <span className="text-tertiary-text">{t("order_id")}:</span>
              <span className="text-secondary-text">{position.id}</span>
            </div>
          </div>

          <PositionInfoCard
            value1={
              actualBalance
                ? formatFloat(formatUnits(actualBalance, position.loanAsset.decimals))
                : t("loading")
            }
            value2={
              expectedBalance
                ? formatFloat(formatUnits(expectedBalance, position.loanAsset.decimals))
                : t("loading")
            }
            currency={position.loanAsset}
            label1={t("total_balance")}
            label2={t("expected_balance")}
            tooltip1={t("total_balance_position_tooltip")}
            tooltip2={t("expected_balance_tooltip")}
          />
          <PositionInfoCard
            value1={position.order.liquidationRewardAmount.formatted}
            value2={liquidationCost}
            currency={position.order.liquidationRewardAsset}
            currency2={nativeCurrency}
            label1={t("liquidation_fee")}
            label2={t("liquidation_cost")}
            tooltip1={t("liquidation_fee_position_tooltip")}
            tooltip2={t("liquidation_cost_tooltip")}
          />
        </div>

        {address?.toLowerCase() === position.order.owner.toLowerCase() && (
          <div className="bg-tertiary-bg rounded-3 flex flex-col gap-3 pb-5 px-5 pt-3">
            <h2 className="text-secondary-text font-bold">{t("type_of_received_assets")}</h2>

            <div className="grid grid-cols-2 gap-3">
              <RadioButton className="min-h-10 py-2 pr-4" isActive={true}>
                {t("loaned_currency")}
              </RadioButton>
              <RadioButton disabled className="min-h-10 py-2 pr-4" isActive={false}>
                {t("borrower_currencies")}
              </RadioButton>
            </div>
          </div>
        )}

        {address?.toLowerCase() === position.order.owner.toLowerCase() && (
          <div className="bg-tertiary-bg rounded-3 flex flex-col gap-3 pb-5 px-5 pt-3">
            <h2 className="text-secondary-text font-bold">{t("action_with_assets")}</h2>

            <div className="grid grid-cols-2 gap-3">
              <RadioButton className="min-h-10 py-2 pr-4" isActive={true}>
                {t("return_to_order")}
              </RadioButton>
              <RadioButton disabled className="min-h-10 py-2 pr-4" isActive={false}>
                {t("send_to_address")}
              </RadioButton>
            </div>
          </div>
        )}

        <Alert text={t("prices_may_differ")} withIcon={false} type="warning" />

        <div className="flex flex-col gap-3">
          <Alert text={t("freeze_then_liquidate")} withIcon={false} type="info" />

          <div className="flex flex-col gap-4 py-2">
            <Checkbox
              checked={checkedPrices}
              handleChange={() => setCheckedPrices(!checkedPrices)}
              id={"agree-liquidation"}
              label={t("agree_prices_differ")}
            />

            <Checkbox
              checked={checkedTerms}
              handleChange={() => setCheckedTerms(!checkedTerms)}
              id={"agree-terms"}
              label={
                <span>
                  {t("agree_terms_prefix")}{" "}
                  <a
                    className="text-green underline"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`/${locale}/guidelines`}
                  >
                    {t("terms_of_liquidation")}
                  </a>
                </span>
              }
            />
          </div>

          <MarginGasSettings operation="liquidatePosition" />
        </div>

        {!position.isLiquidated ? (
          <Button
            fullWidth
            onClick={() => {
              setIsLiquidateDialogOpened(true);
              handleLiquidatePosition();
            }}
            disabled={!checkedTerms || !checkedPrices}
            colorScheme={ButtonColor.RED}
          >
            {t("liquidate_position")}
          </Button>
        ) : (
          <Button fullWidth disabled>
            {t("position_already_liquidated")}
          </Button>
        )}
      </div>

      <ConfirmLiquidatePositionDialog
        isOpen={isLiquidateDialogOpened}
        setIsOpen={setIsLiquidateDialogOpened}
        position={position}
      />
    </div>
  );
}
