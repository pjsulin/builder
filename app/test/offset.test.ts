import { describe, expect, it } from "vitest";
import { ROOT } from "../src/kernel/model";
import { LineTool } from "../src/tools/line";
import { OffsetTool } from "../src/tools/offset";
import { PushPullTool } from "../src/tools/pushpull";
import { RectangleTool } from "../src/tools/rectangle";
import { TestHost } from "./toolhost";

/** A 10' × 8' × 8' box from a rectangle and a pull: the shed's walls. */
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

/** Areas of the faces on the front wall plane (y = 0, facing out), smallest first. */
function frontWallAreas(h: TestHost): number[] {
  return [...new Set(h.model.buffers(ROOT).faceIds)]
    .map((f) => h.model.facePlane(f)!)
    .filter((p) => p.normal[1] < -0.99 && Math.abs(p.d) < 1e-6)
    .map((p) => p.area)
    .sort((a, b) => a - b);
}

/** Pick up the front wall near its bottom edge and move the cursor up into it. */
function pickUpFrontWall(h: TestHost, off: OffsetTool) {
  h.hover(off, [60, 0, 48]);
  expect(h.overlay.hover).toBeTruthy();
  h.click(off, [60, 0, 2]);
  expect(off.busy()).toBe(true);
  h.hover(off, [60, 0, 10]);
}

describe("Offset", () => {
  it("thickens the front wall inward by a typed distance, retypes it and undoes as one step", () => {
    const h = new TestHost();
    box(h);
    const off = new OffsetTool(h);
    expect(off.vcbLabel()).toBe("Distance");
    pickUpFrontWall(h, off);
    expect(h.vcbText).toBe('8"');
    off.vcb('4"');
    expect(off.busy()).toBe(false);
    expect(h.flashes).toEqual([]);
    expect(h.model.stats().faces).toBe(7);
    let areas = frontWallAreas(h);
    expect(areas.length).toBe(2);
    expect(areas[1]).toBeCloseTo(112 * 88, 6);
    expect(areas[0]).toBeCloseTo(120 * 96 - 112 * 88, 6);
    off.vcb('6"');
    expect(h.flashes).toEqual([]);
    areas = frontWallAreas(h);
    expect(areas[1]).toBeCloseTo(108 * 84, 6);
    expect(h.model.stats().faces).toBe(7);
    expect(h.model.undo()).toBe("Offset");
    expect(h.model.stats().faces).toBe(6);
    expect(h.model.undo()).toBe("Push/Pull");
  });

  it("pushes the ring the offset made, giving the wall a reveal", () => {
    const h = new TestHost();
    box(h);
    const off = new OffsetTool(h);
    pickUpFrontWall(h, off);
    off.vcb('4"');
    h.refresh();
    const before = h.model.stats().faces;
    const pp = new PushPullTool(h);
    h.click(pp, [60, 0, 2]);
    expect(pp.busy()).toBe(true);
    h.hover(pp, [60, 3, 2]);
    pp.vcb('4"');
    h.refresh();
    expect(h.flashes).toEqual([]);
    expect(h.model.stats().faces).toBeGreaterThan(before);
    expect(h.model.undo()).toBe("Push/Pull");
    expect(h.model.undo()).toBe("Offset");
  });

  it("offsets a window outline outward for trim, and a minus flips the direction", () => {
    const h = new TestHost();
    box(h);
    const rect = new RectangleTool(h);
    h.click(rect, [40, 0, 30]);
    expect(h.inference.last?.kind).toBe("onFace");
    h.hover(rect, [70, 0, 50]);
    rect.vcb("3', 2'");
    h.refresh();
    expect(h.model.stats().faces).toBe(7);
    const window = frontWallAreas(h)[0];
    expect(window).toBeCloseTo(36 * 24, 6);
    const off = new OffsetTool(h);
    // Pick the window up near its bottom edge and move down, out of it.
    h.click(off, [58, 0, 31]);
    h.hover(off, [58, 0, 25]);
    off.vcb('3"');
    h.refresh();
    expect(h.flashes).toEqual([]);
    expect(h.model.stats().faces).toBe(8);
    let areas = frontWallAreas(h);
    expect(areas[0]).toBeCloseTo(42 * 30 - 36 * 24, 6);
    expect(areas[1]).toBeCloseTo(36 * 24, 6);
    expect(h.model.undo()).toBe("Offset");
    h.refresh();
    // Moving inward but typing a minus goes outward.
    h.click(off, [58, 0, 31]);
    h.hover(off, [58, 0, 40]);
    off.vcb('-3"');
    h.refresh();
    expect(h.flashes).toEqual([]);
    areas = frontWallAreas(h);
    expect(areas[0]).toBeCloseTo(42 * 30 - 36 * 24, 6);
    expect(h.model.undo()).toBe("Offset");
  });

  it("offsets two selected edges forming an L and adds no face", () => {
    const h = new TestHost();
    const line = new LineTool(h);
    h.click(line, [0, 0, 0]);
    h.click(line, [50, 0, 0]);
    h.click(line, [50, 40, 0]);
    line.key!("Escape");
    h.refresh();
    expect(h.model.stats().edges).toBe(2);
    h.selection.set([...h.scene().segEdge].map((id) => ({ kind: "edge" as const, id })));
    const off = new OffsetTool(h);
    h.hover(off, [20, 20, 0]);
    expect(h.overlay.segments!.length).toBe(4);
    h.click(off, [20, 10, 0]);
    expect(off.busy()).toBe(true);
    // Left of the first edge (toward +Y) is the inside of the L.
    h.hover(off, [20, 20, 0]);
    off.vcb('2"');
    h.refresh();
    expect(h.flashes).toEqual([]);
    expect(h.model.stats().edges).toBe(4);
    expect(h.model.stats().faces).toBe(0);
    const xs = [...h.scene().segEdge].map((e) => h.model.edgeInfo(e)!).map((e) => [e.a, e.b]).flat();
    expect(xs.some((p) => Math.abs(p[0] - 48) < 1e-6 && Math.abs(p[1] - 2) < 1e-6)).toBe(true);
    expect(h.model.undo()).toBe("Offset");
    expect(h.model.stats().edges).toBe(2);
  });

  it("refuses an L-shaped face offset past its notch, with one flash, and leaves the model unchanged", () => {
    const h = new TestHost();
    const line = new LineTool(h);
    // A 10' L with 5' arms on the ground.
    for (const p of [[60, 0, 0], [120, 0, 0], [120, 120, 0], [0, 120, 0], [0, 60, 0], [60, 60, 0], [60, 0, 0]] as const) {
      h.click(line, [p[0], p[1], p[2]]);
    }
    h.refresh();
    expect(h.model.stats().faces).toBe(1);
    const before = h.model.toJson();
    const off = new OffsetTool(h);
    // Off the bottom edge's midpoint, which would snap the cursor back onto the edge.
    h.click(off, [100, 2, 0]);
    expect(off.busy()).toBe(true);
    h.hover(off, [100, 20, 0]);
    expect(h.flashes).toEqual([]);
    off.vcb("3'");
    expect(off.busy()).toBe(true);
    expect(h.flashes).toEqual(["That offset would cross itself"]);
    h.hover(off, [100, 40, 0]);
    expect(h.flashes.length).toBe(1);
    expect(off.key("Escape")).toBe(true);
    expect(h.model.toJson()).toBe(before);
    expect(h.model.canRedo()).toBe(false);
    // Within the arms it works.
    h.click(off, [100, 2, 0]);
    h.hover(off, [100, 20, 0]);
    off.vcb("1'");
    expect(h.flashes.length).toBe(1);
    expect(h.model.stats().faces).toBe(2);
    off.vcb("5'");
    expect(h.flashes.length).toBe(2);
    expect(h.model.stats().faces).toBe(2);
  });

  it("cancels with Escape and refuses a locked context", () => {
    const h = new TestHost();
    box(h);
    const before = h.model.toJson();
    const off = new OffsetTool(h);
    pickUpFrontWall(h, off);
    expect(h.model.revision).toBeGreaterThan(0);
    off.key("Escape");
    expect(off.busy()).toBe(false);
    expect(h.model.toJson()).toBe(before);
    off.vcb('4"');
    expect(h.flashes).toEqual(["Offset a face or a chain of edges first"]);
  });
});
