export const NEAR_ASSET_IDS = [
  'nep141:wrap.near',
  'nep245:v2_1.omni.hot.tg:56_SZzgw3HSudhZcTwPWUTi2RJB19t',
  '1cs_v1:hypercore:hip1:0x20b8c9d2f022ffd2aea4f7962b7b1d8b',
  '1cs_v1:sol:spl:3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG'
];
export const REVENUE_WALLETS = [
  'fefundsadmin.sputnik-dao.near', '1csfundsadmin.sputnik-dao.near', 'buybacks.multisignature.near'
];
export const POSITION_WINDOW = { start: '2025-11-03', end: '2026-11-02' };
export const RECIPIENT_DIR = 'data/raw/near-participants/2025-11-03_2026-11-02';
// Probe on 2026-11-09: a 30-day wrap.near filter returned HTTP 500 after 41 s; 7 days returned 200 in 8.8 s.
// Only the hypercore buy filter returned 200 over the full window (2.5 s), so only it keeps one window.
export const PULL_WINDOW_DAYS = 7;
export const FULL_WINDOW_PULLS = [{ side: 'buys', asset: '1cs_v1:hypercore:hip1:0x20b8c9d2f022ffd2aea4f7962b7b1d8b' }];
export const PARTICIPANT_RETRIES = { maxRetries: 6, maxBackoffMs: 60000 };
