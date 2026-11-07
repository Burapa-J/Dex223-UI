import { ApolloError, useQuery } from "@apollo/client";
import gql from "graphql-tag";
import { useEffect, useMemo, useRef, useState } from "react";
import { Address } from "viem";

import { collectPages } from "@/app/[locale]/margin-trading/helpers/collectPages";
import {
  GqlOrder,
  GqlPosition,
  serializeGqlOrder,
  serializeGqlPosition,
} from "@/app/[locale]/margin-trading/hooks/helpers";
import {
  GQL_ORDER_FIELDS,
  GQL_POSITION_FIELDS,
} from "@/app/[locale]/margin-trading/hooks/queryParts";
import { LendingOrder } from "@/app/[locale]/margin-trading/types";
import { SortingType } from "@/components/buttons/IconButton";
import daysToSeconds from "@/functions/daysToSeconds";
import { chainToApolloClient } from "@/graphql/thegraph/apollo";
import useCurrentChainId from "@/hooks/useCurrentChainId";
import useMarginModuleApolloClient from "@/hooks/useMarginModuleApolloClient";
import { useTokenListLogos } from "@/hooks/useTokenListLogos";
import { DexChainId } from "@/sdk_bi/chains";

const queryAllOrders = gql`
  query GetOrders($orderBy: String, $orderDirection: String, $where: Order_filter) {
    orders(orderBy: $orderBy, orderDirection: $orderDirection, where: $where) {
      ${GQL_ORDER_FIELDS}
      positions {
        ${GQL_POSITION_FIELDS}
      }
    }
  }
`;

const queryOwner = gql(`
  query GetOrders($owner: String!) {
    orders(where: {owner: $owner}) {
      ${GQL_ORDER_FIELDS}
      positions(first: 1000, orderBy: createdAt, orderDirection: desc) {
        ${GQL_POSITION_FIELDS}
      }
    }
  }
`);

const queryId = gql(`
  query GetOrders($id: Int!, $positionsSkip: Int = 0) {
    order(id: $id) {
      ${GQL_ORDER_FIELDS}
      positions(first: 1000, skip: $positionsSkip, orderBy: createdAt, orderDirection: desc) {
        ${GQL_POSITION_FIELDS}
      }
    }
  }
`);

export function useOrder({ id }: { id: number }): {
  loading: boolean;
  order: LendingOrder | undefined;
  refetch: any;
  error?: Error;
} {
  const apolloClient = useMarginModuleApolloClient();
  const chainId = useCurrentChainId();
  const logos = useTokenListLogos();

  const { data, loading, refetch, error } = useQuery<any, any>(queryId, {
    variables: {
      id,
    },
    skip: !apolloClient,
    pollInterval: 30000,
    client: apolloClient || chainToApolloClient[DexChainId.SEPOLIA],
  });

  const [pages, setPages] = useState<{ source: any; positions: GqlPosition[]; error?: Error }>();
  useEffect(() => {
    const source = data?.order;
    const client = apolloClient || chainToApolloClient[DexChainId.SEPOLIA];
    if (!source || (source.positions?.length ?? 0) < 1000) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const loadPositions = async () => {
      try {
        const positions = await collectPages<GqlPosition>(
          source.positions,
          async (offset) => {
            if (cancelled) throw new Error("Order changed");
            const result = await client.query({
              query: queryId,
              variables: { id, positionsSkip: offset },
              fetchPolicy: "network-only",
            });
            if (!result.data?.order) throw new Error("Order could not be loaded");
            return result.data.order.positions;
          },
          1000,
        );
        if (!cancelled) setPages({ source, positions });
      } catch (error) {
        if (cancelled) return;
        setPages({ source, positions: [], error: error as Error });
        // Apollo preserves the source object when polling returns unchanged data.
        // Retry independently so a temporary page failure can recover in that case.
        retryTimer = setTimeout(loadPositions, 30000);
      }
    };
    void loadPositions();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [apolloClient, data?.order, id]);
  const completePages = pages?.source === data?.order ? pages : undefined;
  const loadingPages = Boolean(data?.order?.positions?.length === 1000 && !completePages);

  const order = useMemo(() => {
    if (!data?.order) {
      return undefined;
    }

    return {
      ...serializeGqlOrder(data.order, chainId, logos),
      positions: (completePages?.positions ?? data.order.positions ?? []).map(
        (position: GqlPosition) => {
          return serializeGqlPosition(position, chainId, logos);
        },
      ),
    };
  }, [chainId, logos, completePages?.positions, data]);

  return {
    loading: loading || loadingPages,
    order: completePages?.error ? undefined : order,
    refetch,
    error: error ?? completePages?.error,
  };
}

type OrdersWhere = {
  leverage_lte?: number;
  minLoanFormatted_gte?: number;
  balanceFormatted_gte?: number;
  currencyLimit_lte?: number;
  duration_lte?: number;
  duration_gte?: number;
  interestRate_lte?: number;
  baseAsset_in?: Address[];
  or?: { collaterals_contains?: Address[] }[]; // SINGLE Address
  whitelist_?: {
    or?: { allowedForTrading_contains?: Address[] }[]; // SINGLE Address
  };
  alive: boolean;
  deadline_gt: number;
};

export function useOrders({
  sortingDirection,
  orderBy,
  leverage_lte,
  currencyLimit_lte,
  duration_lte,
  duration_gte,
  interestRate_lte,
  minLoanFormatted_gte,
  balanceFormatted_gte,
  baseAsset_in,
  collateralAssets_filter,
  tradableAssets_filter,
}: {
  sortingDirection: SortingType;
  orderBy: string;
  leverage_lte: string;
  currencyLimit_lte?: string;
  duration_lte?: string;
  duration_gte?: string;
  interestRate_lte?: string;
  minLoanFormatted_gte?: string;
  balanceFormatted_gte?: string;
  baseAsset_in?: Address[];
  collateralAssets_filter?: Address[];
  tradableAssets_filter?: Address[];
}): {
  loading: boolean;
  orders: LendingOrder[];
  error: ApolloError | undefined;
  isFilterActive: boolean;
} {
  const apolloClient = useMarginModuleApolloClient();
  const chainId = useCurrentChainId();
  const logos = useTokenListLogos();
  const requestTimeRef = useRef<number>(Date.now());

  const where = useMemo(() => {
    const f: OrdersWhere = {
      alive: true,
      deadline_gt: +(requestTimeRef.current / 1000).toFixed(0),
    };
    // helper to turn "" or undefined into undefined, else +string
    const toNum = (raw?: string) => {
      if (!raw || raw.trim() === "") return undefined;
      const n = Number(raw);
      return isNaN(n) ? undefined : n;
    };

    const lev = toNum(leverage_lte);
    if (lev != null) f.leverage_lte = lev;

    const minLoanF = toNum(minLoanFormatted_gte);
    if (minLoanF != null) f.minLoanFormatted_gte = minLoanF;

    const minBalanceF = toNum(balanceFormatted_gte);
    if (minBalanceF != null) f.balanceFormatted_gte = minBalanceF;

    const curLim = toNum(currencyLimit_lte);
    if (curLim != null) f.currencyLimit_lte = curLim;

    const durL = toNum(duration_lte);
    if (durL != null) f.duration_lte = daysToSeconds(durL);

    const durG = toNum(duration_gte);
    if (durG != null) f.duration_gte = daysToSeconds(durG);

    const ir = toNum(interestRate_lte);
    if (ir != null) f.interestRate_lte = ir;

    if (baseAsset_in?.length) f.baseAsset_in = baseAsset_in;

    if (collateralAssets_filter?.length) {
      f.or = collateralAssets_filter.map((address) => ({
        collaterals_contains: [address],
      }));
    }

    if (tradableAssets_filter?.length) {
      f.whitelist_ = {
        or: tradableAssets_filter.map((address) => ({
          allowedForTrading_contains: [address],
        })),
      };
    }

    return f;
  }, [
    leverage_lte,
    minLoanFormatted_gte,
    balanceFormatted_gte,
    currencyLimit_lte,
    duration_lte,
    duration_gte,
    interestRate_lte,
    baseAsset_in,
    collateralAssets_filter,
    tradableAssets_filter,
  ]);

  const { data, loading, error } = useQuery<any, any>(queryAllOrders, {
    variables: {
      orderBy: sortingDirection !== SortingType.NONE ? orderBy : undefined,
      orderDirection: sortingDirection !== SortingType.NONE ? sortingDirection : undefined,
      where,
    },
    skip: !apolloClient,
    pollInterval: 30000,
    client: apolloClient || chainToApolloClient[DexChainId.SEPOLIA],
  });

  const orders = useMemo(() => {
    if (!data) {
      return data;
    }

    return data.orders.map((order: GqlOrder) => {
      return {
        ...serializeGqlOrder(order, chainId, logos),
        positions: order.positions.map((position: GqlPosition) => {
          return serializeGqlPosition(position, chainId, logos);
        }),
      };
    });
  }, [chainId, logos, data]);

  const isFilterActive = Object.keys(where).some((key) => key !== "alive" && key !== "deadline_gt");

  return { loading, orders, error, isFilterActive };
}

export function useOrdersByOwner({ owner }: { owner: Address | undefined }): {
  loading: boolean;
  orders: LendingOrder[];
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

  const orders = useMemo(() => {
    if (!data) {
      return data;
    }

    return data.orders.map((order: GqlOrder) => {
      return {
        ...serializeGqlOrder(order, chainId, logos),
        positions: order.positions.map((position: GqlPosition) => {
          return serializeGqlPosition(position, chainId, logos);
        }),
      };
    });
  }, [chainId, logos, data]);

  return { loading, orders };
}
