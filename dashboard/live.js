'use strict';
// Same-origin, read-only: fills one first-screen line from live.json, or keeps it hidden.
(() => {
  const line = document.getElementById('live-line');
  if (!line) return;
  const number = value => (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : NaN);
  const whole = n => Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const near = value => {
    const n = number(value);
    return Number.isFinite(n) ? `${n < 0 ? '−' : '+'}${whole(n)} NEAR` : 'unavailable';
  };
  const usd = value => {
    const n = number(value);
    return Number.isFinite(n) ? `${n < 0 ? '−' : ''}$${whole(n)}` : 'pending';
  };
  const day = iso => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US',
    { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  fetch('live.json', { credentials: 'same-origin', cache: 'no-store' })
    .then(response => { if (!response.ok) throw new Error('unavailable'); return response.json(); })
    .then(data => {
      const flow = data?.net1ClickFlow, coverage = data?.coverageSinceT3;
      if (!flow || !coverage || typeof data.asOf !== 'string' || !Number.isFinite(Date.parse(data.asOf))) throw new Error('invalid');
      const through = flow.value !== null && flow.status !== 'ok' && /^\d{4}-\d{2}-\d{2}$/.test(flow.through || '')
        ? ` (through ${day(flow.through)})` : '';
      const share = typeof coverage.coverage === 'number' && Number.isFinite(coverage.coverage)
        ? `${(coverage.coverage * 100).toFixed(1)}%` : 'pending';
      line.textContent = `Since November 2: net 1Click buying ${usd(flow.value)}${through}, revenue-wallet balances ` +
        `${near(coverage.walletBalanceChangeNear)}, NEAR supply ${near(coverage.supplyChangeNear)}. ` +
        `Provisional coverage ${share}, not a locked test. Updated ${day(data.asOf)}.`;
      line.hidden = false;
    })
    .catch(() => { line.hidden = true; });
})();
