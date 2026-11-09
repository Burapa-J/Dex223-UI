import Alert from "@repo/ui/alert";
import Preloader from "@repo/ui/preloader";
import clsx from "clsx";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Address, formatUnits, parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient } from "wagmi";

import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import Popover from "@/components/atoms/Popover";
import ScrollbarContainer from "@/components/atoms/ScrollbarContainer";
import SelectButton from "@/components/atoms/SelectButton";
import Svg from "@/components/atoms/Svg";
import TextField, { InputLabel } from "@/components/atoms/TextField";
import Button from "@/components/buttons/Button";
import {
  findMintableTokens,
  isDefiniteMintRevert,
  isUserRejected,
  MINT_TEST_TOKEN_ABI,
  mintRevertReason,
} from "@/components/dialogs/mintTestTokens";
import { useConnectWalletDialogStateStore } from "@/components/dialogs/stores/useConnectWalletStore";
import { useMintTestTokensDialogStore } from "@/components/dialogs/stores/useMintTestTokensDialogStore";
import { ERC20_ABI } from "@/config/abis/erc20";
import { formatFloat } from "@/functions/formatFloat";
import { IIFE } from "@/functions/iife";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import { useTokenLists, useTokens } from "@/hooks/useTokenLists";
import addToast from "@/other/toast";
import { Token } from "@/sdk_bi/entities/token";
import { wrappedTokens } from "@/sdk_bi/entities/weth9";
import { useGlobalBlockNumber } from "@/shared/hooks/useGlobalBlockNumber";

export default function MintTestTokensDialog() {
  const t = useTranslations("MintTest");
  const tSwap = useTranslations("Swap");
  const tWallet = useTranslations("Wallet");
  const tManage = useTranslations("ManageTokens");
  const tRevenue = useTranslations("Revenue");
  const { isOpen, handleClose } = useMintTestTokensDialogStore();
  const tokenLists = useTokenLists();
  const listsReady = tokenLists !== undefined;
  const tokens = useTokens();
  const withoutWrapped = useMemo(() => {
    return tokens.filter((token): token is Token => token.isToken);
  }, [tokens]);

  const { setIsOpened: setOpenedWallet } = useConnectWalletDialogStateStore();
  const [isPopoverOpened, setPopoverOpened] = useState(false);

  const [amountToMint, setAmountToMint] = useState<string>("10000");
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const { address, isConnected } = useAccount();

  const chainId = useCurrentChainId();
  const publicClient = usePublicClient({ chainId });
  const wrappedNative = wrappedTokens[chainId];

  const { data: walletClient } = useWalletClient();

  const mintCandidates = useMemo(() => {
    const wrappedAddress = wrappedNative.address0.toLowerCase();
    return withoutWrapped.filter((token) => token.address0.toLowerCase() !== wrappedAddress);
  }, [withoutWrapped, wrappedNative]);

  const [mintCheck, setMintCheck] = useState<{ mintable: Token[]; unchecked: Token[] } | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!isOpen || !address || !publicClient || !listsReady) {
      setMintCheck(undefined);
      return;
    }

    if (!mintCandidates.length) {
      setMintCheck({ mintable: [], unchecked: [] });
      return;
    }

    let cancelled = false;
    setMintCheck(undefined);

    IIFE(async () => {
      const found = await findMintableTokens(publicClient, mintCandidates, address, amountToMint);
      if (!cancelled) setMintCheck(found);
    });

    return () => {
      cancelled = true;
    };
  }, [address, amountToMint, isOpen, listsReady, mintCandidates, publicClient]);

  const checkPending = Boolean(
    isOpen && address && publicClient && listsReady && mintCandidates.length,
  );
  const checking = isConnected && checkPending && mintCheck === undefined;
  const noneMintable =
    isConnected &&
    listsReady &&
    (mintCandidates.length === 0 ||
      (mintCheck !== undefined &&
        mintCheck.mintable.length === 0 &&
        mintCheck.unchecked.length === 0));

  const choices = useMemo(() => {
    if (!isConnected || !mintCheck) return mintCandidates;
    return [...mintCheck.mintable, ...mintCheck.unchecked];
  }, [isConnected, mintCandidates, mintCheck]);

  const [tokenToMint, setTokenToMint] = useState<Token | undefined>(mintCandidates[0]);

  useEffect(() => {
    if (!choices.length) return;
    if (tokenToMint && choices.some((token) => token.equals(tokenToMint))) return;
    setTokenToMint(choices[0]);
  }, [choices, tokenToMint]);

  const { data: balance, refetch } = useReadContract({
    abi: ERC20_ABI,
    functionName: "balanceOf",
    address: tokenToMint?.address0,
    chainId,
    args: [address as Address],
    query: {
      enabled: Boolean(tokenToMint && address),
    },
  });

  const { blockNumber } = useGlobalBlockNumber();

  useEffect(() => {
    refetch();
  }, [blockNumber, refetch]);

  const handleMint = useCallback(() => {
    if (!tokenToMint || !walletClient || !publicClient || !address) {
      addToast(t("bad_data"), "error");
      return;
    }

    IIFE(async () => {
      setIsLoading(true);

      const mintCall = {
        abi: MINT_TEST_TOKEN_ABI,
        address: tokenToMint.address0,
        functionName: "mint" as const,
        args: [address, parseUnits(amountToMint, tokenToMint.decimals)] as const,
      };

      try {
        let request;
        try {
          ({ request } = await publicClient.simulateContract({
            ...mintCall,
            account: address,
          }));
        } catch (error) {
          if (isUserRejected(error) || isDefiniteMintRevert(error)) throw error;
        }

        const hash = request
          ? await walletClient.writeContract({
              ...request,
              account: undefined,
              gas: request.gas != null ? request.gas + BigInt(10000) : undefined,
            })
          : await walletClient.writeContract(mintCall);

        setIsLoading(false);
        setIsPending(true);

        let receipt;
        try {
          receipt = await publicClient.waitForTransactionReceipt({ hash });
        } catch (error) {
          console.error(error);
          return;
        }

        if (receipt.status === "success") {
          addToast(t("minted"));
          void refetch();
        } else {
          addToast(t("mint_reverted"), "error");
        }
      } catch (error) {
        if (isUserRejected(error)) return;
        console.error(error);
        const reason = mintRevertReason(error);
        addToast(reason ? t("mint_failed_reason", { reason }) : t("mint_failed"), "error");
      } finally {
        setIsLoading(false);
        setIsPending(false);
      }
    });
  }, [address, amountToMint, publicClient, refetch, t, tokenToMint, walletClient]);

  const ref = useRef<HTMLButtonElement | null>(null);
  const showMintForm = !checking && !noneMintable;

  return (
    <DrawerDialog isOpen={isOpen} setIsOpen={handleClose}>
      <DialogHeader onClose={handleClose} title={t("title")} />
      <div className="mx-auto card-spacing rounded-2 bg-primary-bg md:w-[600px] w-full border border-transparent">
        {checking && (
          <div className="flex justify-center py-6">
            <Preloader color="green" />
          </div>
        )}

        {noneMintable && (
          <Alert
            type="info"
            text={
              <span className="break-all">
                {t.rich("none_mintable", {
                  symbol: wrappedNative.symbol ?? "WETH",
                  address: wrappedNative.address0,
                  discord: (chunks) => (
                    <a
                      href="https://discord.gg/t5bdeGC5Jk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green hocus:underline"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </span>
            }
          />
        )}

        {showMintForm && (
          <div className="flex flex-col gap-4 relative">
            <div>
              <InputLabel label={t("token_for_mint")} />
              <Popover
                placement="bottom-start"
                customOffset={5}
                isOpened={isPopoverOpened}
                setIsOpened={setPopoverOpened}
                trigger={
                  <SelectButton
                    ref={ref}
                    onClick={() => setPopoverOpened(!isPopoverOpened)}
                    fullWidth
                    size="large"
                    className={clsx(
                      "flex-shrink-0 pl-5 bg-tertiary-bg border border-transparent text-16 lg:text-16 lg:py-2",
                      isPopoverOpened && "bg-green-bg border-green shadow-green/60 shadow",
                    )}
                    isOpen={isPopoverOpened}
                  >
                    {tokenToMint?.symbol || tManage("select_token")}
                  </SelectButton>
                }
              >
                <ScrollbarContainer
                  height={172}
                  className="bg-tertiary-bg rounded-3 py-1"
                  style={{ width: ref.current?.getBoundingClientRect().width || 328 }}
                >
                  {choices.map((token) => {
                    return (
                      <button
                        key={token.address0}
                        onClick={() => {
                          setTokenToMint(token);
                          setPopoverOpened(false);
                        }}
                        className="flex w-full items-center gap-3 bg-tertiary-bg-bg hocus:bg-quaternary-bg duration-300 min-w-[250px] px-5 h-10 md:h-12 justify-between"
                      >
                        <span
                          className={
                            tokenToMint && token.equals(tokenToMint)
                              ? "text-green"
                              : "text-secondary-text"
                          }
                        >
                          {token.symbol}
                        </span>
                        {tokenToMint && token.equals(tokenToMint) && (
                          <Svg iconName="check" className="text-green" size={20} />
                        )}
                      </button>
                    );
                  })}
                </ScrollbarContainer>
              </Popover>
            </div>

            <TextField
              label={t("amount_label")}
              helperText={`${tSwap("balance")} ${balance && tokenToMint ? `${formatFloat(formatUnits(balance, tokenToMint.decimals))} ${tokenToMint.symbol}` : "0"}`}
              readOnly
              value={amountToMint}
              onChange={(e) => setAmountToMint(e.target.value)}
              placeholder={tRevenue("amount")}
              internalText={tokenToMint?.symbol}
              isNumeric
            />

            {isConnected ? (
              <Button disabled={isLoading || isPending || !tokenToMint} onClick={handleMint}>
                {isLoading && (
                  <span className="flex items-center gap-2">
                    <span>{tSwap("waiting_for_confirmation")}</span>
                    <Preloader color="green" />
                  </span>
                )}
                {isPending && (
                  <span className="flex items-center gap-2">
                    <span>{t("minting")}</span>
                    <Preloader color="green" />
                  </span>
                )}
                {!isLoading && !isPending && t("mint")}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setOpenedWallet(true);
                }}
              >
                {tWallet("connect_wallet")}
              </Button>
            )}
          </div>
        )}
      </div>
    </DrawerDialog>
  );
}
