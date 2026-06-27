'use strict';

const { PokerGtoBot, normalizeBoard } = require('./poker-gto-bot');
const { recommendPreflopRfi } = require('./preflop-ranges');

const RANK_VALUES = Object.freeze({ 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 });
const HAND_STRENGTH = Object.freeze({
  high_card: 1,
  pair: 2,
  two_pair: 3,
  trips: 4,
  straight: 5,
  flush: 6,
  full_house: 7,
  quads: 8,
  straight_flush: 9
});

function parseCards(cards) {
  if (!cards) return [];
  if (Array.isArray(cards)) return cards.map(normalizeCard);
  const compact = String(cards).replace(/[\s,]+/g, '');
  if (compact.length % 2 !== 0) throw new Error(`Cards must use rank+suit pairs, for example "As Kh" or "AsKh": ${cards}`);
  const parsed = [];
  for (let i = 0; i < compact.length; i += 2) parsed.push(normalizeCard(compact.slice(i, i + 2)));
  return parsed;
}

function normalizeCard(card) {
  if (typeof card !== 'string' || !/^[2-9TJQKA][cdhs]$/i.test(card.trim())) throw new Error(`Invalid card: ${card}`);
  return card.trim()[0].toUpperCase() + card.trim()[1].toLowerCase();
}

function assertNoDuplicates(cards) {
  const seen = new Set();
  for (const card of cards) {
    if (seen.has(card)) throw new Error(`Duplicate card supplied: ${card}`);
    seen.add(card);
  }
}

function evaluateCards(cards) {
  const normalized = parseCards(cards);
  if (normalized.length < 2) throw new Error('At least two cards are required to evaluate a poker hand.');
  assertNoDuplicates(normalized);

  const ranks = normalized.map((card) => RANK_VALUES[card[0]]);
  const suits = normalized.map((card) => card[1]);
  const rankCounts = countBy(ranks);
  const suitCounts = countBy(suits);
  const counts = [...rankCounts.values()].sort((a, b) => b - a);
  const hasFlush = [...suitCounts.values()].some((count) => count >= 5);
  const hasStraight = findStraightHigh(ranks) !== null;
  const hasStraightFlush = hasFlush && hasStraightFlushDrawOrMade(normalized).made;

  let category = 'high_card';
  if (hasStraightFlush) category = 'straight_flush';
  else if (counts[0] === 4) category = 'quads';
  else if (counts[0] === 3 && counts[1] >= 2) category = 'full_house';
  else if (hasFlush) category = 'flush';
  else if (hasStraight) category = 'straight';
  else if (counts[0] === 3) category = 'trips';
  else if (counts[0] === 2 && counts[1] === 2) category = 'two_pair';
  else if (counts[0] === 2) category = 'pair';

  return {
    category,
    score: HAND_STRENGTH[category],
    draws: detectDraws(normalized),
    cards: normalized
  };
}

function countBy(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return counts;
}

function findStraightHigh(ranks) {
  const unique = [...new Set(ranks)].sort((a, b) => a - b);
  if (unique.includes(14)) unique.unshift(1);
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    run = unique[i] === unique[i - 1] + 1 ? run + 1 : 1;
    if (run >= 5) return unique[i] === 1 ? 14 : unique[i];
  }
  return null;
}

function hasStraightFlushDrawOrMade(cards) {
  const bySuit = new Map();
  cards.forEach((card) => {
    const suited = bySuit.get(card[1]) || [];
    suited.push(RANK_VALUES[card[0]]);
    bySuit.set(card[1], suited);
  });
  return [...bySuit.values()].reduce((best, ranks) => ({
    made: best.made || findStraightHigh(ranks) !== null,
    draw: best.draw || hasOpenEndedStraightDraw(ranks)
  }), { made: false, draw: false });
}

function detectDraws(cards) {
  const ranks = cards.map((card) => RANK_VALUES[card[0]]);
  const suits = cards.map((card) => card[1]);
  const suitCounts = countBy(suits);
  const flushDraw = [...suitCounts.values()].some((count) => count === 4);
  const straightDraw = hasOpenEndedStraightDraw(ranks);
  const straightFlush = hasStraightFlushDrawOrMade(cards);
  return {
    flushDraw,
    straightDraw,
    straightFlushDraw: straightFlush.draw,
    comboDraw: (flushDraw && straightDraw) || straightFlush.draw
  };
}

function hasOpenEndedStraightDraw(ranks) {
  const unique = new Set(ranks);
  if (unique.has(14)) unique.add(1);
  for (let low = 1; low <= 10; low += 1) {
    const window = [low, low + 1, low + 2, low + 3, low + 4];
    const present = window.filter((rank) => unique.has(rank)).length;
    if (present === 4) return true;
  }
  return false;
}

function recommendFromEvaluation({ evaluation, toCallBb = 0, potBb = 0 }) {
  const pressure = Number(toCallBb) > 0;
  const potOdds = pressure && Number(potBb) > 0 ? Number(toCallBb) / (Number(potBb) + Number(toCallBb)) : 0;
  const { category, score, draws } = evaluation;

  if (score >= HAND_STRENGTH.flush) return decision('raise', 'Very strong made hand; build the pot or value raise.', { confidence: 'high' });
  if (score >= HAND_STRENGTH.two_pair) return decision(pressure ? 'raise' : 'bet', 'Strong made hand; value bet against worse made hands and draws.', { confidence: 'medium-high' });
  if (score === HAND_STRENGTH.pair && draws.comboDraw) return decision(pressure ? 'call' : 'bet', 'Pair plus strong draw has enough equity to continue aggressively.', { confidence: 'medium' });
  if (draws.comboDraw) return decision(pressure && potOdds > 0.35 ? 'call' : 'bet', 'Combo draw can semi-bluff or continue at reasonable pot odds.', { confidence: 'medium' });
  if (score === HAND_STRENGTH.pair) return decision(pressure && potOdds > 0.3 ? 'fold' : 'check', `One-pair ${category} is marginal without a strong draw.`, { confidence: 'medium' });
  if (draws.flushDraw || draws.straightDraw) return decision(pressure && potOdds > 0.25 ? 'fold' : 'call', 'Drawing hand can continue only when the price is reasonable.', { confidence: 'low-medium' });
  return decision(pressure ? 'fold' : 'check', 'Weak hand with no major draw; avoid investing more chips.', { confidence: 'medium' });
}

function decision(action, reason, extra = {}) {
  return { action, reason, source: 'heuristic-table-advisor', ...extra };
}

function advise(gameState, options = {}) {
  const bot = options.bot || PokerGtoBot.fromFile(options.scenarioPath);
  const heroCards = parseCards(gameState.heroCards || gameState.heroHand);
  if (heroCards.length !== 2) throw new Error('Please provide exactly two hero cards.');
  const boardCards = parseCards(gameState.board || gameState.tableCards || '');
  if (boardCards.length > 5) throw new Error('The table/board can contain at most five cards.');
  assertNoDuplicates([...heroCards, ...boardCards]);

  const solverState = {
    street: gameState.street || streetFromBoard(boardCards),
    position: gameState.position || 'BTN',
    effectiveStackBb: gameState.effectiveStackBb || 100,
    heroHand: heroCards,
    board: normalizeBoard(boardCards),
    line: gameState.line || '',
    potBb: gameState.potBb,
    toCallBb: gameState.toCallBb
  };

  const precomputed = gameState.line ? bot.decide(solverState) : null;
  if (precomputed && precomputed.source === 'precomputed') return { ...precomputed, mode: 'precomputed-gto' };

  const isUnopenedPreflop = solverState.street === 'preflop' && boardCards.length === 0 && (!gameState.line || String(gameState.line).toLowerCase() === 'unopened');
  if (isUnopenedPreflop) {
    const preflopRangeDecision = recommendPreflopRfi({ heroHand: heroCards, position: solverState.position });
    if (preflopRangeDecision) return preflopRangeDecision;
  }

  const evaluation = evaluateCards([...heroCards, ...boardCards]);
  return {
    ...recommendFromEvaluation({ evaluation, toCallBb: gameState.toCallBb, potBb: gameState.potBb }),
    handCategory: evaluation.category,
    draws: evaluation.draws,
    mode: 'table-card-advisor'
  };
}

function streetFromBoard(boardCards) {
  if (boardCards.length === 0) return 'preflop';
  if (boardCards.length === 3) return 'flop';
  if (boardCards.length === 4) return 'turn';
  if (boardCards.length === 5) return 'river';
  throw new Error('Board must contain 0, 3, 4, or 5 cards.');
}

module.exports = {
  advise,
  evaluateCards,
  parseCards,
  streetFromBoard
};
