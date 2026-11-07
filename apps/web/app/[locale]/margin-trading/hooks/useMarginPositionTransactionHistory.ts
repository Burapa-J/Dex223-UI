import { useQuery } from "@apollo/client";
import gql from "graphql-tag";
import { useMemo } from "react";

import {
  MarginPositionRecentTransaction,
  serializeGqlRecentTransactions,
} from "@/app/[locale]/margin-trading/hooks/helpers";
import { chainToApolloClient } from "@/graphql/thegraph/apollo";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import useMarginModuleApolloClient from "@/hooks/useMarginModuleApolloClient";
import { useTokenListLogos } from "@/hooks/useTokenListLogos";
import { DexChainId } from "@/sdk_bi/chains";

const queryById = gql(`
  query GetPosition($id: ID!) {
    position(id: $id) {
      transactions(orderBy: timestamp) {
        id
        timestamp
        key
        positionClosed {
          id
        }
        positionDeposit {
          id
          assetToken {
            addressERC20
            addressERC223
            decimals
            id
            name
            symbol
          }
          amount
        }
        positionFrozen {
          id
        }
        positionLiquidated {
          id
        }
        positionOpened {
          id
          baseAssetToken {
            addressERC20
            addressERC223
            decimals
            id
            name
            symbol
          }
          loanAmount
        }
        positionWithdrawal {
          id
          assetToken {
            addressERC20
            addressERC223
            decimals
            id
            name
            symbol
          }
          quantity
        }
        marginSwap {
          amountIn
          amountOut
          assetInToken {
            addressERC20
            addressERC223
            decimals
            id
            name
            symbol
          }
          assetOutToken {
            addressERC20
            addressERC223
            decimals
            id
            name
            symbol
          }
        }
      }
    }
  }
`);

export default function useMarginPositionRecentTransactionsById({ id }: { id: string }): {
  loading: boolean;
  recentTransactions: MarginPositionRecentTransaction[];
} {
  const apolloClient = useMarginModuleApolloClient();
  const chainId = useCurrentChainId();
  const logos = useTokenListLogos();

  const { data, loading } = useQuery<any, any>(queryById, {
    variables: {
      id,
    },
    skip: !apolloClient || !id,
    pollInterval: 30000,
    client: apolloClient || chainToApolloClient[DexChainId.SEPOLIA],
  });

  const recentTransactions = useMemo(() => {
    if (!data) {
      return data;
    }

    return serializeGqlRecentTransactions(data.position.transactions, chainId, logos);
  }, [chainId, logos, data]);

  return { loading, recentTransactions };
}
