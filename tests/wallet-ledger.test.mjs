import test from 'node:test';
import assert from 'node:assert/strict';
import { exactYocto, parsePage, classifyTransfer, walletLedger, weekOf } from '../scripts/wallet-ledger.mjs';

const W = 'buybacks.multisignature.near', ns = day => String(Date.parse(day) * 1e6);
const receipt = (id, sender, receiver, deposit, { ok = true, day = '2026-03-04', height = 10, actions } = {}) => ({
  receipt_id: id, predecessor_account_id: sender, receiver_account_id: receiver, block_timestamp: ns(day),
  receipt_block: { block_height: height }, receipt_outcome: ok == null ? null : { status: ok },
  actions: actions || [{ action: 'TRANSFER', deposit }]
});

test('exact yocto keeps integer lexemes and flags rounded scientific values', () => {
  assert.equal(exactYocto('6e+24').yocto, 6n * 10n ** 24n);
  assert.equal(exactYocto('1234567890123456789012345').yocto, 1234567890123456789012345n);
  assert.equal(exactYocto('1.2345678901234567e+24').rounded, true);
  assert.equal(exactYocto('1.5e+24').rounded, false);
  assert.equal(parsePage('{"txns":[{"actions":[{"deposit":1234567890123456789012345}]}]}').txns[0].actions[0].deposit, '1234567890123456789012345');
});

test('classification follows the owner rule: outside in, wrap/system not received, outside out, internal excluded', () => {
  assert.equal(classifyTransfer(receipt('a', 'someone.near', W), W), 'in');
  assert.equal(classifyTransfer(receipt('b', 'wrap.near', W), W), 'not_received');
  assert.equal(classifyTransfer(receipt('c', 'system', W), W), 'not_received');
  assert.equal(classifyTransfer(receipt('d', W, 'someone.near'), W), 'out');
  assert.equal(classifyTransfer(receipt('e', 'fefundsadmin.sputnik-dao.near', W), W), 'internal_in');
  assert.equal(classifyTransfer(receipt('f', W, 'fefundsadmin.sputnik-dao.near'), W), 'internal_out');
});

test('ledger counts only successful TRANSFER actions, weekly by UTC Monday, and reports missing outcomes', () => {
  const rows = [
    receipt('1', 'x.near', W, '100', { day: '2026-02-23' }),
    receipt('2', 'x.near', W, '7', { day: '2026-03-01' }),
    receipt('3', W, 'y.near', '30', { day: '2026-03-02' }),
    receipt('4', 'system', W, '5', { day: '2026-03-02' }),
    receipt('5', 'x.near', W, '999', { ok: false }),
    receipt('6', 'x.near', W, '999', { ok: null }),
    receipt('7', 'x.near', W, '0', { actions: [{ action: 'FUNCTION_CALL', deposit: '50' }] }),
    receipt('8', '1csfundsadmin.sputnik-dao.near', W, '40'),
    receipt('9', 'x.near', W, '11', { day: '2025-01-01' }),
    receipt('10', 'x.near', W, '1000', { height: 99 })
  ];
  const ftRows = [
    { affected_account_id: W, involved_account_id: 'z.near', delta_amount: '20', block_timestamp: ns('2026-03-03'), block: { block_height: 9 } },
    { affected_account_id: W, involved_account_id: 'fefundsadmin.sputnik-dao.near', delta_amount: '20', block_timestamp: ns('2026-03-03') },
    { affected_account_id: W, involved_account_id: 'z.near', delta_amount: '-3', block_timestamp: ns('2026-03-03') }
  ];
  const l = walletLedger(W, rows, { maxHeight: 50, ftRows });
  assert.deepEqual(l.totals, { in: 118n, out: 30n, not_received: 5n, internal_in: 40n, internal_out: 0n });
  assert.equal(l.ledgerBalance, 93n); assert.equal(l.balanceWithInternal, 133n);
  assert.equal(l.audit.missingOutcomes, 1); assert.equal(l.audit.failedTransfers, 1); assert.equal(l.audit.afterSnapshot, 1);
  assert.equal(l.weeks[0].week, '2026-02-23'); assert.equal(l.weeks[0].inNear, 107n);
  assert.equal(l.weeks[1].out, 30n); assert.equal(l.weeks[1].notReceived, 5n); assert.equal(l.weeks[1].inWnear, 20n);
  assert.equal(weekOf(ns('2026-03-01')), '2026-02-23');
});
