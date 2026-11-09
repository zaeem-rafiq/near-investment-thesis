// Generated offline from data/public; do not edit.
export const MODEL_INPUTS = {
  "startingSupply": {
    "value": 1310576026.3527384,
    "source": "data/public/bigquery/supply.json: closing_supply_yocto / 1e24, week 2026-10-26",
    "status": "measured"
  },
  "startMonth": {
    "value": 24322,
    "source": "data/public/bigquery/supply.json: November 2026 start, following the final T3 week",
    "status": "assumption"
  },
  "realizedShare": {
    "value": 0.9925247957251583,
    "source": "data/public/bigquery/supply.json: 52-week issuance / (2.5% × mean of weekly opening/closing supply midpoints)",
    "status": "measured"
  },
  "yearlyBurn": {
    "value": 500289.9359618764,
    "source": "data/public/bigquery/supply.json: sum of supply_falls_yocto / 1e24 over 52 T3 weeks",
    "status": "measured"
  },
  "price": {
    "value": 4.284,
    "source": "data/public/prices.json: NEAR/USD close on 2026-11-01",
    "status": "measured"
  },
  "yearlyNetBuying": {
    "value": 52082185.44805232,
    "source": "data/public/position-results.json: Check 1 final netUsd after revenue-wallet recipient/sender exclusions over 52 T3 weeks",
    "status": "measured"
  },
  "yearlyBuybacks": {
    "value": 10901549.077100066,
    "source": "data/public/position-results.json: 36-week Check 2 receivedUsd at weekly prices × 52/36; annualized gross receipts, not observed annual revenue",
    "status": "annualized"
  }
};
export const MODEL_SCENARIOS = {
  "bear": {
    "startingSupply": 1310576026.3527384,
    "startMonth": 24322,
    "realizedShare": 0.9925247957251583,
    "yearlyBurn": 500289.9359618764,
    "price": 4.284,
    "yearlyNetBuying": -12332694.074183963,
    "yearlyBuybacks": 13931523.81421362,
    "yearlyBuyingGrowth": 0,
    "cut": 0,
    "activationMonth": 24326
  },
  "base": {
    "startingSupply": 1310576026.3527384,
    "startMonth": 24322,
    "realizedShare": 0.9925247957251583,
    "yearlyBurn": 500289.9359618764,
    "price": 4.284,
    "yearlyNetBuying": 52082185.44805232,
    "yearlyBuybacks": 19340920.533066,
    "yearlyBuyingGrowth": 0,
    "cut": 1,
    "activationMonth": 24326
  },
  "bull": {
    "startingSupply": 1310576026.3527384,
    "startMonth": 24322,
    "realizedShare": 0.9925247957251583,
    "yearlyBurn": 500289.9359618764,
    "price": 4.284,
    "yearlyNetBuying": 139432214.81203818,
    "yearlyBuybacks": 24273938.52005554,
    "yearlyBuyingGrowth": 0,
    "cut": 1,
    "activationMonth": 24326
  }
};
