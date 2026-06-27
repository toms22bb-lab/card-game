'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { normalizeHand } = require('./poker-gto-bot');

const RANKS = '23456789TJQKA';
const DEFAULT_RANGE_PATH = path.join(__dirname, '..', 'data', 'preflop-ranges.json');

function loadPreflopRanges(filePath = DEFAULT_RANGE_PATH) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function rankValue(rank) {
  return RANKS.indexOf(rank);
}

function handInToken(hand, token) {
  const normalized = normalizeHand(hand);
  const pair = normalized.length === 2 && normalized[0] === normalized[1];
  const suitedness = normalized[2];
  const high = normalized[0];
  const low = normalized[1];
  const clean = token.trim();

  if (clean === normalized) return true;
  if (!clean.endsWith('+')) return false;

  const base = clean.slice(0, -1);
  if (base.length === 2 && base[0] === base[1]) {
    return pair && rankValue(high) >= rankValue(base[0]);
  }

  if (pair || base.length !== 3 || suitedness !== base[2]) return false;
  if (high !== base[0]) return false;
  return rankValue(low) >= rankValue(base[1]);
}

function handInRange(hand, rangeTokens) {
  return rangeTokens.some((token) => handInToken(hand, token));
}

function recommendPreflopRfi({ heroHand, position, ranges = loadPreflopRanges() }) {
  const pos = String(position || '').toUpperCase();
  const tokens = ranges.ranges[pos];
  if (!tokens) return null;
  const inRange = handInRange(heroHand, tokens);
  return {
    action: inRange ? 'raise' : 'fold',
    sizeBb: inRange ? ranges.openSizeBb[pos] : 0,
    source: 'preflop-range-chart',
    mode: 'preflop-range-chart',
    position: pos,
    hand: normalizeHand(heroHand),
    confidence: 'medium',
    reason: inRange
      ? `${normalizeHand(heroHand)} is in the simplified ${pos} raise-first-in range.`
      : `${normalizeHand(heroHand)} is outside the simplified ${pos} raise-first-in range.`
  };
}

module.exports = {
  handInRange,
  handInToken,
  loadPreflopRanges,
  recommendPreflopRfi
};
