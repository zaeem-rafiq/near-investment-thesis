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
    "value": 52082185.44805231,
    "source": "data/public/near_flows.json: sum of buys_usd minus sells_usd over 52 T3 weeks; before recipient/sender exclusions",
    "status": "provisional"
  },
  "yearlyBuybacks": {
    "value": 0,
    "source": "data/public/near_flows.json: no Check 2 receipts in the public snapshot; $0 placeholder, not measured zero",
    "status": "pending Check 2"
  }
};
