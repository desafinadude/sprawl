// Bot-vs-bot simulation for balancing.
import { newGame, current, playCard, results, cityOf } from '../js/game.js';
import { chooseMove } from '../js/bot.js';
import { loadRuleset } from '../js/rules.js';
import { readFileSync } from 'node:fs';
// usage: node tools/sim.mjs [games] [ruleset.json]
loadRuleset(JSON.parse(readFileSync(process.argv[3] || new URL('../data/blocktown.json', import.meta.url), 'utf8')));
const games = +process.argv[2] || 30;
for (const mode of ['solo', 'draft']) {
  const totals = [], perGoal = {}; let t0 = Date.now(), turns = 0;
  for (let g = 0; g < games; g++) {
    const players = mode === 'solo' ? [{ type: 'bot', level: 'hard' }] : [{ type: 'bot', level: 'hard' }, { type: 'bot', level: 'normal' }, { type: 'bot', level: 'easy' }];
    const s = newGame({ players, seed: g + 1 });
    while (!s.over) { const p = current(s); const m = chooseMove(cityOf(s, p), p.hand, s.goals, p.level); playCard(s, m.hi, m.rot, m.x, m.y); turns++; }
    for (const r of results(s)) { totals.push([r.total, s.players[r.i].level]); for (const gl of r.goals) (perGoal[gl.id] ||= []).push(gl.pts); }
  }
  const byLevel = {}; for (const [t, l] of totals) (byLevel[l] ||= []).push(t);
  console.log(mode, `${((Date.now() - t0) / turns).toFixed(0)}ms/turn`);
  for (const [l, a] of Object.entries(byLevel)) console.log(' ', l, 'avg', (a.reduce((x, y) => x + y) / a.length).toFixed(1), 'min', Math.min(...a), 'max', Math.max(...a));
  console.log('  goals avg:', Object.entries(perGoal).map(([k, a]) => `${k}=${(a.reduce((x, y) => x + y) / a.length).toFixed(1)}`).join(' '));
}
