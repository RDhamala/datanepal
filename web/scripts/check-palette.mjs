/**
 * Palette validator.
 *
 * CLAUDE.md requires running a validator rather than reasoning about colour
 * contrast. The dataviz skill that previously provided one is not available in
 * this environment, so the check lives here instead — in the repo, versioned,
 * and runnable by anyone.
 *
 * Two different questions, two different tests:
 *
 *   Categorical slots must be *distinguishable from each other*, including
 *   under the three common dichromacies. Measured as CIE76 dE in Lab after
 *   Brettel/Viénot-style dichromacy simulation.
 *
 *   Sequential ramps must be *monotonic in lightness*. Adjacency dE is the wrong
 *   test for a ramp — a good ramp has small steps by construction, so a
 *   categorical validator fails it by design. What matters is that lightness
 *   never reverses, because reversal makes the ramp unreadable as an order.
 *
 * Run: node scripts/check-palette.mjs
 */

const CATEGORICAL_MIN_DE = 20; // distinguishable under CVD
const TEXT_ON_FILL_MIN = 4.5; // WCAG AA for body text
const FILL_ON_SURFACE_MIN = 1.15; // adjacent map fills need only be separable

/* ------------------------------------------------------------ colour maths */

const srgbToLinear = (c) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function relativeLuminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map(srgbToLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(a, b) {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbToXyz([r, g, b]) {
  const [R, G, B] = [r, g, b].map(srgbToLinear);
  return [
    R * 0.4124 + G * 0.3576 + B * 0.1805,
    R * 0.2126 + G * 0.7152 + B * 0.0722,
    R * 0.0193 + G * 0.1192 + B * 0.9505,
  ];
}

function xyzToLab([x, y, z]) {
  const ref = [0.95047, 1.0, 1.08883];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [x / ref[0], y / ref[1], z / ref[2]].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const lab = (hex) => xyzToLab(rgbToXyz(hexToRgb(hex)));
const lightness = (hex) => lab(hex)[0];

function deltaE(a, b) {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * Dichromacy simulation in linear RGB.
 *
 * Matrices are the standard Viénot-Brettel-Mollon approximations. They are not
 * a perceptual ground truth, but they are more than good enough to catch the
 * real failure — two series colours that collapse onto each other.
 */
const CVD = {
  protanopia: [
    [0.1121, 0.8853, -0.0005],
    [0.1127, 0.8897, -0.0001],
    [0.0045, 0.0, 1.0019],
  ],
  deuteranopia: [
    [0.292, 0.7054, -0.0003],
    [0.2934, 0.7089, 0.0001],
    [-0.0209, 0.0272, 0.9979],
  ],
  tritanopia: [
    [1.0159, 0.1349, -0.1408],
    [-0.0117, 0.8704, 0.1584],
    [0.0742, 0.0561, 0.8788],
  ],
};

function simulate(hex, kind) {
  const m = CVD[kind];
  const lin = hexToRgb(hex).map(srgbToLinear);
  const out = m.map((row) => row.reduce((s, k, i) => s + k * lin[i], 0));
  const toSrgb = (c) => {
    const v = Math.max(0, Math.min(1, c));
    return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };
  return (
    "#" +
    out
      .map((c) =>
        Math.round(toSrgb(c) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/* ------------------------------------------------------------- the palette */

// Kept in step with app/globals.css. Duplicated deliberately: this script must
// be able to fail, and importing the CSS would mean parsing Tailwind's theme.
const LIGHT = {
  surface: "#ffffff",
  ink: "#0f0f0e",
  categorical: { "series-1": "#2a78d6", "series-2": "#eb6834" },
  sequential: ["#eef4fd", "#c3dbf7", "#7fb0e9", "#3d84da", "#1c5aa6"],
  // Province grouping tints for the reference map. Four is enough for any
  // planar map (four-colour theorem), so no province ever shares a tint with a
  // neighbour, and four low-chroma tints of two hues stay well short of a
  // rainbow.
  // Ordered so consecutive indices cross hue families. Greedy graph colouring
  // reaches for low indices first, so index 0 and 1 are the pair most likely to
  // end up on neighbouring provinces -- they must be the *most* separable, not
  // the least.
  grouping: ["#e9eff7", "#eaece5", "#d5e2f2", "#d7dcd0"],
};

const DARK = {
  surface: "#100f0e",
  ink: "#ffffff",
  categorical: { "series-1": "#3987e5", "series-2": "#d95926" },
  sequential: ["#16283d", "#1d4270", "#2a6bb5", "#5698e2", "#a8caf1"],
  grouping: ["#1a222e", "#1d1f1b", "#243046", "#2b3029"],
};

/* ------------------------------------------------------------------ checks */

let failures = 0;
const fail = (msg) => {
  console.error(`  FAIL  ${msg}`);
  failures++;
};
const pass = (msg) => console.log(`  ok    ${msg}`);

function checkCategorical(name, palette) {
  const entries = Object.entries(palette.categorical);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [na, ca] = entries[i];
      const [nb, cb] = entries[j];
      const normal = deltaE(ca, cb);
      const worst = Math.min(
        ...Object.keys(CVD).map((k) => deltaE(simulate(ca, k), simulate(cb, k))),
      );
      const line = `${name} ${na} vs ${nb}: normal dE ${normal.toFixed(1)}, worst CVD dE ${worst.toFixed(1)}`;
      if (worst < CATEGORICAL_MIN_DE) fail(`${line} (need >= ${CATEGORICAL_MIN_DE})`);
      else pass(line);
    }
  }
  for (const [n, c] of entries) {
    const k = contrast(c, palette.surface);
    if (k < 3) fail(`${name} ${n} on surface: contrast ${k.toFixed(2)} (need >= 3)`);
    else pass(`${name} ${n} on surface: contrast ${k.toFixed(2)}`);
  }
}

function checkSequential(name, ramp) {
  const ls = ramp.map(lightness);
  const rising = ls.every((l, i) => i === 0 || l > ls[i - 1]);
  const falling = ls.every((l, i) => i === 0 || l < ls[i - 1]);
  const span = Math.abs(ls.at(-1) - ls[0]) / 100;
  if (!rising && !falling) {
    fail(
      `${name} sequential: lightness not monotonic (${ls.map((l) => l.toFixed(0)).join(" ")})`,
    );
  } else if (span < 0.4) {
    fail(
      `${name} sequential: lightness span ${span.toFixed(2)} too small (need >= 0.40)`,
    );
  } else {
    pass(
      `${name} sequential: monotonic ${rising ? "rising" : "falling"}, span ${span.toFixed(2)}`,
    );
  }
}

function checkGrouping(name, palette) {
  // Grouping tints carry identity, not magnitude, so they must be separable
  // from each other and from the surface -- but they also sit under black
  // district labels, so text contrast is the binding constraint.
  for (let i = 0; i < palette.grouping.length; i++) {
    const c = palette.grouping[i];
    const onSurface = contrast(c, palette.surface);
    const textOn = contrast(palette.ink, c);
    if (textOn < TEXT_ON_FILL_MIN) {
      fail(
        `${name} grouping ${i}: label contrast ${textOn.toFixed(2)} (need >= ${TEXT_ON_FILL_MIN})`,
      );
    } else if (onSurface < FILL_ON_SURFACE_MIN) {
      fail(
        `${name} grouping ${i}: only ${onSurface.toFixed(2)} against surface (need >= ${FILL_ON_SURFACE_MIN})`,
      );
    } else {
      pass(
        `${name} grouping ${i} ${c}: label contrast ${textOn.toFixed(2)}, vs surface ${onSurface.toFixed(2)}`,
      );
    }
    for (let j = i + 1; j < palette.grouping.length; j++) {
      const d = palette.grouping[j];
      const worst = Math.min(
        deltaE(c, d),
        ...Object.keys(CVD).map((k) => deltaE(simulate(c, k), simulate(d, k))),
      );
      /*
        Every pair, not just consecutive ones.

        The first version only held consecutive indices to a high bar, on the
        theory that greedy colouring pairs them most often. That was wrong:
        greedy takes the lowest free index, so on Nepal's province graph it
        assigned 0, 1 and 2 -- and 0 vs 2 was the weak blue-on-blue pair, which
        landed on the Bagmati/Gandaki border. Which pair ends up sharing a
        border is not predictable from index order, so all of them must work.
      */
      const FLOOR = 5;
      if (worst < FLOOR) {
        fail(
          `${name} grouping ${i} vs ${j}: worst dE ${worst.toFixed(1)} (need >= ${FLOOR})`,
        );
      } else {
        pass(`${name} grouping ${i} vs ${j}: worst dE ${worst.toFixed(1)}`);
      }
    }
  }
}

for (const [name, palette] of [
  ["light", LIGHT],
  ["dark", DARK],
]) {
  console.log(`\n${name} mode`);
  checkCategorical(name, palette);
  checkSequential(name, palette.sequential);
  checkGrouping(name, palette);
}

console.log(failures === 0 ? "\npalette ok\n" : `\n${failures} palette failure(s)\n`);
process.exit(failures === 0 ? 0 : 1);
