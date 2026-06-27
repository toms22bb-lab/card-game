'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RANK_ORDER = '23456789TJQKA';
const DEFAULT_DATA_PATH = path.join(__dirname, '..', 'data', 'gto-scenarios.json');

function normalizeCard(card) {
  if (typeof card !== 'string' || !/^[2-9TJQKA][cdhs]$/i.test(card)) {
    throw new Error(`Invalid card: ${card}`);
  }
  return card[0].toUpperCase() + card[1].toLowerCase();
}

function normalizeHand(hand) {
  if (typeof hand === 'string' && /^(?:[2-9TJQKA]{2}|[2-9TJQKA]{2}[so])$/i.test(hand)) {
    const ranks = hand.slice(0, 2).toUpperCase().split('');
    const suffix = hand[2] ? hand[2].toLowerCase() : '';
    if (ranks[0] === ranks[1]) return ranks[0] + ranks[1];
    return sortRanks(ranks).join('') + suffix;
  }

  if (!Array.isArray(hand) || hand.length !== 2) {
    throw new Error('heroHand must be a two-card array or an abstract hand like "AKs".');
  }

  const [a, b] = hand.map(normalizeCard);
  const ranks = sortRanks([a[0], b[0]]);
  if (ranks[0] === ranks[1]) return ranks[0] + ranks[1];
  return ranks.join('') + (a[1] === b[1] ? 's' : 'o');
}

function sortRanks(ranks) {
  return ranks.sort((a, b) => RANK_ORDER.indexOf(b) - RANK_ORDER.indexOf(a));
}

function normalizeBoard(board) {
  if (!board) return '';
  if (Array.isArray(board)) return board.map(normalizeCard).join('');
  if (typeof board === 'string') return board.replace(/\s+/g, '');
  throw new Error('board must be omitted, a card array, or a compact board string.');
}

function quantizeStack(stackBb) {
  if (stackBb === undefined || stackBb === null) return undefined;
  const stack = Number(stackBb);
  if (!Number.isFinite(stack) || stack <= 0) throw new Error('effectiveStackBb must be a positive number.');
  return Math.round(stack / 5) * 5;
}

function buildKey(input) {
  const parts = [
    String(input.street || '').toLowerCase(),
    String(input.position || '').toUpperCase(),
    quantizeStack(input.effectiveStackBb),
    normalizeHand(input.heroHand),
    normalizeBoard(input.board),
    String(input.line || '').toUpperCase()
  ];
  return parts.join('|');
}

function scenarioKey(scenario) {
  return buildKey(scenario);
}

class PokerGtoBot {
  constructor({ scenarios = [], defaultAction = { action: 'check', frequency: 1, size: 0 }, rng = Math.random } = {}) {
    this.defaultAction = defaultAction;
    this.rng = rng;
    this.index = new Map();
    scenarios.forEach((scenario) => this.addScenario(scenario));
  }

  static fromFile(filePath = DEFAULT_DATA_PATH, options = {}) {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return new PokerGtoBot({ ...options, scenarios: raw.scenarios, defaultAction: raw.defaultAction });
  }

  addScenario(scenario) {
    if (!scenario || !Array.isArray(scenario.actions) || scenario.actions.length === 0) {
      throw new Error('A scenario requires at least one action.');
    }
    this.index.set(scenarioKey(scenario), scenario);
    return this;
  }

  findScenario(gameState) {
    return this.index.get(buildKey(gameState)) || null;
  }

  decide(gameState) {
    const scenario = this.findScenario(gameState);
    if (!scenario) {
      return {
        ...this.defaultAction,
        source: 'fallback',
        reason: 'No precomputed scenario matched the supplied game state.'
      };
    }

    return {
      ...this.chooseMixedAction(scenario.actions),
      scenarioId: scenario.id,
      source: 'precomputed'
    };
  }

  chooseMixedAction(actions) {
    const roll = this.rng();
    let cumulative = 0;
    for (const action of actions) {
      cumulative += action.frequency;
      if (roll <= cumulative) return action;
    }
    return actions[actions.length - 1];
  }
}

module.exports = {
  PokerGtoBot,
  buildKey,
  normalizeHand,
  normalizeBoard
};
