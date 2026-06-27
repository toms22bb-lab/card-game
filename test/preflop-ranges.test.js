'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { handInToken, recommendPreflopRfi } = require('../src/preflop-ranges');

test('matches plus notation for pairs and suited hands', () => {
  assert.equal(handInToken('QQ', '22+'), true);
  assert.equal(handInToken('A5s', 'A2s+'), true);
  assert.equal(handInToken('A5o', 'A2s+'), false);
});

test('recommends opens from simplified position ranges', () => {
  const open = recommendPreflopRfi({ heroHand: ['As', '5s'], position: 'BTN' });
  assert.equal(open.action, 'raise');
  assert.equal(open.sizeBb, 2.5);

  const fold = recommendPreflopRfi({ heroHand: ['7d', '2c'], position: 'UTG' });
  assert.equal(fold.action, 'fold');
});
