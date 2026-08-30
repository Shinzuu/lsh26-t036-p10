/**
 * OKLCH → sRGB → WCAG contrast, with no dependencies.
 *
 * Every token in this kit is written in `oklch()`, which is the right call for
 * authoring — lightness is perceptually even, so a ramp reads as a ramp — but it
 * hides the two things that actually cost UI/UX marks: a colour that falls
 * outside sRGB (each browser clips it differently, so the archived screenshot is
 * not what you saw) and a text pair a judge cannot read on a phone in daylight.
 *
 * Neither is visible by eye at 21:50. Both are arithmetic.
 */

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** OKLCH → linear-light sRGB. Values outside 0..1 mean outside the sRGB gamut. */
export function oklchToLinearRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

/** True when the colour survives the trip to sRGB without being clipped. */
export function inSrgbGamut(L, C, H, tolerance = 0.001) {
  const { r, g, b } = oklchToLinearRgb(L, C, H);
  return [r, g, b].every((v) => v >= -tolerance && v <= 1 + tolerance);
}

/** Hex, for putting an actual swatch in front of a human. */
export function oklchToHex(L, C, H) {
  const lin = oklchToLinearRgb(L, C, H);
  const enc = (v) => {
    const c = clamp01(v);
    const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(s * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${enc(lin.r)}${enc(lin.g)}${enc(lin.b)}`;
}

/** WCAG 2.2 relative luminance. Clipped first, because the screen clips too. */
export function relativeLuminance(L, C, H) {
  const { r, g, b } = oklchToLinearRgb(L, C, H);
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

/** WCAG 2.2 contrast ratio, 1..21. Order of arguments does not matter. */
export function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg.L, fg.C, fg.H);
  const b = relativeLuminance(bg.L, bg.C, bg.H);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pull `--color-*: oklch(L C H)` declarations out of a theme file.
 *
 * Deliberately strict: it only understands the one syntax these files are
 * allowed to use. A theme that sneaks in a hex value or a `var()` indirection
 * will come back missing that token and fail the completeness check, which is
 * the intended outcome — every theme has to be readable by this parser for the
 * contrast gate to mean anything.
 */
export function parseTheme(css) {
  const tokens = {};
  const re = /--(color-[a-z0-9-]+)\s*:\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    tokens[m[1]] = { L: parseFloat(m[2]), C: parseFloat(m[3]), H: parseFloat(m[4]) };
  }
  return tokens;
}

/** Smallest hue gap between two colours, in degrees (0..180). */
export function hueDistance(a, b) {
  const d = Math.abs(a.H - b.H) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Split a theme file into its light values and its effective dark values.
 *
 * A theme declares a full palette in `:root` and overrides only what has to
 * move inside `@media (prefers-color-scheme: dark)`. The dark palette a browser
 * actually resolves is the light one with those overrides applied, so that is
 * what comes back here — checking the override block on its own would silently
 * skip every token the theme did not need to change.
 */
export function parseThemeFile(css) {
  const at = css.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i);
  const lightSrc = at === -1 ? css : css.slice(0, at);
  const darkSrc = at === -1 ? '' : css.slice(at);
  const light = parseTheme(lightSrc);
  return { light, dark: { ...light, ...parseTheme(darkSrc) } };
}
