import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ROOT, type Model } from "../src/kernel/model";
import { exportProposed, ftin } from "../src/survey/plan-export";
import { newModel } from "./helpers";

const FIXTURE = fileURLToPath(new URL("../../survey/tests/fixtures/plan_export.yaml", import.meta.url));

/** Faces whose vertices all lie inside [x0, x1] × [y0, y1]. */
function facesIn(m: Model, x0: number, y0: number, x1: number, y1: number): number[] {
  const e = 1e-6;
  return [...new Set(m.buffers(ROOT).faceIds)].filter((f) =>
    m.faceOuter(f).every((v) => v[0] >= x0 - e && v[0] <= x1 + e && v[1] >= y0 - e && v[1] <= y1 + e),
  );
}

/** Draw a rectangle on the ground, pull it up, group it. Returns the instance. */
function box(m: Model, x0: number, y0: number, w: number, l: number, h: number): number {
  const x1 = x0 + w;
  const y1 = y0 + l;
  m.addLine(ROOT, [x0, y0, 0], [x1, y0, 0]);
  m.addLine(ROOT, [x1, y0, 0], [x1, y1, 0]);
  m.addLine(ROOT, [x1, y1, 0], [x0, y1, 0]);
  m.addLine(ROOT, [x0, y1, 0], [x0, y0, 0]);
  m.pushPull(facesIn(m, x0, y0, x1, y1)[0], -h);
  return m.makeGroup(ROOT, facesIn(m, x0, y0, x1, y1), [], []);
}

function surveyModel(): { m: Model; proposed: number } {
  const m = newModel();
  m.newTag("Existing");
  m.newTag("Demo");
  const proposed = m.newTag("Proposed");
  return { m, proposed };
}

describe("ftin", () => {
  it("writes lengths the survey spec reads", () => {
    expect(ftin(288)).toBe("24'");
    expect(ftin(30)).toBe("2'6\"");
    expect(ftin(0)).toBe("0\"");
    expect(ftin(6.5)).toBe("6.5\"");
    expect(ftin(12.0001)).toBe("1'0.0001\"");
    expect(ftin(-30)).toBe("-2'6\"");
    expect(ftin(-24)).toBe("-2'");
  });
});

describe("exportProposed", () => {
  it("writes one entry for a box and skips a rotated box and a non-box", () => {
    const { m, proposed } = surveyModel();
    // The vanity: 30" x 21" x 34" with its least-east, least-south corner at 24' east, 30' south.
    const vanity = box(m, 288, -381, 30, 21, 34);
    m.setInstanceTag(vanity, proposed);
    m.setAttribute("instance", vanity, "survey", "kind", "object");
    const file = JSON.parse(m.toJson());
    file.instances.find((i: { definition: number }) => i.definition === m.instanceInfo(vanity)!.definition).name = "Vanity";
    const m2 = (m.constructor as typeof Model).fromJson(JSON.stringify(file));

    const rotated = box(m2, 500, 0, 10, 10, 10);
    m2.setInstanceTag(rotated, proposed);
    const c = Math.cos(Math.PI / 6);
    const s = Math.sin(Math.PI / 6);
    m2.setTransform(rotated, [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    // A wedge: a triangle pulled up.
    m2.addLine(ROOT, [700, 0, 0], [720, 0, 0]);
    m2.addLine(ROOT, [720, 0, 0], [700, 20, 0]);
    m2.addLine(ROOT, [700, 20, 0], [700, 0, 0]);
    m2.pushPull(facesIn(m2, 700, 0, 720, 20)[0], -10);
    const wedge = m2.makeGroup(ROOT, facesIn(m2, 700, 0, 720, 20), [], []);
    m2.setInstanceTag(wedge, proposed);

    // A box on another tag is not exported at all.
    const existing = box(m2, 900, 0, 10, 10, 10);
    m2.setInstanceTag(existing, 0);

    const { yaml, skipped } = exportProposed(m2, "vanity", "2026-10-27");
    expect(yaml).toBe(readFileSync(FIXTURE, "utf8"));
    expect(skipped).toEqual([`Group#${m2.instanceInfo(rotated)!.definition}`, `Group#${m2.instanceInfo(wedge)!.definition}`]);
  });

  it("names unnamed groups proposed_N and uses the instance material", () => {
    const { m, proposed } = surveyModel();
    const g = box(m, 0, 0, 12, 24, 36);
    m.setInstanceTag(g, proposed);
    const file = JSON.parse(m.toJson());
    file.materials = [{ name: "wood", color: [200, 160, 110], opacity: 1 }];
    file.instances[0].material = 0;
    const m2 = (m.constructor as typeof Model).fromJson(JSON.stringify(file));
    const { yaml, skipped } = exportProposed(m2, "shelf", "2026-10-27");
    expect(skipped).toEqual([]);
    expect(yaml).toBe(
      `description: drawn in Builder 2026-10-27, plan shelf\nadd:\n  objects:\n    proposed_1: {type: box, at: [0", -2', 0"], size: [1', 2', 3'], material: wood, phase: proposed}\n`,
    );
  });

  it("refuses a model without the survey tags", () => {
    expect(() => exportProposed(newModel(), "x")).toThrow(/survey model/);
  });
});
