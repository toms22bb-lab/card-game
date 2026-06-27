#!/usr/bin/env node
'use strict';

const { advise } = require('../src/poker-advisor');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node bin/poker-decision.js --hero "As Ks" --board "Kh 7d 2c" [options]

Options:
  --hero            Your two hole cards. Required. Example: "As Ks"
  --board           Table cards. Use 0, 3, 4, or 5 cards. Example: "Kh 7d 2c"
  --pot-bb          Current pot in big blinds. Example: 8.5
  --to-call-bb      Amount to call in big blinds. Example: 2.5
  --position        Hero position. Example: BTN, BB, CO
  --stack-bb        Effective stack in big blinds. Default: 100
  --line            Optional action-history key to use an exact precomputed scenario first.
  --help            Show this help message.

Examples:
  node bin/poker-decision.js --hero "As Ks" --board "Kh 7d 2c" --pot-bb 5.5
  node bin/poker-decision.js --hero "As 5s" --position BB --line BTN_R2.5 --to-call-bb 1.5
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.hero) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const decision = advise({
    heroCards: args.hero,
    board: args.board || '',
    potBb: args.potBb === undefined ? undefined : Number(args.potBb),
    toCallBb: args.toCallBb === undefined ? 0 : Number(args.toCallBb),
    position: args.position,
    effectiveStackBb: args.stackBb === undefined ? 100 : Number(args.stackBb),
    line: args.line
  });

  console.log(JSON.stringify(decision, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
