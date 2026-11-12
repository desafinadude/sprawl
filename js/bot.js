// Simple greedy bots: try every card, rotation and legal spot, then pick by difficulty.
import { scoreCity, allowedRotations } from './rules.js';

export function legalMoves(city, hand, goals) {
  const b = city.bounds();
  const moves = [];
  hand.forEach((card, hi) => {
    for (const rot of allowedRotations()) {
      for (let y = b.minY - 2; y <= b.maxY + 1; y++) {
        for (let x = b.minX - 2; x <= b.maxX + 1; x++) {
          if (!city.check(card, rot, x, y).ok) continue;
          const undo = city.place(card, rot, x, y);
          moves.push({ hi, rot, x, y, s: scoreCity(city, goals).total });
          city.undo(undo);
        }
      }
    }
  });
  return moves;
}

export function chooseMove(city, hand, goals, level = 'normal') {
  const moves = legalMoves(city, hand, goals);
  if (!moves.length) return null;
  const rnd = Math.random;
  if (level === 'easy') {
    moves.sort((a, b) => b.s - a.s);
    const top = moves.slice(0, Math.max(1, Math.ceil(moves.length * 0.12)));
    return top[Math.floor(rnd() * top.length)];
  }
  const noise = level === 'hard' ? 0.01 : 2.5;
  let best = null, bestV = -Infinity;
  for (const m of moves) {
    const v = m.s + rnd() * noise;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}
