import { describe, expect, it } from "vitest";
import { ROOT } from "../src/kernel/model";
import { dot, rotation, type Mat4, type Vec3 } from "../src/math";
import { PushPullTool } from "../src/tools/pushpull";
import { RectangleTool } from "../src/tools/rectangle";
import { RotateTool } from "../src/tools/rotate";
import { SelectTool } from "../src/tools/select";
import { TestHost } from "./toolhost";

const DEG = Math.PI / 180;

/** A 10' × 8' × 8' box from a rectangle and a pull. */
function box(h: TestHost) {
  const rect = new RectangleTool(h);
  h.click(rect, [0, 0, 0]);
  h.hover(rect, [100, 80, 0]);
  rect.vcb("10', 8'");
  h.refresh();
  const pp = new PushPullTool(h);
  h.click(pp, [60, 48, 0]);
  h.hover(pp, [60, 48, 50]);
  pp.vcb("8'");
  h.refresh();
}

/** A 2 × 10 stringer (1 1/2" × 10' × 9 1/4") drawn flat, grouped and selected. */
function stringer(h: TestHost): number {
  const rect = new RectangleTool(h);
  h.click(rect, [0, 0, 0]);
  h.hover(rect, [50, 5, 0]);
  rect.vcb("10', 9 1/4\"");
  h.refresh();
  const pp = new PushPullTool(h);
  h.click(pp, [60, 4, 0]);
  h.hover(pp, [60, 4, 3]);
  pp.vcb("1 1/2\"");
  h.refresh();
  const faces = [...new Set(h.scene().triFace)];
  const g = h.model.transact("Make Group", () => h.model.makeGroup(ROOT, faces, [...h.scene().segEdge], []));
  h.refresh();
  h.selection.set([{ kind: "instance", id: g }]);
  return g;
}

const transformOf = (h: TestHost, id: number): Mat4 => h.model.instances(ROOT).find((i) => i.id === id)!.transform;
function expectMatrix(actual: Mat4, expected: Mat4) {
  actual.forEach((x, i) => expect(x).toBeCloseTo(expected[i], 6));
}
/** Centre at the origin, start along red. */
function pickUp(h: TestHost, rot: RotateTool) {
  h.click(rot, [0, 0, 0]);
  expect(rot.busy()).toBe(true);
  h.click(rot, [50, 0, 0]);
}

describe("Rotate", () => {
  it("rotates a stringer group by a typed angle about the ground plane, retypes it and undoes as one step", () => {
    const h = new TestHost();
    const g = stringer(h);
    const rot = new RotateTool(h);
    expect(rot.vcbLabel()).toBe("Angle");
    pickUp(h, rot);
    rot.vcb("37");
    expect(rot.busy()).toBe(false);
    expect(h.flashes).toEqual([]);
    expectMatrix(transformOf(h, g), rotation([0, 0, 0], [0, 0, 1], 37 * DEG));
    rot.vcb("30");
    expectMatrix(transformOf(h, g), rotation([0, 0, 0], [0, 0, 1], 30 * DEG));
    expect(h.model.undo()).toBe("Rotate");
    expectMatrix(transformOf(h, g), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect(h.model.undo()).toBe("Make Group");
  });

  it("snaps a sweep over nothing to 15° and takes an endpoint exactly", () => {
    const h = new TestHost();
    const g = stringer(h);
    const rot = new RotateTool(h);
    pickUp(h, rot);
    // Far enough out that no edge of the stringer is within the snap radius.
    const sweep: Vec3 = [150 * Math.cos(22 * DEG), 150 * Math.sin(22 * DEG), 0];
    h.hover(rot, sweep);
    expect(h.inference.last?.kind).toBe("plane");
    expect(h.overlay.dims![0].text).toBe("15°");
    expect(h.vcbText).toBe("15°");
    expect(h.overlay.protractor!.angle).toBeCloseTo(15 * DEG, 9);
    h.click(rot, sweep);
    expect(rot.busy()).toBe(false);
    expectMatrix(transformOf(h, g), rotation([0, 0, 0], [0, 0, 1], 15 * DEG));
    expect(h.model.undo()).toBe("Rotate");
    h.refresh();
    // A loose line whose end sits 22° round from red: the endpoint wins exactly.
    const end: Vec3 = [100 * Math.cos(22 * DEG), 100 * Math.sin(22 * DEG), 0];
    h.model.transact("Line", () => h.model.addLine(ROOT, end, [140, 90, 0]));
    h.refresh();
    h.selection.set([{ kind: "instance", id: g }]);
    pickUp(h, rot);
    h.click(rot, end);
    expect(h.inference.last?.kind).toBe("endpoint");
    expectMatrix(transformOf(h, g), rotation([0, 0, 0], [0, 0, 1], 22 * DEG));
  });

  it("puts the protractor on the hovered face, a hovered edge's camera-facing face, the ground, or the locked axis", () => {
    const h = new TestHost();
    box(h);
    const rot = new RotateTool(h);
    const toCamera = (p: Vec3, n: Vec3) => dot(n, h.camera.ray(h.at(p).x, h.at(p).y).dir) < 0;
    // The front wall (y = 0) faces the camera; its normal is kept.
    h.hover(rot, [60, 0, 48]);
    expect(h.inference.last?.kind).toBe("onFace");
    let n = h.overlay.protractor!.normal;
    expect(n[1]).toBeCloseTo(-1, 6);
    expect(toCamera([60, 0, 48], n)).toBe(true);
    expect(h.overlay.protractor!.center).toEqual(h.inference.last!.point);
    // The front top edge belongs to the front wall and the roof; the wall faces
    // the camera more squarely.
    h.hover(rot, [60, 0, 96]);
    expect(h.inference.last?.kind).toBe("midpoint");
    n = h.overlay.protractor!.normal;
    expect(n[1]).toBeCloseTo(-1, 6);
    // Empty ground.
    h.hover(rot, [-60, -60, 0]);
    expect(h.inference.last?.kind).toBe("ground");
    expect(h.overlay.protractor!.normal).toEqual([0, 0, 1]);
    // An arrow key locks the protractor to that axis wherever the cursor is.
    h.inference.toggleAxisLock(0);
    h.hover(rot, [60, 0, 48]);
    expect(h.overlay.protractor!.normal).toEqual([1, 0, 0]);
    h.inference.unlock();
    // Off the midpoint's blue line, so the from-point cue does not claim the spot.
    h.hover(rot, [70, 0, 40]);
    expect(h.inference.last?.kind).toBe("onFace");
    expect(h.overlay.protractor!.normal[1]).toBeCloseTo(-1, 6);
  });

  it("tilts a box's top about its front edge by a typed angle without folding", () => {
    const h = new TestHost();
    box(h);
    const sel = new SelectTool(h);
    h.click(sel, [60, 48, 96]);
    expect(h.selection.items).toEqual([{ kind: "face", id: expect.any(Number) }]);
    const rot = new RotateTool(h);
    // Red lock: the axis runs along the front top edge.
    h.inference.toggleAxisLock(0);
    h.click(rot, [60, 0, 96]);
    expect(h.overlay.protractor!.normal).toEqual([1, 0, 0]);
    h.click(rot, [60, 48, 96]);
    rot.vcb("10");
    h.refresh();
    expect(h.flashes).toEqual([]);
    expect(rot.busy()).toBe(false);
    expect(h.model.stats().faces).toBe(6);
    expect(h.model.stats().edges).toBe(12);
    expect(h.scene().max[2]).toBeCloseTo(96 + 96 * Math.sin(10 * DEG), 3);
    expect(h.inference.locked).toBe(false);
    expect(h.model.undo()).toBe("Rotate");
  });

  it("cancels with Escape and refuses a locked group", () => {
    const h = new TestHost();
    const g = stringer(h);
    const before = h.model.toJson();
    const rot = new RotateTool(h);
    pickUp(h, rot);
    h.hover(rot, [30, 40, 0]);
    expect(h.model.revision).toBeGreaterThan(0);
    expect(rot.key("Escape")).toBe(true);
    expect(rot.busy()).toBe(false);
    expect(h.model.toJson()).toBe(before);
    expect(h.model.canRedo()).toBe(false);
    rot.vcb("45");
    expect(h.flashes).toEqual(["Rotate something first"]);
    h.model.transact("Lock", () => {
      const tag = h.model.newTag("Existing");
      h.model.setInstanceTag(g, tag);
      h.model.setTagFlags(tag, true, true);
    });
    h.refresh();
    h.selection.set([{ kind: "instance", id: g }]);
    h.click(rot, [0, 0, 0]);
    expect(rot.busy()).toBe(false);
    expect(h.flashes.length).toBe(2);
    expect(h.flashes[1]).toMatch(/locked/i);
  });
});

describe("Rotate-copy and radial arrays", () => {
  /** A 4 × 4 post 36" tall standing at (60, 0), grouped and selected. */
  function post(h: TestHost): number {
    const rect = new RectangleTool(h);
    h.click(rect, [60, 0, 0]);
    h.hover(rect, [70, 5, 0]);
    rect.vcb("3 1/2\", 3 1/2\"");
    h.refresh();
    const pp = new PushPullTool(h);
    h.click(pp, [61.75, 1.75, 0]);
    h.hover(pp, [61.75, 1.75, 10]);
    pp.vcb("36\"");
    h.refresh();
    const faces = [...new Set(h.scene().triFace)];
    const g = h.model.transact("Make Group", () => h.model.makeGroup(ROOT, faces, [...h.scene().segEdge], []));
    h.refresh();
    h.selection.set([{ kind: "instance", id: g }]);
    return g;
  }
  /** Angles of every instance about the origin, from where the post's corner went, sorted. */
  const angles = (h: TestHost) =>
    h.model
      .instances(ROOT)
      .map((i) => Math.round((Math.atan2(i.transform[13] + 60 * i.transform[1], i.transform[12] + 60 * i.transform[0]) * 180) / Math.PI))
      .map((a) => (a < 0 ? a + 360 : a))
      .sort((a, b) => a - b);
  /** Rotate-copy the selection about the origin, from red, by the typed angle. */
  function copyAbout(h: TestHost, rot: RotateTool, angle: string) {
    h.copyClick(rot, [0, 0, 0]);
    h.click(rot, [50, 0, 0]);
    rot.vcb(angle);
    h.refresh();
  }

  it("leaves the original and places a rotated copy, then 5x makes six posts around the centre as one step", () => {
    const h = new TestHost();
    const g = post(h);
    const rot = new RotateTool(h);
    h.copyClick(rot, [0, 0, 0]);
    expect(rot.cursor).toBe("copy");
    h.click(rot, [50, 0, 0]);
    expect(rot.hint()).toContain("6x");
    rot.vcb("60");
    h.refresh();
    expect(h.flashes).toEqual([]);
    const insts = h.model.instances(ROOT);
    expect(insts.length).toBe(2);
    expectMatrix(transformOf(h, g), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const copy = insts.find((i) => i.id !== g)!;
    expectMatrix(copy.transform, rotation([0, 0, 0], [0, 0, 1], 60 * DEG));
    expect(h.selection.ids("instance")).toEqual([copy.id]);
    rot.vcb("5x");
    expect(h.flashes).toEqual([]);
    expect(angles(h)).toEqual([0, 60, 120, 180, 240, 300]);
    expect(h.selection.ids("instance").length).toBe(5);
    expect(h.model.undo()).toBe("Copy");
    expect(h.model.instances(ROOT).length).toBe(1);
    expect(h.model.undo()).toBe("Make Group");
  });

  it("spreads six copies evenly with /6 after a half-turn copy, and retypes the count", () => {
    const h = new TestHost();
    post(h);
    const rot = new RotateTool(h);
    copyAbout(h, rot, "180");
    expect(angles(h)).toEqual([0, 180]);
    rot.vcb("/6");
    expect(h.flashes).toEqual([]);
    expect(angles(h)).toEqual([0, 30, 60, 90, 120, 150, 180]);
    rot.vcb("/3");
    expect(angles(h)).toEqual([0, 60, 120, 180]);
    expect(h.model.undo()).toBe("Copy");
    expect(h.model.instances(ROOT).length).toBe(1);
  });

  it("refuses an array after a plain rotation or once the model changed", () => {
    const h = new TestHost();
    post(h);
    const rot = new RotateTool(h);
    pickUp(h, rot);
    rot.vcb("45");
    expect(h.model.instances(ROOT).length).toBe(1);
    rot.vcb("6x");
    expect(h.flashes).toEqual(["Copy something first"]);
    expect(h.model.instances(ROOT).length).toBe(1);
    h.selection.set([{ kind: "instance", id: h.model.instances(ROOT)[0].id }]);
    copyAbout(h, rot, "90");
    expect(h.model.instances(ROOT).length).toBe(2);
    expect(h.model.undo()).toBe("Copy");
    rot.vcb("3x");
    expect(h.flashes).toEqual(["Copy something first", "Copy something first"]);
    expect(h.model.instances(ROOT).length).toBe(1);
  });

  it("switches to a copy when the copy key is tapped mid-rotate, and retypes the copy's angle", () => {
    const h = new TestHost();
    const g = post(h);
    const rot = new RotateTool(h);
    h.click(rot, [0, 0, 0]);
    expect(rot.cursor).toBe("crosshair");
    rot.modifier();
    expect(rot.cursor).toBe("copy");
    rot.modifier();
    expect(rot.cursor).toBe("crosshair");
    rot.modifier();
    h.click(rot, [50, 0, 0]);
    rot.vcb("90");
    h.refresh();
    expect(h.flashes).toEqual([]);
    expect(h.model.instances(ROOT).length).toBe(2);
    expect(rot.cursor).toBe("crosshair");
    expectMatrix(transformOf(h, g), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    // Retyping the angle moves the copy, not the original.
    rot.vcb("120");
    expect(h.flashes).toEqual([]);
    expect(h.model.instances(ROOT).length).toBe(2);
    expect(angles(h)).toEqual([0, 120]);
  });

  it("rotates a copy when the copy key is tapped before the centre is picked, then the original next time", () => {
    const h = new TestHost();
    const g = post(h);
    const rot = new RotateTool(h);
    rot.modifier();
    expect(rot.cursor).toBe("copy");
    expect(rot.hint()).toMatch(/Copy is on/);
    pickUp(h, rot);
    expect(rot.cursor).toBe("copy");
    rot.vcb("60");
    h.refresh();
    expect(h.model.instances(ROOT).length).toBe(2);
    expectMatrix(transformOf(h, g), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect(rot.cursor).toBe("crosshair");
    h.selection.set([{ kind: "instance", id: g }]);
    pickUp(h, rot);
    rot.vcb("45");
    expect(h.model.instances(ROOT).length).toBe(2);
    expectMatrix(transformOf(h, g), rotation([0, 0, 0], [0, 0, 1], 45 * DEG));
  });

  it("welds a loose face rotate-copied about a shared edge", () => {
    const h = new TestHost();
    box(h);
    const sel = new SelectTool(h);
    h.click(sel, [60, 48, 96]);
    expect(h.selection.items).toEqual([{ kind: "face", id: expect.any(Number) }]);
    const rot = new RotateTool(h);
    // Red lock: the top face turns about its front top edge, down the front wall.
    h.inference.toggleAxisLock(0);
    const ptr = h.at([60, 0, 96], { copy: true });
    rot.move(ptr);
    rot.down(ptr);
    rot.up(ptr, false);
    expect(rot.cursor).toBe("copy");
    h.click(rot, [60, 48, 96]);
    rot.vcb("-90");
    h.refresh();
    expect(h.flashes).toEqual([]);
    // The copy lands on the front wall, facing the other way: the two cancel and
    // leave an opening, so the box has five faces.
    expect(h.model.stats().faces).toBe(5);
    expect(h.model.undo()).toBe("Copy");
    h.refresh();
    expect(h.model.stats().faces).toBe(6);
  });
});
