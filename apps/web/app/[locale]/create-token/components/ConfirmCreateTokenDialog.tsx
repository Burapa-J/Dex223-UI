import Alert from "@repo/ui/alert";
import Image from "next/image";
import { useTranslations } from "next-intl";
import React, { useEffect, useMemo } from "react";

import useCreateToken from "@/app/[locale]/create-token/hooks/useCreateToken";
import { useCreateTokenDialogStore } from "@/app/[locale]/create-token/hooks/useCreateTokenDialogStore";
import {
  CreateTokenStatus,
  useCreateTokenStatusStore,
} from "@/app/[locale]/create-token/stores/useCreateTokenStatusStore";
import SwapDetailsRow from "@/app/[locale]/swap/components/SwapDetailsRow";
import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import EmptyStateIcon from "@/components/atoms/EmptyStateIcon";
import Svg from "@/components/atoms/Svg";
import Button, { ButtonColor } from "@/components/buttons/Button";
import IconButton, { IconButtonSize, IconButtonVariant } from "@/components/buttons/IconButton";
import OperationStepRow, {
  OperationRows,
  operationStatusToStepStatus,
  OperationStepStatus,
} from "@/components/common/OperationStepRow";
import { networks } from "@/config/networks";
import { IconName } from "@/config/types/IconName";
import getExplorerLink, { ExplorerLinkType } from "@/functions/getExplorerLink";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { Link } from "@/i18n/routing";

type StepTextMap = {
  [key in OperationStepStatus]: string;
};

type OperationStepConfig = {
  iconName: IconName;
  textMap: StepTextMap;
  pending: CreateTokenStatus;
  loading: CreateTokenStatus;
  error: CreateTokenStatus;
};

function composeCreateTokensSteps(
  t: ReturnType<typeof useTranslations>,
  createWrapper: boolean,
): OperationStepConfig[] {
  const deployTokenStep: OperationStepConfig = {
    iconName: "deploy-token",
    pending: CreateTokenStatus.PENDING_CREATE_TOKEN,
    loading: CreateTokenStatus.LOADING_CREATE_TOKEN,
    error: CreateTokenStatus.ERROR_CREATE_TOKEN,
    textMap: {
      [OperationStepStatus.IDLE]: t("create_new_token"),
      [OperationStepStatus.AWAITING_SIGNATURE]: t("confirm_creation"),
      [OperationStepStatus.LOADING]: t("executing_creation"),
      [OperationStepStatus.STEP_COMPLETED]: t("token_created"),
      [OperationStepStatus.STEP_FAILED]: t("create_failed"),
      [OperationStepStatus.OPERATION_COMPLETED]: t("token_created"),
    },
  };

  const createWrapperStep: OperationStepConfig = {
    iconName: "token-version",
    pending: CreateTokenStatus.PENDING_CREATE_WRAPPER,
    loading: CreateTokenStatus.LOADING_CREATE_WRAPPER,
    error: CreateTokenStatus.ERROR_CREATE_WRAPPER,
    textMap: {
      [OperationStepStatus.IDLE]: t("create_erc20_version"),
      [OperationStepStatus.AWAITING_SIGNATURE]: t("confirm_erc20"),
      [OperationStepStatus.LOADING]: t("creating_erc20"),
      [OperationStepStatus.STEP_COMPLETED]: t("erc20_created"),
      [OperationStepStatus.STEP_FAILED]: t("erc20_failed"),
      [OperationStepStatus.OPERATION_COMPLETED]: t("erc20_created"),
    },
  };

  return createWrapper ? [deployTokenStep, createWrapperStep] : [deployTokenStep];
}

function CreateTokenActionButton({
  handleCreateToken,
  createWrapper,
}: {
  handleCreateToken: () => Promise<void>;
  createWrapper: boolean;
}) {
  const t = useTranslations("CreateToken");
  const { status, createTokenHash, createWrapperHash } = useCreateTokenStatusStore();

  const hashes = useMemo(() => {
    return createWrapper ? [createTokenHash, createWrapperHash] : [createTokenHash];
  }, [createTokenHash, createWrapper, createWrapperHash]);

  if (status !== CreateTokenStatus.INITIAL) {
    return (
      <OperationRows>
        {composeCreateTokensSteps(t, createWrapper).map((step, index) => (
          <OperationStepRow
            key={index}
            iconName={step.iconName}
            hash={hashes[index]}
            statusTextMap={step.textMap}
            status={operationStatusToStepStatus({
              currentStatus: status,
              orderedSteps: composeCreateTokensSteps(t, createWrapper).flatMap((s) => [
                s.pending,
                s.loading,
                s.error,
              ]),
              stepIndex: index,
              pendingStep: step.pending,
              loadingStep: step.loading,
              errorStep: step.error,
              successStep: CreateTokenStatus.SUCCESS,
            })}
            isFirstStep={index === 0}
          />
        ))}
      </OperationRows>
    );
  }

  return (
    <Button onClick={() => handleCreateToken()} fullWidth>
      {t("confirm_creating")}
    </Button>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-tertiary-bg rounded-3 flex flex-col gap-1 px-5 py-4 text-14">
      <span className="text-secondary-text">{title}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** One contract of the new token: full address, Copy and View on explorer (Figma page 05). */
function TokenContractRow({
  label,
  address,
  chainId,
}: {
  label: string;
  address: string;
  chainId: number;
}) {
  const t = useTranslations("CreateToken");
  return (
    <div className="flex items-center gap-2 bg-tertiary-bg rounded-3 px-4 py-2.5">
      <div className="flex flex-col min-w-0 flex-grow">
        <span className="text-12 text-secondary-text">{label}</span>
        <span className="text-14 font-medium break-all">{address}</span>
      </div>
      <IconButton
        variant={IconButtonVariant.COPY}
        buttonSize={IconButtonSize.SMALL}
        text={address}
      />
      <a
        href={getExplorerLink(ExplorerLinkType.ADDRESS, address, chainId)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("view_on_explorer")}
        className="text-secondary-text hocus:text-primary-text duration-200 flex-shrink-0"
      >
        <Svg size={20} iconName="forward" />
      </a>
    </div>
  );
}

export default function ConfirmCreateTokenDialog({
  createTokenSettings,
}: {
  createTokenSettings: {
    name: string;
    symbol: string;
    totalSupply: string;
    imageURL: string;
    allowMintForOwner: boolean;
    createERC20: boolean;
  };
}) {
  const t = useTranslations("CreateToken");
  const tManage = useTranslations("ManageTokens");
  const chainId = useCurrentChainId();
  const { isOpen, setIsOpen } = useCreateTokenDialogStore();
  const { status, setStatus } = useCreateTokenStatusStore();
  const {
    handleCreateToken,
    setTokenAddress,
    tokenAddress,
    erc20Address,
    isReceiptUnavailable,
    setIsReceiptUnavailable,
  } = useCreateToken(createTokenSettings);
  const isInitialStatus = useMemo(() => status === CreateTokenStatus.INITIAL, [status]);
  const isFinalStatus = useMemo(
    () =>
      status === CreateTokenStatus.SUCCESS ||
      status === CreateTokenStatus.ERROR_CREATE_TOKEN ||
      status === CreateTokenStatus.ERROR_CREATE_WRAPPER,
    [status],
  );

  const isLoadingStatus = useMemo(
    () => !isInitialStatus && !isFinalStatus,
    [isFinalStatus, isInitialStatus],
  );

  useEffect(() => {
    if (!isOpen && (status === CreateTokenStatus.ERROR_CREATE_TOKEN || isReceiptUnavailable)) {
      setStatus(CreateTokenStatus.INITIAL);
      setTokenAddress(null);
      setIsReceiptUnavailable(false);
      return;
    }

    if (isFinalStatus && !isOpen) {
      const timeout = setTimeout(() => {
        setStatus(CreateTokenStatus.INITIAL);
        setTokenAddress(null);
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [
    isFinalStatus,
    isOpen,
    isReceiptUnavailable,
    setIsReceiptUnavailable,
    setStatus,
    setTokenAddress,
    status,
  ]);

  const network = useMemo(() => {
    return networks.find((t) => t.chainId === chainId);
  }, [chainId]);

  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={setIsOpen}>
      <DialogHeader onClose={() => setIsOpen(false)} title={t("dialog_title")} />
      <div className="md:w-[600px] card-spacing-x card-spacing-b">
        {isInitialStatus && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Card title={t("token_name")} value={createTokenSettings.name} />
              <Card title={tManage("symbol")} value={createTokenSettings.symbol} />
            </div>

            <div className="rounded-3 bg-tertiary-bg px-5 py-3 flex justify-between items-center">
              <span className="text-14 text-secondary-text">{t("total_supply")}</span>

              <div className="flex items-center gap-1">
                <span>{createTokenSettings.totalSupply}</span>
                <span className="text-14 text-secondary-text">{createTokenSettings.symbol}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 py-4">
              <SwapDetailsRow
                title={t("issuing")}
                value={createTokenSettings.allowMintForOwner ? t("allowed") : t("not_allowed")}
                tooltipText={t("issuing_tooltip")}
              />
              <SwapDetailsRow
                title={t("make_erc20")}
                value={createTokenSettings.createERC20 ? t("yes") : t("no")}
                tooltipText={t("erc20_tooltip")}
              />
            </div>

            <div className="pb-4">
              <Alert
                className="ui-bg-tertiary-bg"
                text={
                  <p className="">
                    {t.rich("deploy_notice", {
                      network: () => (
                        <span className="text-primary-text relative inline-block pl-6 ml-0.5">
                          <Image
                            className="absolute -left-0"
                            width={20}
                            height={20}
                            src={network?.logo || ""}
                            alt=""
                          />
                          {network?.name}
                        </span>
                      ),
                    })}
                  </p>
                }
                type={"info-border"}
              />
            </div>
          </div>
        )}

        {isLoadingStatus && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Card title={t("token_name")} value={createTokenSettings.name} />
              <Card title={tManage("symbol")} value={createTokenSettings.symbol} />
            </div>

            <div className="rounded-3 bg-tertiary-bg px-5 py-4 flex justify-between">
              <span className="text-14 text-secondary-text">{t("total_supply")}</span>

              <div className="flex items-center gap-1">
                <span>{createTokenSettings.totalSupply}</span>
                <span className="text-14 text-secondary-text">{createTokenSettings.symbol}</span>
              </div>
            </div>
            <div className="h-px w-full bg-secondary-border mb-4 mt-5" />
          </div>
        )}

        {isFinalStatus && (
          <div>
            <div className="mx-auto w-[80px] h-[80px] flex items-center justify-center relative mb-5">
              {status === CreateTokenStatus.ERROR_CREATE_TOKEN && (
                <EmptyStateIcon iconName="warning" />
              )}

              {(status === CreateTokenStatus.SUCCESS ||
                status === CreateTokenStatus.ERROR_CREATE_WRAPPER) && (
                <>
                  <div className="w-[54px] h-[54px] rounded-full border-[7px] blur-[8px] opacity-80 border-green" />
                  <Svg
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green"
                    iconName={"success"}
                    size={65}
                  />
                </>
              )}
            </div>
            {(status === CreateTokenStatus.SUCCESS ||
              status === CreateTokenStatus.ERROR_CREATE_WRAPPER) && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 ">{t("success_title")}</h2>
                <p className="text-center">{t("success_body")}</p>
              </div>
            )}
            {status === CreateTokenStatus.ERROR_CREATE_TOKEN && (
              <div>
                <h2 className="text-center mb-1 font-bold text-20 ">{t("fail_title")}</h2>
              </div>
            )}
            <div className="h-px w-full bg-secondary-border mb-4 mt-5" />
          </div>
        )}

        <CreateTokenActionButton
          createWrapper={createTokenSettings.createERC20}
          handleCreateToken={handleCreateToken}
        />

        {status === CreateTokenStatus.ERROR_CREATE_WRAPPER && (
          <Alert className="mt-4 mb-1" type="error" text={t("wrapper_failed")} />
        )}

        {(status === CreateTokenStatus.SUCCESS ||
          status === CreateTokenStatus.ERROR_CREATE_WRAPPER) &&
          tokenAddress && (
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t("token_contracts")}</span>
                <span className="text-12 text-secondary-text">
                  {t("token_symbol_decimals", {
                    symbol: createTokenSettings.symbol ?? "",
                    decimals: 18,
                  })}
                </span>
              </div>
              <TokenContractRow
                label={t("erc223_contract_address")}
                address={tokenAddress}
                chainId={chainId}
              />
              {erc20Address && (
                <TokenContractRow
                  label={t("erc20_contract_address")}
                  address={erc20Address}
                  chainId={chainId}
                />
              )}
            </div>
          )}

        {(status === CreateTokenStatus.SUCCESS ||
          status === CreateTokenStatus.ERROR_CREATE_WRAPPER) && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Link href={tokenAddress ? `/add?tier=3000&tokenA=${tokenAddress}` : "/add?tier=3000"}>
              <Button
                className="border-green disabled:bg-green-bg disabled:opacity-50"
                colorScheme={ButtonColor.LIGHT_GREEN}
                fullWidth
              >
                {t("create_pool")}
              </Button>
            </Link>
            <Link
              href={
                tokenAddress ? `/token-listing/add?tokenA=${tokenAddress}` : "/token-listing/add"
              }
            >
              <Button
                className="border-green disabled:bg-green-bg disabled:opacity-50"
                colorScheme={ButtonColor.LIGHT_GREEN}
                fullWidth
              >
                {t("list_token")}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </DrawerDialog>
  );
}
