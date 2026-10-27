import { describe, expect, it } from "vitest";
import { Model, ROOT } from "../src/kernel/model";
import { SceneIndex } from "../src/view/scene";
import { newModel } from "./helpers";

/** A 10" box grouped into its own instance. */
function box(m: Model, x: number): number {
  m.addLine(ROOT, [x, 0, 0], [x + 10, 0, 0]);
  m.addLine(ROOT, [x + 10, 0, 0], [x + 10, 10, 0]);
  m.addLine(ROOT, [x + 10, 10, 0], [x, 10, 0]);
  m.addLine(ROOT, [x, 10, 0], [x, 0, 0]);
  const faces = [...new Set(m.buffers(ROOT).faceIds)].filter((f) => {
    const p = m.facePlane(f)!;
    return m.faceOuter(f).every((v) => v[0] >= x - 1e-6 && v[0] <= x + 10 + 1e-6) && Math.abs(p.d) < 1e-6;
  });
  m.pushPull(faces[0], -10);
  const own = [...new Set(m.buffers(ROOT).faceIds)].filter((f) => m.faceOuter(f).every((v) => v[0] >= x - 1e-6 && v[0] <= x + 10 + 1e-6));
  return m.makeGroup(ROOT, own, [], []);
}

function survey(): { m: Model; a: number; b: number; existing: number; proposed: number } {
  const m = newModel();
  const a = box(m, 0);
  const b = box(m, 50);
  const existing = m.newTag("Existing");
  const proposed = m.newTag("Proposed");
  m.setInstanceTag(a, existing);
  m.setInstanceTag(b, proposed);
  m.commit();
  return { m, a, b, existing, proposed };
}

describe("SceneIndex tags", () => {
  it("drops items on a hidden tag, and everything inside them", () => {
    const { m, a, existing } = survey();
    expect(SceneIndex.build(m, ROOT).items.map((it) => it.path[0])).toEqual([undefined, a, expect.any(Number)]);
    m.setTagFlags(existing, false, false);
    const s = SceneIndex.build(m, ROOT);
    expect(s.items.map((it) => it.path[0])).toEqual([undefined, expect.any(Number)]);
    expect(s.items.some((it) => it.path[0] === a)).toBe(false);
    expect(s.triFace.length).toBe(12);
  });

  it("carries the tag and the lock onto draw items", () => {
    const { m, a, b, existing, proposed } = survey();
    m.setTagFlags(existing, true, true);
    const s = SceneIndex.build(m, ROOT);
    const ia = s.items.find((it) => it.path[0] === a)!;
    const ib = s.items.find((it) => it.path[0] === b)!;
    expect(ia.tag).toBe(existing);
    expect(ia.locked).toBe(true);
    expect(ib.tag).toBe(proposed);
    expect(ib.locked).toBe(false);
    expect(s.items[0].locked).toBe(false);
  });

  it("locks the contents of a locked group", () => {
    const { m, a, existing } = survey();
    const outer = m.makeGroup(ROOT, [], [], [a]);
    m.setInstanceTag(a, null);
    m.setInstanceTag(outer, existing);
    m.setTagFlags(existing, true, true);
    const s = SceneIndex.build(m, ROOT);
    const inner = s.items.find((it) => it.path.length === 2)!;
    expect(inner.path[0]).toBe(outer);
    expect(inner.locked).toBe(true);
    expect(m.instanceProps(a)!.locked).toBe(true);
  });
});

describe("SceneIndex colours", () => {
  it("resolve face material before instance material before theme", () => {
    const m = newModel();
    const g = box(m, 0);
    const def = m.instanceInfo(g)!.definition;
    const s0 = SceneIndex.build(m, ROOT);
    const item = s0.items.findIndex((it) => it.def === def);
    expect(s0.triColor(item, 0)).toBeNull();

    // The instance gets a material through the file: the kernel has no instance-material call yet.
    const file = JSON.parse(m.toJson());
    file.materials = [
      { name: "Block", color: [190, 190, 185], opacity: 1 },
      { name: "Glass", color: [200, 225, 235], opacity: 0.4 },
    ];
    file.instances[0].material = 0;
    file.definitions[1].faces[0].material = 1;
    const m2 = Model.fromJson(JSON.stringify(file));
    const s = SceneIndex.build(m2, ROOT);
    const it = s.items.findIndex((x) => x.def === 1);
    expect(s.items[it].material).toBe(0);
    const colours = new Set<string>();
    for (let t = 0; t < 12; t++) colours.add(JSON.stringify(s.triColor(it, t)));
    expect(colours).toEqual(
      new Set([JSON.stringify([190 / 255, 190 / 255, 185 / 255, 1]), JSON.stringify([200 / 255, 225 / 255, 235 / 255, 0.4])]),
    );
    const glass = [...Array(12).keys()].filter((t) => s.triColor(it, t)![3] === 0.4);
    expect(glass.length).toBe(2);
    expect(s.materials.get(1)!.name).toBe("Glass");
  });
});

describe("Model attributes", () => {
  it("round-trip through the wasm boundary and bump the revision", () => {
    const m = newModel();
    const g = box(m, 0);
    const def = m.instanceInfo(g)!.definition;
    const r = m.revision;
    m.setAttribute("definition", def, "survey", "kind", "wall");
    m.setAttribute("definition", def, "survey", "approx", true);
    m.setAttribute("instance", g, "x-plugin", "n", 4.5);
    expect(m.revision).toBe(r + 3);
    expect(m.attributes("definition", def)).toEqual({ survey: { kind: "wall", approx: true } });
    expect(m.attributes("instance", g)).toEqual({ "x-plugin": { n: 4.5 } });
    m.setAttribute("definition", def, "survey", "approx", null);
    expect(m.attributes("definition", def)).toEqual({ survey: { kind: "wall" } });
    expect(() => m.setAttribute("definition", def, "Survey", "k", 1)).toThrow(/namespace/);
    expect(() => m.attributes("face", 9999)).toThrow(/no longer exists/);
    expect(m.definitionName(def)).toMatch(/^Group#/);
    expect(m.tags()).toEqual([]);
    const t = m.newTag("Existing");
    expect(m.tags()).toEqual([{ id: t, name: "Existing", visible: true, locked: false }]);
    m.setInstanceTag(g, t);
    m.setTagFlags(t, true, true);
    expect(m.instanceProps(g)).toEqual({ name: "", tag: t, material: null, locked: true });
    expect(m.isLockedDef(def)).toBe(true);
    expect(() => m.setTransform(g, m.worldTransform(def))).toThrow(/locked/);
  });
});
