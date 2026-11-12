// Canvas rendering of cities/cards plus pan, pinch-zoom, tap and ghost-drag input.
import { ZONES, ZONE_INFO, N, E, S, W, DIRS, key } from './rules.js';

// ---------- Optional art ----------
// List square images in assets/art.json, e.g. {"home": "zones/home.png", "park": "zones/park.png"}
// (paths relative to assets/). Listed zones are drawn with the image instead of the flat tile.
export const ART = {};
export async function loadArt(onLoad) {
  let list = {};
  try { list = await (await fetch('assets/art.json', { cache: 'no-cache' })).json(); } catch { return; }
  for (const z of ZONES) {
    if (!list[z]) continue;
    const img = new Image();
    img.onload = () => { ART[z] = img; onLoad && onLoad(); };
    img.src = 'assets/' + list[z];
  }
}

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
};

function glyph(ctx, z, cx, cy, s) {
  const info = ZONE_INFO[z] || { color: '#cccccc', icon: '?' };
  const icon = info.icon;
  const col = shade(info.color, 0.55);
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.beginPath();
  if (icon === 'house') {
    ctx.moveTo(cx - s * 0.42, cy - s * 0.02); ctx.lineTo(cx, cy - s * 0.42); ctx.lineTo(cx + s * 0.42, cy - s * 0.02);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - s * 0.3, cy - s * 0.04, s * 0.6, s * 0.42);
    ctx.fillStyle = info.color; ctx.fillRect(cx - s * 0.08, cy + s * 0.12, s * 0.16, s * 0.26);
  } else if (icon === 'shop') {
    ctx.fillRect(cx - s * 0.38, cy - s * 0.05, s * 0.76, s * 0.43);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : col;
      ctx.fillRect(cx - s * 0.44 + i * s * 0.22, cy - s * 0.32, s * 0.22, s * 0.22);
    }
    ctx.fillStyle = info.color; ctx.fillRect(cx - s * 0.26, cy + s * 0.06, s * 0.52, s * 0.18);
  } else if (icon === 'factory') {
    ctx.moveTo(cx - s * 0.42, cy + s * 0.38); ctx.lineTo(cx - s * 0.42, cy - s * 0.05);
    ctx.lineTo(cx - s * 0.18, cy - s * 0.22); ctx.lineTo(cx - s * 0.18, cy - s * 0.05);
    ctx.lineTo(cx + s * 0.06, cy - s * 0.22); ctx.lineTo(cx + s * 0.06, cy - s * 0.05);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.12); ctx.lineTo(cx + s * 0.2, cy - s * 0.42);
    ctx.lineTo(cx + s * 0.36, cy - s * 0.42); ctx.lineTo(cx + s * 0.36, cy - s * 0.05);
    ctx.lineTo(cx + s * 0.42, cy - s * 0.05); ctx.lineTo(cx + s * 0.42, cy + s * 0.38);
    ctx.closePath(); ctx.fill();
  } else if (icon === 'tree') {
    ctx.fillRect(cx - s * 0.05, cy + s * 0.05, s * 0.1, s * 0.33);
    ctx.arc(cx, cy - s * 0.1, s * 0.3, 0, Math.PI * 2); ctx.fill();
  } else {
    // any other icon value is drawn as text (a letter or emoji)
    ctx.font = `700 ${Math.round(s * 0.75)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(icon).slice(0, 2), cx, cy + s * 0.04);
  }
}

// Draw a single 1×1 space at pixel (px,py) with side `size`.
export function drawCell(ctx, px, py, size, z, r) {
  const info = ZONE_INFO[z] || { color: '#cccccc' };
  const art = ART[z];
  if (art) ctx.drawImage(art, px, py, size, size);
  else {
    ctx.fillStyle = info.color; ctx.fillRect(px, py, size, size);
    if (r) {
      glyph(ctx, z, px + size * 0.25, py + size * 0.25, size * 0.38);
      glyph(ctx, z, px + size * 0.75, py + size * 0.75, size * 0.38);
    } else glyph(ctx, z, px + size / 2, py + size / 2, size * 0.7);
  }
  if (r) drawRoad(ctx, px, py, size, r);
}

function drawRoad(ctx, px, py, size, r) {
  const cx = px + size / 2, cy = py + size / 2;
  const ends = [];
  if (r & N) ends.push([cx, py]);
  if (r & E) ends.push([px + size, cy]);
  if (r & S) ends.push([cx, py + size]);
  if (r & W) ends.push([px, cy]);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#4a4e57'; ctx.lineWidth = size * 0.24;
  ctx.beginPath();
  for (const [x, y] of ends) { ctx.moveTo(cx, cy); ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.fillStyle = '#4a4e57';
  ctx.beginPath(); ctx.arc(cx, cy, size * (ends.length === 1 ? 0.2 : 0.12), 0, Math.PI * 2); ctx.fill();
  if (size >= 18) {
    ctx.strokeStyle = '#f5f0e1'; ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.setLineDash([size * 0.08, size * 0.07]);
    ctx.beginPath();
    for (const [x, y] of ends) { ctx.moveTo(cx, cy); ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// Draw a 2×2 card (already rotated cells/roads) into a canvas element, filling it.
export function drawCardCanvas(canvas, cells, roads) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 80;
  canvas.width = w * dpr; canvas.height = w * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = w / 2;
  for (let i = 0; i < 4; i++) drawCell(ctx, (i & 1) * s, (i >> 1) * s, s, cells[i], roads[i]);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(s, w); ctx.moveTo(0, s); ctx.lineTo(w, s); ctx.stroke();
}

// Render the city map with a camera: screen = o + world * scale.
function drawCity(ctx, cells, scale, ox, oy) {
  for (const [k, c] of cells) {
    const [x, y] = k.split(',').map(Number);
    drawCell(ctx, ox + x * scale, oy + y * scale, scale, c.z, c.r);
  }
  // card borders: edges between spaces from different cards, and the city outline
  ctx.strokeStyle = 'rgba(30,25,40,.75)'; ctx.lineWidth = Math.max(1.5, scale * 0.045); ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [k, c] of cells) {
    const [x, y] = k.split(',').map(Number);
    const px = ox + x * scale, py = oy + y * scale;
    for (const d of DIRS) {
      const n = cells.get(key(x + d.dx, y + d.dy));
      if (n && n.id === c.id) continue;
      if (n && (d.bit === W || d.bit === N)) continue; // shared edge drawn once (from the other side)
      if (d.bit === N) { ctx.moveTo(px, py); ctx.lineTo(px + scale, py); }
      if (d.bit === S) { ctx.moveTo(px, py + scale); ctx.lineTo(px + scale, py + scale); }
      if (d.bit === W) { ctx.moveTo(px, py); ctx.lineTo(px, py + scale); }
      if (d.bit === E) { ctx.moveTo(px + scale, py); ctx.lineTo(px + scale, py + scale); }
    }
  }
  ctx.stroke();
}

function cellsBounds(cells, extra = []) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  for (const k of cells.keys()) { const [x, y] = k.split(',').map(Number); add(x, y); }
  for (const c of extra) add(c.x, c.y);
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

// Static, fitted render of a whole city (for thumbnails and results).
export function renderCityThumb(canvas, city) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 200, h = canvas.clientHeight || 200;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const b = cellsBounds(city.cells);
  const cw = b.maxX - b.minX + 1, ch = b.maxY - b.minY + 1;
  const scale = Math.min((w - 8) / cw, (h - 8) / ch);
  const ox = (w - cw * scale) / 2 - b.minX * scale, oy = (h - ch * scale) / 2 - b.minY * scale;
  drawCity(ctx, city.cells, scale, ox, oy);
}

export class Board {
  constructor(canvas, handlers = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.h = handlers;
    this.city = null;
    this.ghost = null; // {cells:[{x,y,z,r}], ok, x, y}
    this.scale = 48; this.ox = 0; this.oy = 0;
    this.pointers = new Map();
    this.drag = null;
    this.needsFit = true;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.bindInput();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const cx = this.w ? (this.w / 2 - this.ox) / this.scale : null;
    const cy = this.h0 ? (this.h0 / 2 - this.oy) / this.scale : null;
    this.w = r.width; this.h0 = r.height;
    this.canvas.width = r.width * dpr; this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.needsFit) this.fit();
    else if (cx !== null) { this.ox = this.w / 2 - cx * this.scale; this.oy = this.h0 / 2 - cy * this.scale; }
    this.draw();
  }

  setCity(city, fit = false) {
    if (city !== this.city) fit = true;
    this.city = city;
    if (fit) this.fit();
    this.draw();
  }
  setGhost(g) { this.ghost = g; this.draw(); }

  fit() {
    if (!this.w || !this.city) { this.needsFit = true; return; }
    this.needsFit = false;
    const b = cellsBounds(this.city.cells, this.ghost ? this.ghost.cells : []);
    const pad = 1.5;
    const cw = b.maxX - b.minX + 1 + pad * 2, ch = b.maxY - b.minY + 1 + pad * 2;
    this.scale = Math.max(14, Math.min(90, Math.min(this.w / cw, this.h0 / ch)));
    this.ox = this.w / 2 - ((b.minX + b.maxX + 1) / 2) * this.scale;
    this.oy = this.h0 / 2 - ((b.minY + b.maxY + 1) / 2) * this.scale;
    this.draw();
  }

  // Refit if the ghost card isn't fully on screen.
  ensureGhostVisible() {
    if (!this.ghost || !this.w) return;
    const g = this.ghost, m = 8;
    const x0 = this.ox + g.x * this.scale, y0 = this.oy + g.y * this.scale, sz = 2 * this.scale;
    if (x0 < m || y0 < m || x0 + sz > this.w - m || y0 + sz > this.h0 - 70) this.fit();
  }

  toWorld(sx, sy) { return [(sx - this.ox) / this.scale, (sy - this.oy) / this.scale]; }
  viewCenter() { return this.toWorld(this.w / 2, this.h0 / 2); }

  draw() {
    if (!this.w || !this.city) return;
    const { ctx, scale } = this;
    ctx.clearRect(0, 0, this.w, this.h0);
    // dotted grid
    ctx.fillStyle = 'rgba(80,70,100,.18)';
    const x0 = Math.floor(-this.ox / scale), y0 = Math.floor(-this.oy / scale);
    const r = Math.max(1, scale * 0.04);
    for (let y = y0; y < y0 + this.h0 / scale + 2; y++) for (let x = x0; x < x0 + this.w / scale + 2; x++) {
      ctx.fillRect(this.ox + x * scale - r / 2, this.oy + y * scale - r / 2, r, r);
    }
    drawCity(ctx, this.city.cells, scale, this.ox, this.oy);
    if (this.ghost) {
      const g = this.ghost;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#000';
      ctx.fillRect(this.ox + g.x * scale, this.oy + g.y * scale, scale * 2, scale * 2);
      ctx.restore();
      ctx.globalAlpha = 0.92;
      for (const c of g.cells) drawCell(ctx, this.ox + c.x * scale, this.oy + c.y * scale, scale, c.z, c.r);
      ctx.globalAlpha = 1;
      if (!g.ok) { ctx.fillStyle = 'rgba(220,40,60,.35)'; ctx.fillRect(this.ox + g.x * scale, this.oy + g.y * scale, scale * 2, scale * 2); }
      ctx.strokeStyle = g.ok ? '#1f9d55' : '#d62839';
      ctx.lineWidth = 4; ctx.setLineDash(g.ok ? [] : [8, 6]);
      ctx.strokeRect(this.ox + g.x * scale + 2, this.oy + g.y * scale + 2, scale * 2 - 4, scale * 2 - 4);
      ctx.setLineDash([]);
    }
  }

  hitGhost(sx, sy) {
    if (!this.ghost) return false;
    const [fx, fy] = this.toWorld(sx, sy);
    return fx >= this.ghost.x && fx < this.ghost.x + 2 && fy >= this.ghost.y && fy < this.ghost.y + 2;
  }

  zoomAt(sx, sy, factor) {
    const ns = Math.max(12, Math.min(140, this.scale * factor));
    const f = ns / this.scale;
    this.ox = sx - (sx - this.ox) * f; this.oy = sy - (sy - this.oy) * f;
    this.scale = ns;
    this.draw();
  }

  bindInput() {
    const c = this.canvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const p = pos(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) {
        const onGhost = this.hitGhost(...p);
        const [fx, fy] = this.toWorld(...p);
        this.drag = { start: p, last: p, moved: 0, t: Date.now(), mode: onGhost ? 'ghost' : 'pan',
          grab: onGhost ? [fx - this.ghost.x, fy - this.ghost.y] : null };
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.drag = { mode: 'pinch', dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], moved: 99 };
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId) || !this.drag) return;
      const p = pos(e);
      this.pointers.set(e.pointerId, p);
      const d = this.drag;
      if (d.mode === 'pinch' && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        this.ox += mid[0] - d.mid[0]; this.oy += mid[1] - d.mid[1];
        this.zoomAt(mid[0], mid[1], dist / d.dist);
        d.dist = dist; d.mid = mid;
        return;
      }
      d.moved += Math.hypot(p[0] - d.last[0], p[1] - d.last[1]);
      if (d.mode === 'pan') {
        this.ox += p[0] - d.last[0]; this.oy += p[1] - d.last[1];
        this.draw();
      } else if (d.mode === 'ghost' && d.moved > 6) {
        const [fx, fy] = this.toWorld(...p);
        const gx = Math.round(fx - d.grab[0]), gy = Math.round(fy - d.grab[1]);
        if (gx !== this.ghost.x || gy !== this.ghost.y) this.h.onGhostMove && this.h.onGhostMove(gx, gy);
      }
      d.last = p;
    });
    const end = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      const d = this.drag;
      if (this.pointers.size === 0) {
        if (d && d.mode !== 'pinch' && d.moved < 8 && Date.now() - d.t < 500 && e.type === 'pointerup') {
          if (d.mode === 'ghost') this.h.onGhostTap && this.h.onGhostTap();
          else { const [fx, fy] = this.toWorld(...d.start); this.h.onTap && this.h.onTap(fx, fy); }
        }
        this.drag = null;
      } else if (this.pointers.size === 1) {
        const p = [...this.pointers.values()][0];
        this.drag = { start: p, last: p, moved: 99, t: 0, mode: 'pan' };
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      this.zoomAt(p[0], p[1], Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }
}
