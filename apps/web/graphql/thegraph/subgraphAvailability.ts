import { ApolloError } from "@apollo/client";

export const SUBGRAPH_UNAVAILABLE_MESSAGE = "Subgraph not configured for this network";

export function subgraphUnavailableError() {
  return new ApolloError({ errorMessage: SUBGRAPH_UNAVAILABLE_MESSAGE });
}

export function isSubgraphUnavailable(error: { message?: string } | null | undefined) {
  return error?.message === SUBGRAPH_UNAVAILABLE_MESSAGE;
}
