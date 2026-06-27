'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { PokerGtoBot, normalizeHand } = require('../src/poker-gto-bot');

test('normalizes concrete hole cards to canonical preflop classes', () => {
  assert.equal(normalizeHand(['As', 'Ks']), 'AKs');
  assert.equal(normalizeHand(['7d', '2c']), '72o');
  assert.equal(normalizeHand(['Ah', 'Ac']), 'AA');
});

test('selects matching precomputed scenario action', () => {
  const bot = PokerGtoBot.fromFile(undefined, { rng: () => 0.1 });
  const decision = bot.decide({
    street: 'preflop',
    position: 'BB',
    effectiveStackBb: 101,
    heroHand: ['As', '5s'],
    line: 'BTN_R2.5'
  });

  assert.equal(decision.source, 'precomputed');
  assert.equal(decision.scenarioId, 'cash-100bb-bb-vs-btn-open-a5s');
  assert.equal(decision.action, 'raise');
  assert.equal(decision.sizeBb, 10);
});

test('respects mixed strategy frequencies with injected rng', () => {
  const bot = PokerGtoBot.fromFile(undefined, { rng: () => 0.9 });
  const decision = bot.decide({
    street: 'flop',
    position: 'BTN',
    effectiveStackBb: 97.5,
    heroHand: 'AKo',
    board: ['Ks', '7d', '2c'],
    line: 'BTN_R2.5_BB_CALL;BB_X'
  });

  assert.equal(decision.action, 'check');
});

test('returns fallback action when no scenario matches', () => {
  const bot = PokerGtoBot.fromFile();
  const decision = bot.decide({
    street: 'river',
    position: 'SB',
    effectiveStackBb: 50,
    heroHand: '32o',
    board: 'AsKdQcJh9s',
    line: 'UNKNOWN'
  });

  assert.equal(decision.source, 'fallback');
  assert.equal(decision.action, 'check');
});
