import { beforeEach, describe, expect, it } from "vitest";
import { InferenceEngine } from "../src/inference/engine";
import { ROOT, type Model } from "../src/kernel/model";
import type { Vec3 } from "../src/math";
import { CameraModel } from "../src/view/camera";
import { SceneIndex } from "../src/view/scene";
import { newModel } from "./helpers";

let model: Model;
let cam: CameraModel;
let scene: SceneIndex;
let engine: InferenceEngine;

function rect(m: Model, x0: number, y0: number, x1: number, y1: number, z = 0) {
  const p: Vec3[] = [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
  m.transact("Rectangle", () => p.forEach((a, i) => m.addLine(ROOT, a, p[(i + 1) % 4])));
}

const at = (p: Vec3) => cam.project(p)!;

beforeEach(() => {
  model = newModel();
  rect(model, 0, 0, 120, 96);
  const face = model.facePlane(0) ? 0 : -1;
  expect(face).toBe(0);
  model.transact("Push/Pull", () => model.pushPull(0, -96));
  cam = new CameraModel();
  cam.target = [60, 48, 48];
  cam.dist = 600;
  scene = SceneIndex.build(model, ROOT);
  engine = new InferenceEngine(() => scene, cam);
});

describe("inference", () => {
  it("snaps to an endpoint near the cursor", () => {
    const s = at([120, 0, 96]);
    const r = engine.infer(s.x + 4, s.y - 3)!;
    expect(r.kind).toBe("endpoint");
    expect(r.point).toEqual([120, 0, 96]);
    expect(r.label).toBe("Endpoint");
  });

  it("prefers an endpoint over a midpoint at the same distance", () => {
    const s = at([0, 0, 96]);
    expect(engine.infer(s.x, s.y)!.kind).toBe("endpoint");
  });

  it("snaps to midpoints", () => {
    const s = at([60, 0, 96]);
    const r = engine.infer(s.x + 2, s.y)!;
    expect(r.kind).toBe("midpoint");
    r.point.forEach((x, i) => expect(x).toBeCloseTo([60, 0, 96][i], 4));
  });

  it("finds points on faces and edges", () => {
    const f = at([30, 0, 40]);
    const onFace = engine.infer(f.x, f.y)!;
    expect(onFace.kind).toBe("onFace");
    expect(onFace.point[1]).toBeCloseTo(0, 6);
    const e = at([30, 0, 96]);
    const onEdge = engine.infer(e.x, e.y + 2)!;
    expect(onEdge.kind).toBe("onEdge");
    expect(onEdge.point[2]).toBeCloseTo(96, 4);
  });

  it("falls back to the ground plane", () => {
    const g = at([300, -200, 0]);
    const r = engine.infer(g.x, g.y)!;
    expect(r.kind).toBe("ground");
    expect(r.point[0]).toBeCloseTo(300, 4);
  });

  it("infers along an axis from the anchor", () => {
    const anchor: Vec3 = [200, -100, 0];
    const s = at([260, -100, 0]);
    const r = engine.infer(s.x, s.y + 3, { anchor })!;
    expect(r.kind).toBe("axis");
    expect(r.axis).toBe(0);
    expect(r.label).toBe("On Red Axis");
    expect(r.point[1]).toBeCloseTo(-100, 6);
  });

  it("locks to the blue axis with the arrow key and matches a point's height", () => {
    const anchor: Vec3 = [200, -100, 0];
    engine.toggleAxisLock(2);
    const s = at([120, 0, 96]);
    const r = engine.infer(s.x, s.y, { anchor })!;
    expect(r.locked).toBe(true);
    expect(r.point[0]).toBeCloseTo(200, 6);
    expect(r.point[2]).toBeCloseTo(96, 6);
    engine.toggleAxisLock(2);
    expect(engine.locked).toBe(false);
  });

  it("locks the current axis inference with Shift", () => {
    const anchor: Vec3 = [200, -100, 0];
    const s = at([260, -100, 0]);
    engine.infer(s.x, s.y, { anchor });
    expect(engine.lockCurrent()).toBe(true);
    const far = at([300, 0, 50]);
    const r = engine.infer(far.x, far.y, { anchor })!;
    expect(r.point[1]).toBeCloseTo(-100, 6);
    expect(r.point[2]).toBeCloseTo(0, 6);
  });

  it("keeps results on a line for push/pull", () => {
    const line = { origin: [60, 0, 48] as Vec3, dir: [0, -1, 0] as Vec3 };
    const s = at([60, -30, 48]);
    const r = engine.infer(s.x, s.y, { line })!;
    expect(r.point[1]).toBeCloseTo(-30, 3);
    expect(r.point[0]).toBeCloseTo(60, 6);
  });

  it("does not snap to hidden endpoints", () => {
    // The far bottom corner is behind the box from this camera.
    const hidden: Vec3 = [120, 96, 0];
    const s = at(hidden);
    const r = engine.infer(s.x, s.y);
    expect(r?.kind === "endpoint" && r.point.every((v, i) => v === hidden[i])).toBe(false);
  });
});

describe("scene index", () => {
  it("flattens triangles and edges in world space", () => {
    expect(scene.triFace.length).toBe(12);
    expect(scene.segEdge.length).toBe(12);
    expect(scene.max).toEqual([120, 96, 96]);
  });

  it("picks the nearest face", () => {
    const s = at([60, 0, 48]);
    const hit = scene.pick(cam.ray(s.x, s.y))!;
    expect(hit.point[1]).toBeCloseTo(0, 6);
    expect(hit.normal[1]).toBeCloseTo(-1, 6);
  });

  it("places groups through their transforms and picks them as instances", () => {
    const faces = [...new Set(scene.triFace)];
    const edges = [...scene.segEdge];
    const g = model.transact("Make Group", () => model.makeGroup(ROOT, faces, edges, []));
    model.transact("Move", () => model.setTransform(g, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 10, 1]));
    scene = SceneIndex.build(model, ROOT);
    expect(scene.max[2]).toBe(106);
    const s = at([60, 0, 58]);
    const hit = scene.pick(cam.ray(s.x, s.y))!;
    expect(scene.items[hit.item].pickInstance).toBe(g);
    expect(scene.items[hit.item].editable).toBe(false);
    const inside = SceneIndex.build(model, model.instanceInfo(g)!.definition);
    expect(inside.items[inside.editableItem()].def).toBe(model.instanceInfo(g)!.definition);
  });
});
