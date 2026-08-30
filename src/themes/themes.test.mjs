/**
 * Every theme in this folder, checked as arithmetic rather than as taste.
 *
 * Run: node --test src/themes/themes.test.mjs
 *
 * What this catches that a screenshot does not:
 *   - a token missing from a theme, which silently falls through to whatever
 *     app.css last defined and produces a half-applied palette;
 *   - a text pair a judge cannot read, in either colour scheme;
 *   - a colour outside sRGB, which every browser clips slightly differently —
 *     so the archived judging screenshot is not the thing you signed off;
 *   - an accent close enough in hue to the error or success colour that a
 *     status becomes ambiguous;
 *   - a neutral ramp that stops being a ramp.
 *
 * These thresholds are floors, not targets. Raising one and re-running is the
 * intended way to argue about a palette.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseThemeFile, contrastRatio, inSrgbGamut, hueDistance, oklchToHex } from './contrast.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const RAMP = ['color-ink-50', 'color-ink-100', 'color-ink-300', 'color-ink-500', 'color-ink-700', 'color-ink-900'];
const REQUIRED = [...RAMP, 'color-accent', 'color-accent-soft', 'color-danger', 'color-ok'];

/** Themes that deliberately clear AAA instead of AA. */
const AAA = new Set(['noir']);

const WHITE = { L: 1, C: 0, H: 0 };

/**
 * Text pairs, written as [foreground, background, what it is] per scheme.
 *
 * These are not every possible combination — they are the pairings the kit's
 * markup actually produces, counted out of `src/`. A pair nobody renders is not
 * worth constraining a palette over, and a pair rendered 44 times is worth
 * failing a build for. The dark list differs from the light list because the
 * kit's `dark:` variants swap which token lands on which surface: ink-700 is
 * text on a light page and a raised *surface* on a dark one, so it appears as
 * a foreground below only in the light column.
 */
const TEXT_PAIRS = {
  light: [
    ['color-ink-900', 'color-ink-50', 'body text on the page'],
    ['color-ink-700', 'color-ink-50', 'strong secondary text'],
    ['color-ink-500', 'color-ink-50', 'secondary text — 44 uses in the kit'],
    ['color-accent', 'color-ink-50', 'links on the page'],
    ['color-accent', 'color-accent-soft', 'accent text on its own chip'],
    ['color-ink-900', 'color-accent-soft', 'plain text on a chip'],
    ['color-danger', 'color-ink-50', 'error text'],
    ['color-ok', 'color-ink-50', 'success text'],
  ],
  dark: [
    ['color-ink-50', 'color-ink-900', 'body text on the page'],
    ['color-ink-500', 'color-ink-900', 'secondary text — 44 uses in the kit'],
    ['color-ink-300', 'color-ink-900', 'dark:text-ink-300'],
    ['color-ink-100', 'color-ink-700', 'dark:text-ink-100 on dark:bg-ink-700'],
    ['color-accent', 'color-ink-900', 'links on the page'],
    ['color-accent', 'color-accent-soft', 'accent text on its own chip'],
    ['color-ink-50', 'color-accent-soft', 'plain text on a chip (via the shim rule)'],
    ['color-danger', 'color-ink-900', 'error text'],
    ['color-ok', 'color-ink-900', 'success text'],
  ],
};

/** Solid fills that carry white label text. */
const WHITE_ON = ['color-accent', 'color-danger'];

/**
 * Borders are held to 2:1, not the 3:1 WCAG 1.4.11 asks for on control
 * boundaries. 3:1 turns every input outline into a mid-grey rule and changes
 * the look of the app substantially — that is the integrator's call to make,
 * not a token file's. 2:1 is set where it is because the kit ships 1.82:1, so
 * this is a floor that no theme is allowed to fall back below. See README.
 */
const BORDER_MIN = 2.0;

/** Two status colours closer than this in hue stop being distinguishable. */
const HUE_MIN = 55;

const themes = readdirSync(HERE)
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ name: f.replace(/\.css$/, ''), css: readFileSync(join(HERE, f), 'utf8') }));

test('the folder actually contains themes', () => {
  assert.ok(themes.length > 0, 'no .css theme files found next to this test');
});

for (const { name, css } of themes) {
  const { light, dark } = parseThemeFile(css);
  const target = AAA.has(name) ? 7 : 4.5;
  const schemes = { light, dark };

  test(`${name}: declares every token the kit uses`, () => {
    for (const key of REQUIRED) {
      assert.ok(light[key], `${name}.css never sets --${key}; the kit would fall back to app.css and render half-themed`);
    }
  });

  test(`${name}: every colour survives the trip to sRGB`, () => {
    for (const [scheme, tokens] of Object.entries(schemes)) {
      for (const [key, v] of Object.entries(tokens)) {
        assert.ok(
          inSrgbGamut(v.L, v.C, v.H),
          `${name} ${scheme} --${key} = oklch(${v.L} ${v.C} ${v.H}) is outside sRGB; browsers clip it differently, so the judging screenshot will not match what you approved`,
        );
      }
    }
  });

  test(`${name}: text is legible in both colour schemes (AA ${target}:1)`, () => {
    for (const [scheme, pairs] of Object.entries(TEXT_PAIRS)) {
      const tokens = schemes[scheme];
      for (const [fg, bg, what] of pairs) {
        const r = contrastRatio(tokens[fg], tokens[bg]);
        assert.ok(
          r >= target,
          `${name} ${scheme}: ${what} — ${fg} on ${bg} is ${r.toFixed(2)}:1, below ${target}:1 ` +
            `(${oklchToHex(tokens[fg].L, tokens[fg].C, tokens[fg].H)} on ${oklchToHex(tokens[bg].L, tokens[bg].C, tokens[bg].H)})`,
        );
      }
    }
  });

  test(`${name}: white button labels are legible on solid fills`, () => {
    for (const key of WHITE_ON) {
      const r = contrastRatio(WHITE, light[key]);
      assert.ok(r >= target, `${name}: white text on bg-${key.replace('color-', '')} is ${r.toFixed(2)}:1, below ${target}:1`);
    }
  });

  test(`${name}: borders are visible against both page backgrounds`, () => {
    for (const [scheme, tokens] of Object.entries(schemes)) {
      const bg = scheme === 'light' ? 'color-ink-50' : 'color-ink-900';
      const r = contrastRatio(tokens['color-ink-300'], tokens[bg]);
      assert.ok(r >= BORDER_MIN, `${name} ${scheme}: ink-300 border on ${bg} is ${r.toFixed(2)}:1, below the ${BORDER_MIN}:1 floor`);
    }
  });

  test(`${name}: accent, danger and ok stay tellable apart`, () => {
    const pairs = [
      ['color-accent', 'color-danger'],
      ['color-accent', 'color-ok'],
      ['color-danger', 'color-ok'],
    ];
    for (const [a, b] of pairs) {
      const d = hueDistance(light[a], light[b]);
      assert.ok(
        d >= HUE_MIN,
        `${name}: ${a} and ${b} are ${d.toFixed(0)}° apart in hue, under ${HUE_MIN}° — a status badge would read as the wrong status`,
      );
    }
  });

  test(`${name}: the neutral ramp is monotonic in both schemes`, () => {
    // ink-500 is the only ramp step a theme moves for dark mode. Moving it out
    // of order would make bg-ink-100 lighter than the text on it, or ink-500
    // darker than the ink-700 it is supposed to be quieter than.
    for (const [scheme, tokens] of Object.entries(schemes)) {
      for (let i = 1; i < RAMP.length; i++) {
        const prev = tokens[RAMP[i - 1]];
        const cur = tokens[RAMP[i]];
        assert.ok(
          cur.L < prev.L,
          `${name} ${scheme}: ${RAMP[i]} (L ${cur.L}) is not darker than ${RAMP[i - 1]} (L ${prev.L}) — the ramp is out of order`,
        );
      }
    }
  });

  test(`${name}: ships the dark-mode chip shim`, () => {
    // The shim repairs `bg-accent-soft text-ink-900` once accent-soft inverts.
    // A theme that overrides accent-soft for dark mode and forgets it leaves
    // two call sites with invisible text — see the comment in the theme file.
    const invertsChip = /@media[^{]*prefers-color-scheme:\s*dark[\s\S]*--color-accent-soft/.test(css);
    if (!invertsChip) return;
    assert.match(
      css,
      /\.bg-accent-soft\.text-ink-900\s*\{[^}]*--color-ink-50/,
      `${name}.css inverts --color-accent-soft for dark mode but ships no .bg-accent-soft.text-ink-900 rule; two chips render text-ink-900 on a near-ink-900 background`,
    );
  });
}
