// Lengths are stored in inches. These parse what people type in the Measurements
// box and format lengths for display.

export type UnitSystem = "imperial" | "metric";

/** Format inches as feet and inches to the nearest 1/8", e.g. 8' 6 1/2". */
export function formatImperial(inches: number): string {
  const neg = inches < 0;
  const v = Math.round(Math.abs(inches) * 8) / 8;
  const ft = Math.floor(v / 12 + 1e-9);
  const rest = v - ft * 12;
  const whole = Math.floor(rest + 1e-9);
  let n = Math.round((rest - whole) * 8);
  let d = 8;
  let frac = "";
  if (n) {
    while (n % 2 === 0) {
      n /= 2;
      d /= 2;
    }
    frac = `${n}/${d}`;
  }
  const ins = whole ? (frac ? `${whole} ${frac}` : `${whole}`) : frac || "0";
  const s = ft ? `${ft}' ${ins}"` : `${ins}"`;
  return (neg && v > 0 ? "-" : "") + s;
}

/** Format inches as millimetres, or metres when long. */
export function formatMetric(inches: number): string {
  const mm = inches * 25.4;
  if (Math.abs(mm) >= 1000) return `${+(mm / 1000).toFixed(3)} m`;
  return `${Math.round(mm)} mm`;
}

export function formatLength(inches: number, units: UnitSystem = "imperial"): string {
  return units === "metric" ? formatMetric(inches) : formatImperial(inches);
}

/** "12", "12.5", "1/2", "12 1/2", ".5" → number. */
function number(x: string): number {
  x = x.trim();
  if (!x) return 0;
  const m = x.match(/^(\d+(?:\.\d*)?|\.\d+)?\s*(?:(\d+)\s*\/\s*(\d+))?$/);
  if (!m || (m[1] === undefined && m[2] === undefined)) return NaN;
  let v = m[1] !== undefined ? parseFloat(m[1]) : 0;
  if (m[2]) {
    const den = +m[3];
    if (!den) return NaN;
    v += +m[2] / den;
  }
  return v;
}

const METRIC: Record<string, number> = { mm: 1 / 25.4, cm: 10 / 25.4, m: 1000 / 25.4 };

/**
 * Parse one length to inches. Accepts 8', 8'6", 8' 6", 8'-6", 6", 6, 30 1/2", 1/2,
 * 2.4m, 600mm, 60cm, and a leading minus. Bare numbers are taken in the display
 * units (inches, or millimetres for metric). Returns NaN if it can't be read.
 */
export function parseLength(text: string, units: UnitSystem = "imperial"): number {
  let s = text.trim().toLowerCase();
  if (!s) return NaN;
  let neg = false;
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1).trim();
  }
  let v: number;
  const metric = s.match(/^(\d+(?:\.\d*)?|\.\d+)\s*(mm|cm|m)$/);
  if (metric) {
    v = parseFloat(metric[1]) * METRIC[metric[2]];
  } else if (s.includes("'")) {
    const [ft, rest = ""] = s.split("'");
    const inches = rest.replace(/"/g, "").replace(/^\s*-\s*/, "");
    v = number(ft) * 12 + number(inches);
    if (!ft.trim()) v = NaN;
  } else if (s.includes('"')) {
    if (!/^[^"]*"\s*$/.test(s)) return NaN;
    v = number(s.replace(/"/g, ""));
  } else {
    v = number(s);
    if (units === "metric") v *= METRIC.mm;
  }
  if (!Number.isFinite(v)) return NaN;
  return neg ? -v : v;
}

/** Parse a comma-separated list of lengths, e.g. "10', 8'" for a rectangle. */
export function parseLengths(text: string, units: UnitSystem = "imperial"): number[] {
  return text.split(/[,;]/).map((p) => parseLength(p, units));
}
