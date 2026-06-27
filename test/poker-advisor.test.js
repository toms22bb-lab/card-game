'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { advise, evaluateCards, parseCards, streetFromBoard } = require('../src/poker-advisor');

test('parses spaced, comma separated, and compact card input', () => {
  assert.deepEqual(parseCards('As Ks'), ['As', 'Ks']);
  assert.deepEqual(parseCards('As,Ks,7d'), ['As', 'Ks', '7d']);
  assert.deepEqual(parseCards('AsKs7d'), ['As', 'Ks', '7d']);
});

test('infers street from table card count', () => {
  assert.equal(streetFromBoard([]), 'preflop');
  assert.equal(streetFromBoard(['Kh', '7d', '2c']), 'flop');
  assert.equal(streetFromBoard(['Kh', '7d', '2c', '9s']), 'turn');
  assert.equal(streetFromBoard(['Kh', '7d', '2c', '9s', 'Td']), 'river');
});

test('evaluates strong made hands from hero plus table cards', () => {
  const evaluation = evaluateCards(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '3c']);
  assert.equal(evaluation.category, 'straight_flush');
});

test('recommends an action from table cards without a precomputed line', () => {
  const decision = advise({
    heroCards: 'As Ks',
    board: 'Kh 7d 2c',
    potBb: 5.5,
    toCallBb: 0
  });

  assert.equal(decision.mode, 'table-card-advisor');
  assert.equal(decision.handCategory, 'pair');
  assert.equal(decision.action, 'check');
});

test('uses precomputed scenario when an exact action line is supplied', () => {
  const decision = advise({
    heroCards: 'As 5s',
    position: 'BB',
    effectiveStackBb: 100,
    line: 'BTN_R2.5',
    toCallBb: 1.5,
    potBb: 4
  });

  assert.equal(decision.mode, 'precomputed-gto');
  assert.equal(decision.scenarioId, 'cash-100bb-bb-vs-btn-open-a5s');
});

test('rejects duplicate cards between hero hand and table cards', () => {
  assert.throws(() => advise({ heroCards: 'As Ks', board: 'As 7d 2c' }), /Duplicate card/);
});


test('uses simplified public-study preflop range when no exact scenario is supplied', () => {
  const decision = advise({
    heroCards: 'As 5s',
    position: 'BTN',
    effectiveStackBb: 100
  });

  assert.equal(decision.mode, 'preflop-range-chart');
  assert.equal(decision.action, 'raise');
});
