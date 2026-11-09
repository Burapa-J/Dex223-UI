import { ApolloQueryResult, useQuery } from "@apollo/client";
import gql from "graphql-tag";
import { useMemo } from "react";
import { Address } from "viem";

import {
  GqlPosition,
  serializeGqlOrder,
  serializeGqlPosition,
} from "@/app/[locale]/margin-trading/hooks/helpers";
import {
  GQL_ORDER_FIELDS,
  GQL_POSITION_FIELDS,
} from "@/app/[locale]/margin-trading/hooks/queryParts";
import { MarginPosition } from "@/app/[locale]/margin-trading/types";
import { chainToApolloClient } from "@/graphql/thegraph/apollo";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import useMarginModuleApolloClient from "@/hooks/useMarginModuleApolloClient";
import { useTokenListLogos } from "@/hooks/useTokenListLogos";
import { DexChainId } from "@/sdk_bi/chains";

const queryOwner = gql(`
  query GetPositions($owner: String!) {
    positions(first: 1000, where: {owner: $owner}, orderBy: createdAt, orderDirection: desc) {
      ${GQL_POSITION_FIELDS}
      order {
        ${GQL_ORDER_FIELDS}
      }
    }
  }
`);

const queryById = gql(`
  query GetPosition($id: ID!) {
    position(id: $id) {
      ${GQL_POSITION_FIELDS}
      order {
        ${GQL_ORDER_FIELDS}
      }
    }
  }
`);

export function usePositionsByOwner({ owner }: { owner: Address | undefined }): {
  loading: boolean;
  positions: MarginPosition[];
} {
  const apolloClient = useMarginModuleApolloClient();
  const chainId = useCurrentChainId();
  const logos = useTokenListLogos();

  const { data, loading } = useQuery<any, any>(queryOwner, {
    variables: {
      owner,
    },
    skip: !apolloClient || !owner,
    pollInterval: 30000,
    client: apolloClient || chainToApolloClient[DexChainId.SEPOLIA],
  });

  const positions = useMemo(() => {
    if (!data?.positions) {
      return [];
    }

    return data.positions.map((position: GqlPosition) => {
      return {
        ...serializeGqlPosition(position, chainId, logos),
        order: serializeGqlOrder(position.order, chainId, logos),
      };
    });
  }, [chainId, logos, data]);

  return { loading, positions };
}

export default function useMarginPositionById({ id }: { id: string | undefined }): {
  loading: boolean;
  position: MarginPosition | undefined;
  refetch: (variables?: Partial<any> | undefined) => Promise<ApolloQueryResult<any>>;
} {
  const apolloClient = useMarginModuleApolloClient();
  const chainId = useCurrentChainId();
  const logos = useTokenListLogos();

  const { data, loading, refetch } = useQuery<any, any>(queryById, {
    variables: {
      id,
    },
    skip: !apolloClient || !id,
    pollInterval: 30000,
    client: apolloClient || chainToApolloClient[DexChainId.SEPOLIA],
  });

  const position = useMemo(() => {
    if (!data?.position?.order) {
      return undefined;
    }

    return {
      ...serializeGqlPosition(data.position, chainId, logos),
      order: serializeGqlOrder(data.position.order, chainId, logos),
    };
  }, [chainId, logos, data]);

  return { loading, position, refetch };
}
