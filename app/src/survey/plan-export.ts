// Proposed → plan: the groups on the Proposed tag that are axis-aligned boxes become
// `add: objects:` entries of a survey plan file (survey/docs/plans.md). Everything
// else on Proposed is reported by name and left out, never approximated.

import { ROOT, type Model } from "../kernel/model";
import { apply, applyDir, type Vec3 } from "../math";
import { surveyTags } from "./mode";

export interface PlanExport {
  yaml: string;
  skipped: string[];
}

interface Box {
  name: string;
  /** World-space extents in inches. */
  min: Vec3;
  max: Vec3;
  material: string;
}

/** Inches as the survey spec writes lengths: 24', 2'6", 30", 0.5". */
export function ftin(inches: number): string {
  const sign = inches < 0 ? "-" : "";
  const v = Math.round(Math.abs(inches) * 10000) / 10000;
  const ft = Math.floor(v / 12);
  const rest = Math.round((v - ft * 12) * 10000) / 10000;
  const inch = `${rest}"`;
  if (ft && rest === 0) return `${sign}${ft}'`;
  return sign + (ft ? `${ft}'${inch}` : inch);
}

/** A plan entry name from a group name: lowercase, `[a-z0-9_]`, or `proposed_N` for unnamed groups. */
function entryName(raw: string, n: number): string {
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return !s || /^group_?\d+$/.test(s) ? `proposed_${n}` : s;
}

/**
 * The world-space box of a group placed in the root, or null when its geometry is
 * not an axis-aligned box: exactly six faces, each normal on an axis, and every
 * vertex on the box's bounds.
 */
function boxOf(model: Model, inst: number): { min: Vec3; max: Vec3 } | null {
  const info = model.instanceInfo(inst);
  if (!info) return null;
  const m = model.worldTransform(info.definition);
  const b = model.buffers(info.definition);
  const faces = [...new Set(b.faceIds)];
  if (faces.length !== 6 || model.instances(info.definition).length) return null;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < b.positions.length; i += 3) {
    const p = apply(m, [b.positions[i], b.positions[i + 1], b.positions[i + 2]]);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  }
  const eps = 1e-4;
  for (let k = 0; k < 3; k++) if (max[k] - min[k] < eps) return null;
  for (const f of faces) {
    const n = applyDir(m, model.facePlane(f)!.normal);
    const axis = n.map((c) => Math.abs(Math.abs(c) - 1) < 1e-6).filter(Boolean).length;
    const zeros = n.filter((c) => Math.abs(c) < 1e-6).length;
    if (axis !== 1 || zeros !== 2) return null;
  }
  for (let i = 0; i < b.positions.length; i += 3) {
    const p = apply(m, [b.positions[i], b.positions[i + 1], b.positions[i + 2]]);
    for (let k = 0; k < 3; k++) if (Math.abs(p[k] - min[k]) > eps && Math.abs(p[k] - max[k]) > eps) return null;
  }
  return { min, max };
}

/**
 * Export the groups on Proposed as a plan file named `planName`. `date` is the
 * description's date (today by default).
 */
export function exportProposed(model: Model, planName: string, date = new Date().toISOString().slice(0, 10)): PlanExport {
  const tags = surveyTags(model);
  if (!tags) throw new Error("not a survey model: it needs the tags Existing, Demo and Proposed");
  const materials = new Map(model.materials().map((m) => [m.id, m.name]));
  const boxes: Box[] = [];
  const skipped: string[] = [];
  let n = 0;
  for (const inst of model.instances(ROOT)) {
    const props = model.instanceProps(inst.id);
    if (!props || props.tag !== tags.Proposed.id) continue;
    n++;
    const raw = props.name || model.definitionName(inst.definition);
    const name = entryName(raw, n);
    const box = boxOf(model, inst.id);
    if (!box) {
      skipped.push(raw || name);
      continue;
    }
    boxes.push({ name, ...box, material: (props.material !== null && materials.get(props.material)) || "proposed" });
  }
  const lines = [`description: drawn in Builder ${date}, plan ${planName}`];
  if (boxes.length) {
    lines.push("add:", "  objects:");
    for (const b of boxes) {
      // east = x, south = -y: the least south corner has the largest y.
      const at = [ftin(b.min[0]), ftin(-b.max[1]), ftin(b.min[2])];
      const size = [ftin(b.max[0] - b.min[0]), ftin(b.max[1] - b.min[1]), ftin(b.max[2] - b.min[2])];
      lines.push(`    ${b.name}: {type: box, at: [${at.join(", ")}], size: [${size.join(", ")}], material: ${b.material}, phase: proposed}`);
    }
  }
  return { yaml: lines.join("\n") + "\n", skipped };
}
