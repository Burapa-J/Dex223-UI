const GQL_TOKEN_FIELDS = `
  addressERC20
  addressERC223
  decimals
  id
  name
  symbol
`;

export const GQL_POSITION_FIELDS = `
  owner
  loanAmount
  deadline
  isLiquidated
  isClosed
  assets {
    address
    balance
    id
  }
  baseAssetToken {
     ${GQL_TOKEN_FIELDS}
  }
  assetsTokens {
    ${GQL_TOKEN_FIELDS}
  }
  id
  createdAt
  closedAt
  liquidatedAt
  liquidator
  txClosed
  txFrozen
  txLiquidated
  collateralAmount
  frozenTime
  collateralToken {
    ${GQL_TOKEN_FIELDS}
  }
  leverage
`;

export const GQL_ORDER_FIELDS = `
    id
    owner
    balance
    leverage
    alive
    collaterals
    collateralTokens {
     ${GQL_TOKEN_FIELDS}
    }
    baseAsset
    baseAssetToken {
     ${GQL_TOKEN_FIELDS}
    }
    currencyLimit
    deadline
    duration
    whitelist {
      allowedForTrading
      allowedForTradingTokens {
        ${GQL_TOKEN_FIELDS}
      }
      autoListing
      id
    }
    interestRate
    liquidationRewardAmount
    liquidationRewardAsset
    liquidationRewardAssetToken {
      ${GQL_TOKEN_FIELDS}
    }
    minLoan
    createdAt
`;
