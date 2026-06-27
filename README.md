# card-game

## Poker decision bot

This repository includes a small Node.js poker decision bot. You can enter your hole cards and the cards on the table, and the bot returns a recommended action with a short reason.

The bot works in two layers:

1. **Precomputed GTO lookup** - if you provide an exact action-history `line`, it first tries to match a solved scenario from `data/gto-scenarios.json`.
2. **Preflop range chart** - for unopened preflop spots without an exact scenario, it uses simplified 6-max 100bb public-study inspired RFI ranges in `data/preflop-ranges.json`.
3. **Table-card advisor** - if no exact scenario or preflop range applies, it evaluates your hole cards plus the table cards and recommends a practical action from made-hand strength, draws, pot size, and call price.

> Note: the included ranges are simplified study ranges based on public chart concepts, not copied proprietary charts and not a real-time solver. For true GTO coverage, export solver nodes into `data/gto-scenarios.json`.

## Quick start

Ask for a decision with your two cards and the table cards:

```bash
node bin/poker-decision.js --hero "As Ks" --board "Kh 7d 2c" --pot-bb 5.5
```

Example output:

```json
{
  "action": "check",
  "reason": "One-pair pair is marginal without a strong draw.",
  "source": "heuristic-table-advisor",
  "confidence": "medium",
  "handCategory": "pair",
  "draws": {
    "flushDraw": false,
    "straightDraw": false,
    "straightFlushDraw": false,
    "comboDraw": false
  },
  "mode": "table-card-advisor"
}
```

Use an exact precomputed scenario when you know the action line:

```bash
node bin/poker-decision.js --hero "As 5s" --position BB --line BTN_R2.5 --pot-bb 4 --to-call-bb 1.5
```


## Open in a browser

You can also open the bot as a simple web page:

```bash
python3 -m http.server 4173
```

Then visit `http://127.0.0.1:4173/poker-bot.html` in your browser. The page lets you type your hole cards, the table cards, pot size, and amount to call, then shows the recommended decision.

## CLI options

```text
--hero        Your two hole cards. Required. Example: "As Ks"
--board       Table cards. Use 0, 3, 4, or 5 cards. Example: "Kh 7d 2c"
--pot-bb      Current pot in big blinds. Example: 8.5
--to-call-bb  Amount to call in big blinds. Example: 2.5
--position    Hero position. Example: BTN, BB, CO
--stack-bb     Effective stack in big blinds. Default: 100
--line        Optional action-history key to use an exact precomputed scenario first
--help        Show help
```

Cards can be typed with spaces, commas, or compact notation: `As Ks`, `As,Ks`, and `AsKs` all work.

## Programmatic usage

```js
const { advise } = require('./src/poker-advisor');

const decision = advise({
  heroCards: 'As Ks',
  board: 'Kh 7d 2c',
  potBb: 5.5,
  toCallBb: 0
});

console.log(decision.action, decision.reason);
```

If you want direct precomputed-scenario behavior, use `PokerGtoBot`:

```js
const { PokerGtoBot } = require('./src/poker-gto-bot');

const bot = PokerGtoBot.fromFile();
const decision = bot.decide({
  street: 'preflop',
  position: 'BB',
  effectiveStackBb: 100,
  heroHand: ['As', '5s'],
  line: 'BTN_R2.5'
});
```

## Files

- `poker-bot.html` - browser page for opening the bot and entering cards visually.
- `bin/poker-decision.js` - command-line interface for entering cards and getting a decision.
- `src/poker-advisor.js` - table-card parser, made-hand/draw evaluator, and recommendation layer.
- `src/poker-gto-bot.js` - precomputed scenario lookup engine, hand/board normalization, stack bucketing, and mixed-action selection.
- `data/gto-scenarios.json` - editable precomputed scenario library.
- `data/preflop-ranges.json` - simplified 6-max 100bb raise-first-in range chart with source notes.
- `test/poker-advisor.test.js` and `test/poker-gto-bot.test.js` - Node test coverage.

## Adding precomputed GTO scenarios

Add entries to `data/gto-scenarios.json` with these fields:

- `street`: `preflop`, `flop`, `turn`, or `river`.
- `position`: hero position, such as `BTN` or `BB`.
- `effectiveStackBb`: stack depth in big blinds. The bot buckets lookup requests to the nearest 5bb.
- `heroHand`: abstract hand class, such as `AA`, `AKs`, or `72o`.
- `board`: optional compact board string for postflop spots, such as `Ks7d2c`.
- `line`: compact action-history key, such as `BTN_R2.5_BB_CALL;BB_X`.
- `actions`: one or more actions with `frequency` values. Frequencies should sum to `1`.

For production-quality GTO play, export many more solved nodes from a solver and convert them into the same JSON shape.

## Public range research used

The starter ranges were expanded after checking public resources that describe free solver-backed or GTO-inspired preflop charts, including RangeConverter, PokerCoaching, and the MIT-licensed AHTOOOXA poker-charts project. The repo stores simplified hand buckets rather than copying full proprietary chart grids.
