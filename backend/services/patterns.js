// Decorative page patterns, drawn in currentColor so one SVG serves the PDF (accent color) and UI swatches.
// Tile patterns repeat one cell; constellation is a generated low-poly mesh.

const TILES = {
  dots: { label: 'Dots', w: 16, h: 16, cell: '<circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/>' },
  grid: { label: 'Grid', w: 24, h: 24, cell: '<path d="M0 .5H24M.5 0V24"/>' },
  diagonal: { label: 'Diagonal lines', w: 12, h: 12, cell: '<path d="M-3 3L3-3M0 12L12 0M9 15L15 9"/>' },
  waves: { label: 'Waves', w: 48, h: 16, cell: '<path d="M0 8C8 0 16 0 24 8S40 16 48 8"/>' },
  hexagons: { label: 'Hexagons', w: 28, h: 50, cell: '<path d="M14 33L0 25V8L14 0L28 8V25L14 33V50"/>' },
  triangles: { label: 'Triangles', w: 32, h: 55.43, cell: '<path d="M0 0H32M0 27.71H32M0 55.43H32M0 0L32 55.43M32 0L0 55.43"/>' },
  rings: {
    label: 'Rings', w: 40, h: 40,
    cell: [[20, 20], [0, 0], [40, 0], [0, 40], [40, 40]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20"/><circle cx="${x}" cy="${y}" r="10"/>`).join('')
  },
  chevron: { label: 'Chevron', w: 24, h: 14, cell: '<path d="M0 11L12 1L24 11"/>' },
  plus: { label: 'Plus signs', w: 24, h: 24, cell: '<path d="M12 8V16M8 12H16" stroke-width="1.2"/>' }
};

// Deterministic PRNG so a document renders identically every time
const mulberry32 = (seed) => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Jittered grid of points joined to their right/lower neighbours plus one diagonal per cell
const constellation = (w, h) => {
  const rand = mulberry32(7);
  const step = Math.max(w, h) / 7;
  const cols = Math.ceil(w / step) + 2;
  const rows = Math.ceil(h / step) + 2;
  const pts = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => [
    (c - 0.5) * step + (rand() - 0.5) * step * 0.9,
    (r - 0.5) * step + (rand() - 0.5) * step * 0.9
  ].map(n => +n.toFixed(1))));
  const seg = ([x1, y1], [x2, y2]) => `M${x1} ${y1}L${x2} ${y2}`;
  let d = '';
  let dots = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = pts[r][c];
      if (c + 1 < cols && rand() > 0.15) d += seg(p, pts[r][c + 1]);
      if (r + 1 < rows && rand() > 0.15) d += seg(p, pts[r + 1][c]);
      if (r + 1 < rows && c + 1 < cols) d += rand() > 0.5 ? seg(p, pts[r + 1][c + 1]) : seg(pts[r][c + 1], pts[r + 1][c]);
      if (rand() > 0.6) dots += `<circle cx="${p[0]}" cy="${p[1]}" r="2.4" fill="currentColor" stroke="none"/>`;
    }
  }
  return `<path d="${d}"/>${dots}`;
};

const PATTERNS = { constellation: 'Constellation', ...Object.fromEntries(Object.entries(TILES).map(([id, t]) => [id, t.label])) };

// Masks fade the pattern out toward the content; full page is dimmed instead so text stays readable
const PLACEMENTS = {
  bottom: { label: 'Bottom', mask: 'linear-gradient(to top, #000 10%, transparent 55%)' },
  top: { label: 'Top', mask: 'linear-gradient(to bottom, #000 5%, transparent 32%)' },
  corner: { label: 'Corner', mask: 'radial-gradient(circle at 100% 100%, #000 10%, transparent 60%)' },
  full: { label: 'Full page (subtle)', mask: 'none', dim: 0.25 }
};

// SVG for a w×h area (PDF points); '' for none/unknown ids. color must already be a sanitized hex.
const patternSvg = (id, color, w = 595, h = 842) => {
  const tile = Object.hasOwn(TILES, id) ? TILES[id] : null;
  if (id !== 'constellation' && !tile) return '';
  const content = tile
    ? `<defs><pattern id="pat-${id}" width="${tile.w}" height="${tile.h}" patternUnits="userSpaceOnUse">${tile.cell}</pattern></defs>`
      + `<rect width="${w}" height="${h}" fill="url(#pat-${id})" stroke="none"/>`
    : constellation(w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"`
    + `${color ? ` color="${color}"` : ''} fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round">${content}</svg>`;
};

// Fixed full-page layer: Chromium repeats position:fixed elements on every printed page
const patternLayer = ({ pattern, patternColor, placement, opacity }) => {
  const svg = patternSvg(pattern, patternColor);
  if (!svg) return '';
  const place = Object.hasOwn(PLACEMENTS, placement) ? PLACEMENTS[placement] : PLACEMENTS.bottom;
  const alpha = Math.min(1, Math.max(0.05, parseFloat(opacity) || 1)) * (place.dim || 1);
  return `<div style="position: fixed; inset: 0; z-index: -1; opacity: ${alpha}; mask-image: ${place.mask}; -webkit-mask-image: ${place.mask};">`
    + svg.replace('<svg ', '<svg style="width: 100%; height: 100%; display: block;" ') + '</div>';
};

module.exports = { PATTERNS, PLACEMENTS, patternSvg, patternLayer };
