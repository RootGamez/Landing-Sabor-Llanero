/**
 * Regenera los placeholders SVG de /public/images/.
 * Uso:  node scripts/generate-placeholders.mjs
 * Son temporales: reemplázalos por fotos reales cuando las tengas.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const YELLOW = "#FFCE00", BLUE = "#00247D", RED = "#CF142B";
const CRUST = "#D99A3D", CRUST_D = "#B57A26";
const GREEN = "#3E7C3A", PEP = "#C0392B", PEP_D = "#8E2418";

// Generador pseudoaleatorio con semilla (resultados reproducibles)
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const header = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="Arial, Helvetica, sans-serif">
<defs>
<radialGradient id="bg" cx="50%" cy="38%" r="80%">
<stop offset="0%" stop-color="#332414"/><stop offset="60%" stop-color="#211709"/><stop offset="100%" stop-color="#140e07"/>
</radialGradient>
<radialGradient id="glow" cx="50%" cy="50%" r="50%">
<stop offset="0%" stop-color="${YELLOW}" stop-opacity="0.35"/><stop offset="100%" stop-color="${YELLOW}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="cheese" cx="45%" cy="42%" r="65%">
<stop offset="0%" stop-color="#FADD7A"/><stop offset="100%" stop-color="#F5C542"/>
</radialGradient>
<pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
<circle cx="2" cy="2" r="1.3" fill="#ffffff" opacity="0.05"/>
</pattern>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<rect width="${w}" height="${h}" fill="url(#dots)"/>`;

const tricolor = (w, h, bar = 10) => {
  const seg = w / 3;
  return `<rect x="0" y="${h - bar}" width="${seg}" height="${bar}" fill="${YELLOW}"/><rect x="${seg}" y="${h - bar}" width="${seg}" height="${bar}" fill="${BLUE}"/><rect x="${2 * seg}" y="${h - bar}" width="${seg}" height="${bar}" fill="${RED}"/>`;
};

function pizza(cx, cy, r, seed, toppings = "pep") {
  const rnd = rng(seed);
  let s = `<ellipse cx="${cx}" cy="${cy + r * 0.92}" rx="${r * 1.15}" ry="${r * 0.22}" fill="#000" opacity="0.45"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r * 1.6}" fill="url(#glow)"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${CRUST}" stroke="${CRUST_D}" stroke-width="${r * 0.04}"/>`;
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, rr = r * 0.93;
    s += `<circle cx="${(cx + rr * Math.cos(a)).toFixed(1)}" cy="${(cy + rr * Math.sin(a)).toFixed(1)}" r="${(r * (0.015 + rnd() * 0.015)).toFixed(1)}" fill="${CRUST_D}" opacity="0.6"/>`;
  }
  s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.82}" fill="url(#cheese)"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.82}" fill="none" stroke="#C44D20" stroke-width="${r * 0.025}" opacity="0.7"/>`;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4 + 0.2;
    s += `<line x1="${(cx - r * 0.8 * Math.cos(a)).toFixed(1)}" y1="${(cy - r * 0.8 * Math.sin(a)).toFixed(1)}" x2="${(cx + r * 0.8 * Math.cos(a)).toFixed(1)}" y2="${(cy + r * 0.8 * Math.sin(a)).toFixed(1)}" stroke="#D9A93F" stroke-width="${r * 0.012}" opacity="0.8"/>`;
  }
  if (toppings === "pep") {
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, d = r * (0.15 + rnd() * 0.47), pr = r * (0.07 + rnd() * 0.03);
      s += `<circle cx="${(cx + d * Math.cos(a)).toFixed(1)}" cy="${(cy + d * Math.sin(a)).toFixed(1)}" r="${pr.toFixed(1)}" fill="${PEP}" stroke="${PEP_D}" stroke-width="${(pr * 0.18).toFixed(1)}"/>`;
    }
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2, d = r * (0.1 + rnd() * 0.56);
      s += `<circle cx="${(cx + d * Math.cos(a)).toFixed(1)}" cy="${(cy + d * Math.sin(a)).toFixed(1)}" r="${(r * 0.025).toFixed(1)}" fill="${GREEN}"/>`;
    }
  } else if (toppings === "hawai") {
    for (let i = 0; i < 8; i++) {
      const a = rnd() * Math.PI * 2, d = r * (0.15 + rnd() * 0.45), pr = r * 0.085;
      const px = cx + d * Math.cos(a), py = cy + d * Math.sin(a);
      s += `<rect x="${(px - pr).toFixed(1)}" y="${(py - pr * 0.6).toFixed(1)}" width="${(pr * 2).toFixed(1)}" height="${(pr * 1.2).toFixed(1)}" rx="${(pr * 0.3).toFixed(1)}" fill="#FFE08A" stroke="#E0AE3A" stroke-width="2" transform="rotate(${(rnd() * 90).toFixed(0)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
    }
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2, d = r * (0.1 + rnd() * 0.52);
      s += `<circle cx="${(cx + d * Math.cos(a)).toFixed(1)}" cy="${(cy + d * Math.sin(a)).toFixed(1)}" r="${(r * 0.07).toFixed(1)}" fill="#F2A6B4" stroke="#D97A8C" stroke-width="2"/>`;
    }
  } else {
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, d = r * (0.05 + rnd() * 0.63);
      s += `<circle cx="${(cx + d * Math.cos(a)).toFixed(1)}" cy="${(cy + d * Math.sin(a)).toFixed(1)}" r="${(r * (0.02 + rnd() * 0.02)).toFixed(1)}" fill="#6B3A1F"/>`;
    }
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2, d = r * (0.15 + rnd() * 0.45), pr = r * 0.08;
      s += `<circle cx="${(cx + d * Math.cos(a)).toFixed(1)}" cy="${(cy + d * Math.sin(a)).toFixed(1)}" r="${pr.toFixed(1)}" fill="${PEP}" stroke="${PEP_D}" stroke-width="2"/>`;
    }
  }
  return s;
}

function tequenos(cx, cy, scale) {
  let s = `<ellipse cx="${cx}" cy="${cy + 90 * scale}" rx="${220 * scale}" ry="${40 * scale}" fill="#000" opacity="0.45"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${260 * scale}" fill="url(#glow)"/>`;
  for (let i = 0; i < 5; i++) {
    const ang = -38 + i * 19, x = cx - 170 * scale + i * 16 * scale, y = cy + 50 * scale;
    s += `<g transform="rotate(${ang} ${x} ${y})"><rect x="${x}" y="${y - 34 * scale}" width="${340 * scale}" height="${68 * scale}" rx="${34 * scale}" fill="#E8B55C" stroke="#C18A33" stroke-width="${6 * scale}"/>`;
    for (const off of [50, 130, 210]) {
      s += `<line x1="${x + off * scale}" y1="${y - 34 * scale}" x2="${x + off * scale}" y2="${y + 34 * scale}" stroke="#C18A33" stroke-width="${4 * scale}" opacity="0.7"/>`;
    }
    s += `</g>`;
  }
  return s;
}

function storefront(cx, cy, scale) {
  const w = 560 * scale, hh = 300 * scale, x = cx - w / 2, y = cy - hh / 2;
  let s = `<circle cx="${cx}" cy="${cy}" r="${360 * scale}" fill="url(#glow)"/>`;
  s += `<rect x="${x}" y="${y + 40 * scale}" width="${w}" height="${hh}" rx="${14 * scale}" fill="#3A2A1A" stroke="#56402a" stroke-width="${5 * scale}"/>`;
  const n = 6, aw = w / n, colors = [YELLOW, BLUE, RED];
  for (let i = 0; i < n; i++) {
    s += `<path d="M ${x + i * aw} ${y + 40 * scale} h ${aw} v ${46 * scale} a ${aw / 2} ${30 * scale} 0 0 1 -${aw} 0 Z" fill="${colors[i % 3]}"/>`;
  }
  s += `<rect x="${cx - 50 * scale}" y="${y + 150 * scale}" width="${100 * scale}" height="${190 * scale}" rx="${10 * scale}" fill="#1d1409" stroke="#56402a" stroke-width="${4 * scale}"/>`;
  s += `<rect x="${x + 45 * scale}" y="${y + 160 * scale}" width="${120 * scale}" height="${90 * scale}" rx="${8 * scale}" fill="#FFD86B" opacity="0.85"/>`;
  s += `<rect x="${x + w - 165 * scale}" y="${y + 160 * scale}" width="${120 * scale}" height="${90 * scale}" rx="${8 * scale}" fill="#FFD86B" opacity="0.85"/>`;
  s += `<rect x="${cx - 170 * scale}" y="${y - 6 * scale}" width="${340 * scale}" height="${52 * scale}" rx="${12 * scale}" fill="${RED}"/>`;
  s += `<text x="${cx}" y="${y + 30 * scale}" text-anchor="middle" font-size="${30 * scale}" font-weight="bold" fill="#fff" letter-spacing="2">SABOR LLANERO</text>`;
  return s;
}

const label = (w, h, title, caption) =>
  `<text x="${w / 2}" y="${h - 92}" text-anchor="middle" font-size="46" font-weight="bold" fill="${YELLOW}" letter-spacing="6">${title}</text>` +
  `<text x="${w / 2}" y="${h - 48}" text-anchor="middle" font-size="22" fill="#cdbfa8" letter-spacing="3">${caption}</text>`;

function make(rel, w, h, body, title, caption) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, header(w, h) + body + label(w, h, title, caption) + tricolor(w, h) + "</svg>", "utf8");
  console.log("✔", rel);
}

const W = 1600, H = 900;
make("public/images/hero/hero-1.svg", W, H, pizza(W / 2, H / 2 - 50, 290, 1, "pep"), "PIZZA ARTESANAL", "Reemplaza por foto real · hero-1");
make("public/images/hero/hero-2.svg", W, H, storefront(W / 2, H / 2 - 40, 1.15), "NUESTRO LOCAL", "Reemplaza por foto real · hero-2");
make("public/images/hero/hero-3.svg", W, H, pizza(W / 2, H / 2 - 50, 290, 3, "hawai"), "PIZZA HAWAIANA", "Reemplaza por foto real · hero-3");
make("public/images/hero/hero-4.svg", W, H, tequenos(W / 2, H / 2 - 60, 1.0), "TEQUEÑOS", "Reemplaza por foto real · hero-4");
make("public/images/hero/hero-5.svg", W, H, pizza(W / 2, H / 2 - 50, 290, 5, "beef"), "PIZZA FULL BEEF", "Reemplaza por foto real · hero-5");

const G = 800;
const specs = [
  ["pep", "PEPPERONI"], ["hawai", "HAWAIANA"], ["beef", "FULL BEEF"], ["pep", "AMERICANA"],
  [null, "TEQUEÑOS"], ["beef", "CARNES"], ["store", "EL LOCAL"], ["beef", "ESPECIAL"],
];
specs.forEach(([kind, title], i) => {
  let body;
  if (kind === null) body = tequenos(G / 2, G / 2 - 60, 0.85);
  else if (kind === "store") body = storefront(G / 2, G / 2 - 30, 0.78);
  else body = pizza(G / 2, G / 2 - 50, 225, 10 + i, kind);
  make(`public/images/gallery/gallery-${i + 1}.svg`, G, G, body, title, `Foto galería ${i + 1} · reemplazar`);
});

const aboutBody =
  `<circle cx="600" cy="400" r="420" fill="url(#glow)"/>` +
  `<g transform="translate(600 380)">` +
  `<path d="M0 130 C -160 10 -150 -120 -60 -120 C -15 -120 0 -80 0 -80 C 0 -80 15 -120 60 -120 C 150 -120 160 10 0 130 Z" fill="${RED}" stroke="#8E1020" stroke-width="8"/>` +
  `<rect x="-210" y="-230" width="120" height="80" rx="10" fill="${YELLOW}"/>` +
  `<rect x="-210" y="-203" width="120" height="27" fill="${BLUE}"/>` +
  `<rect x="-210" y="-176" width="120" height="27" fill="${RED}" opacity="0.95"/>` +
  `<rect x="90" y="-230" width="120" height="80" rx="10" fill="#fff"/>` +
  `<rect x="90" y="-230" width="40" height="80" fill="${RED}"/>` +
  `<rect x="170" y="-230" width="40" height="80" fill="${RED}"/>` +
  `</g>`;
make("public/images/about/family.svg", 1200, 900, aboutBody, "NUESTRA FAMILIA", "Reemplaza por una foto real de la familia");

console.log("\nListo. Reinicia el servidor de desarrollo para ver los cambios.");
