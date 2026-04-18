import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cheerio = require('cheerio');
const { svgPathProperties } = require('svg-path-properties');

const OUT_LIGHT = path.join('images', 'anda.svg');
const OUT_DARK = path.join('images', 'anda_dark.svg');
const OUT_LIGHT_STATIC = path.join('images', 'anda_static.svg');
const OUT_DARK_STATIC = path.join('images', 'anda_dark_static.svg');

const VARIANTS = [
  {
    output: OUT_LIGHT,
    staticOutput: OUT_LIGHT_STATIC,
    palette: {
      '#000907': '#000907',
      '#0f1a19': '#0f1a19',
      '#d32523': '#d32523',
    },
    traceDark: '#111111',
    traceSoft: '#2a2a2a',
    accent: '#d32523',
    accentGlow: '#ffd0c8',
    pulseCore: '#ffffff',
    pulseOutline: '#5f0d10',
    glowBlur: 6.5,
    glowAlpha: 1.08,
    pulseOutlineWidth: 24,
    pulseGlowWidth: 18,
    pulseCoreWidth: 8.6,
    pulseSpeed: 5.6,
    auraOpacity: 0.12,
  },
  {
    output: OUT_DARK,
    staticOutput: OUT_DARK_STATIC,
    palette: {
      '#000907': '#F5EDE4',
      '#0f1a19': '#F5EDE4',
      '#d32523': '#ff6b5f',
    },
    traceDark: '#F5EDE4',
    traceSoft: '#F5EDE4',
    accent: '#ff6b5f',
    accentGlow: '#ffb7ae',
    pulseCore: '#fff8f6',
    pulseOutline: '#4a0f12',
    glowBlur: 6,
    glowAlpha: 1.02,
    pulseOutlineWidth: 22,
    pulseGlowWidth: 16.5,
    pulseCoreWidth: 8,
    pulseSpeed: 5.4,
    auraOpacity: 0.14,
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function resolveSource(argPath) {
  if (argPath) {
    return argPath;
  }

  const entries = await fs.readdir('.', { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^Untitled.*\.svg$/i.test(entry.name))
      .map(async (entry) => ({
        name: entry.name,
        stat: await fs.stat(entry.name),
      }))
  );

  if (!candidates.length) {
    throw new Error('No source SVG found. Pass one explicitly: node scripts/build_logo_animation.mjs <source.svg>');
  }

  candidates.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return candidates[0].name;
}

function sampleBounds(props, length) {
  const sampleCount = Math.max(48, Math.ceil(length / 140));
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i <= sampleCount; i += 1) {
    const point = props.getPointAtLength((length * i) / sampleCount);
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function classifyPath(fill, length) {
  if (fill === '#d32523') return 'accent';
  if (length > 5000) return 'primary';
  if (length > 900) return 'wordmark';
  return 'detail';
}

function buildMetrics(paths) {
  const minX = Math.min(...paths.map((pathInfo) => pathInfo.bounds.minX));
  const maxX = Math.max(...paths.map((pathInfo) => pathInfo.bounds.maxX));
  const spread = Math.max(1, maxX - minX);

  return paths.map((pathInfo) => {
    const lane = (pathInfo.bounds.minX - minX) / spread;
    const role = classifyPath(pathInfo.fill, pathInfo.length);
    const drawDelay = clamp(
      0.08 + lane * 0.68 + (role === 'accent' ? 0.38 : 0) + (role === 'detail' ? 0.08 : 0),
      0.08,
      1.2
    );
    const drawDuration = clamp(
      0.42 + Math.min(pathInfo.length, 6200) / 6200 * (role === 'accent' ? 0.95 : 1.12),
      0.38,
      role === 'accent' ? 1.38 : 1.58
    );
    const fillDelay = drawDelay + drawDuration * (role === 'detail' ? 0.3 : 0.48);
    const lift = clamp(10 - lane * 3.5, 5, 10);
    const strokeWidth =
      role === 'accent'
        ? 7
        : role === 'primary'
          ? 4.2
          : role === 'wordmark'
            ? 3.1
            : 2.2;

    return {
      ...pathInfo,
      role,
      lane,
      drawDelay: drawDelay.toFixed(2),
      drawDuration: drawDuration.toFixed(2),
      fillDelay: fillDelay.toFixed(2),
      lift: lift.toFixed(1),
      strokeWidth: strokeWidth.toFixed(1),
    };
  });
}

function buildStyle(variant, pulseLength, pulseStart, pulseDash, pulseGrowDuration, pulseRunStart) {
  return `
<style><![CDATA[
.anda-logo-svg {
  overflow: visible;
  shape-rendering: geometricPrecision;
}

.logo-stage {
  transform-origin: center;
  transform-box: view-box;
  animation: logoStageIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.logo-fill path {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: fillReveal 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: var(--fill-delay);
}

.logo-trace path {
  fill: none;
  stroke: var(--trace);
  stroke-width: var(--stroke-width);
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  stroke-dasharray: var(--len);
  stroke-dashoffset: var(--len);
  animation:
    traceIn var(--draw-duration) cubic-bezier(0.65, 0, 0.35, 1) forwards,
    traceFade 0.72s ease forwards;
  animation-delay:
    var(--draw-delay),
    calc(var(--draw-delay) + var(--draw-duration) + 0.14s);
}

.logo-pulse-glow path,
.logo-aura path {
  filter: url(#anda-red-glow);
}

.logo-aura path {
  opacity: 0;
  animation:
    auraReveal 0.01s linear forwards,
    auraBreath 5.6s ease-in-out infinite;
  animation-delay: ${pulseStart}s, ${pulseStart}s;
}

.logo-pulse-outline path,
.logo-pulse-glow path,
.logo-pulse-core path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  stroke-dasharray: 0 ${pulseLength + pulseDash};
  stroke-dashoffset: ${pulseLength + pulseDash};
  animation:
    pulseReveal ${pulseGrowDuration}s cubic-bezier(0.22, 1, 0.36, 1) forwards,
    pulseRun ${variant.pulseSpeed}s linear infinite;
  animation-delay: ${pulseStart}s, ${pulseRunStart}s;
}

.logo-pulse-outline path {
  stroke: ${variant.pulseOutline};
  stroke-width: ${variant.pulseOutlineWidth};
  --pulse-opacity: 0.95;
}

.logo-pulse-glow path {
  stroke: ${variant.accentGlow};
  stroke-width: ${variant.pulseGlowWidth};
  --pulse-opacity: 0.9;
}

.logo-pulse-core path {
  stroke: ${variant.pulseCore};
  stroke-width: ${variant.pulseCoreWidth};
  --pulse-opacity: 1;
}

@keyframes logoStageIn {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes fillReveal {
  0% { opacity: 0; transform: translateY(var(--lift)) scale(0.986); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes traceIn {
  0% { opacity: 0; stroke-dashoffset: var(--len); }
  12% { opacity: 1; }
  100% { opacity: 1; stroke-dashoffset: 0; }
}

@keyframes traceFade {
  to { opacity: 0; }
}

@keyframes auraReveal {
  from { opacity: 0; }
  to { opacity: 0.22; }
}

@keyframes auraBreath {
  0%, 100% { opacity: 0.04; }
  25% { opacity: 0.18; }
  55% { opacity: 0.08; }
}

@keyframes pulseReveal {
  0% {
    opacity: 0;
    stroke-dasharray: 0 ${pulseLength + pulseDash};
  }
  15% {
    opacity: var(--pulse-opacity);
  }
  100% {
    opacity: var(--pulse-opacity);
    stroke-dasharray: ${pulseDash} ${pulseLength + pulseDash};
  }
}

@keyframes pulseRun {
  from {
    opacity: var(--pulse-opacity);
    stroke-dasharray: ${pulseDash} ${pulseLength + pulseDash};
    stroke-dashoffset: ${pulseLength + pulseDash};
  }
  to {
    opacity: var(--pulse-opacity);
    stroke-dasharray: ${pulseDash} ${pulseLength + pulseDash};
    stroke-dashoffset: -${pulseDash};
  }
}

@media (prefers-reduced-motion: reduce) {
  .logo-stage,
  .logo-fill path,
  .logo-trace path,
  .logo-aura path,
  .logo-pulse-outline path,
  .logo-pulse-glow path,
  .logo-pulse-core path {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    stroke-dashoffset: 0 !important;
  }
}
]]></style>`;
}

function buildVariantSvg(sourceSvg, metrics, variant) {
  const $ = cheerio.load(sourceSvg, { xmlMode: true });
  const $svg = $('svg').first();
  $svg.attr('class', 'anda-logo-svg');

  const redPath = metrics.find((entry) => entry.role === 'accent');
  const pulseStart = (Number(redPath.fillDelay) + 0.8).toFixed(2);
  const pulseDash = Math.round(clamp(redPath.length * 0.28, 1100, 1500));
  const pulseGrowDuration = clamp(pulseDash / 1800, 0.45, 0.85).toFixed(2);
  const pulseRunStart = (Number(pulseStart) + Number(pulseGrowDuration)).toFixed(2);
  const style = buildStyle(
    variant,
    Math.round(redPath.length),
    pulseStart,
    pulseDash,
    pulseGrowDuration,
    pulseRunStart
  );

  const defs = `
<defs>
  <filter id="anda-red-glow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="${variant.glowBlur}" result="blur"/>
    <feColorMatrix in="blur" type="matrix" values="
      1 0 0 0 0
      0 1 0 0 0
      0 0 1 0 0
      0 0 0 ${variant.glowAlpha} 0" result="glow"/>
    <feMerge>
      <feMergeNode in="glow"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>`;

  const fillGroup = metrics
    .map((entry) => {
      const fill = variant.palette[entry.fill] || entry.fill;
      return `<path class="${entry.role}" fill="${fill}" d="${entry.d}" style="--fill-delay:${entry.fillDelay}s;--lift:${entry.lift}px"/>`;
    })
    .join('');

  const traceGroup = metrics
    .map((entry) => {
      const trace =
        entry.role === 'accent'
          ? variant.accent
          : entry.fill === '#0f1a19'
            ? variant.traceSoft
            : variant.traceDark;
      return `<path class="${entry.role}" d="${entry.d}" style="--len:${entry.length.toFixed(1)};--draw-delay:${entry.drawDelay}s;--draw-duration:${entry.drawDuration}s;--stroke-width:${entry.strokeWidth};--trace:${trace}"/>`;
    })
    .join('');

  const auraGroup = `<path d="${redPath.d}" fill="${variant.accent}" opacity="${variant.auraOpacity}"/>`;
  const pulseOutlineGroup = `<path d="${redPath.d}"/>`;
  const pulseGlowGroup = `<path d="${redPath.d}"/>`;
  const pulseCoreGroup = `<path d="${redPath.d}"/>`;

  $svg.html(
    `<!-- Generated by scripts/build_logo_animation.mjs -->${defs}${style}<g class="logo-stage"><g class="logo-fill">${fillGroup}</g><g class="logo-trace">${traceGroup}</g><g class="logo-aura">${auraGroup}</g><g class="logo-pulse-outline">${pulseOutlineGroup}</g><g class="logo-pulse-glow">${pulseGlowGroup}</g><g class="logo-pulse-core">${pulseCoreGroup}</g></g>`
  );

  return $.xml($svg);
}

function buildStaticVariantSvg(sourceSvg, variant) {
  const $ = cheerio.load(sourceSvg, { xmlMode: true });
  const $svg = $('svg').first();

  $svg.find('path').each((_, element) => {
    const $path = $(element);
    const fill = ($path.attr('fill') || '').toLowerCase();
    const mappedFill = variant.palette[fill];
    if (mappedFill) {
      $path.attr('fill', mappedFill);
    }
  });

  return $.xml($svg);
}

async function main() {
  const sourcePath = await resolveSource(process.argv[2]);
  const sourceSvg = await fs.readFile(sourcePath, 'utf8');
  const $ = cheerio.load(sourceSvg, { xmlMode: true });
  const paths = $('path')
    .toArray()
    .map((element, index) => {
      const d = $(element).attr('d');
      const fill = ($(element).attr('fill') || '').toLowerCase();
      const props = new svgPathProperties(d);
      const length = props.getTotalLength();
      const bounds = sampleBounds(props, length);

      return {
        index,
        d,
        fill,
        length,
        bounds,
      };
    });

  const metrics = buildMetrics(paths);

  await fs.mkdir('images', { recursive: true });
  for (const variant of VARIANTS) {
    const animatedSvg = buildVariantSvg(sourceSvg, metrics, variant);
    const staticSvg = buildStaticVariantSvg(sourceSvg, variant);
    await fs.writeFile(variant.output, animatedSvg, 'utf8');
    await fs.writeFile(variant.staticOutput, staticSvg, 'utf8');
  }

  console.log(`Animated logo rebuilt from ${sourcePath}`);
  for (const entry of metrics) {
    console.log(
      `path ${entry.index}: role=${entry.role} len=${entry.length.toFixed(1)} delay=${entry.drawDelay}s dur=${entry.drawDuration}s`
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
