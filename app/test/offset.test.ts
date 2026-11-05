import { describe, expect, it } from "vitest";
import { ROOT } from "../src/kernel/model";
import { LineTool } from "../src/tools/line";
import { MoveTool } from "../src/tools/move";
import { OffsetTool } from "../src/tools/offset";
import { PushPullTool } from "../src/tools/pushpull";
import { RectangleTool } from "../src/tools/rectangle";
import { RotateTool } from "../src/tools/rotate";
import { TapeMeasureTool } from "../src/tools/measure";
import { TestHost } from "./toolhost";
import type { Vec3 } from "../src/math";

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

/**
 * docs/walkthrough-deck.md run headlessly, step by step, asserting the counts its
 * Results table states. Window selections in the browser are `selection.set`
 * calls here; everything else goes through the tools.
 */
describe("Deck walkthrough", () => {
  it("builds the frame, posts, joists, stair stringer and railing with the counts the walkthrough states", () => {
    const h = new TestHost();
    h.camera.target = [72, 60, 30];
    h.camera.dist = 900;
    const rect = new RectangleTool(h);
    const pp = new PushPullTool(h);
    const off = new OffsetTool(h);
    const mv = new MoveTool(h);
    const rot = new RotateTool(h);
    const stats = () => ({ faces: h.model.stats().faces, groups: h.model.stats().instances });
    /** The loose faces and edges whose points all pass `where`: a window selection. */
    const loose = (where: (p: Vec3) => boolean) => {
      const s = h.scene();
      const faces = [...new Set([...s.triFace].filter((_, i) => s.items[s.triItem[i]].editable))].filter((f) => h.model.faceOuter(f).every(where));
      const edges = [...new Set([...s.segEdge].filter((_, i) => s.items[s.segItem[i]].editable))].filter((e) => {
        const i = h.model.edgeInfo(e)!;
        return where(i.a) && where(i.b);
      });
      return { faces, edges };
    };
    /** Group a window selection of loose geometry and select the group. */
    const group = (where: (p: Vec3) => boolean = () => true) => {
      const { faces, edges } = loose(where);
      const g = h.model.transact("Make Group", () => h.model.makeGroup(ROOT, faces, edges, []));
      h.refresh();
      h.selection.set([{ kind: "instance", id: g }]);
      return g;
    };
    const copyAlong = (axis: 0 | 1 | 2, from: Vec3, to: Vec3, distance: string) => {
      h.copyClick(mv, from);
      h.inference.toggleAxisLock(axis);
      h.hover(mv, to);
      mv.vcb(distance);
      h.refresh();
    };
    const moveAlong = (axis: 0 | 1 | 2, from: Vec3, to: Vec3, distance: string) => {
      h.click(mv, from);
      h.inference.toggleAxisLock(axis);
      h.hover(mv, to);
      mv.vcb(distance);
      h.refresh();
    };

    // 2-3. The rim: a 12' x 10' rectangle pulled up 9 1/4".
    h.click(rect, [0, 0, 0]);
    h.hover(rect, [50, 40, 0]);
    rect.vcb("12', 10'");
    h.refresh();
    expect(stats()).toEqual({ faces: 1, groups: 0 });
    h.click(pp, [72, 60, 0]);
    h.hover(pp, [72, 60, 5]);
    pp.vcb('9 1/4"');
    h.refresh();
    expect(stats()).toEqual({ faces: 6, groups: 0 });
    // 4. Offset the top inward 1 1/2": a ring and an inner face.
    h.click(off, [72, 2, 9.25]);
    h.hover(off, [72, 20, 9.25]);
    off.vcb('1 1/2"');
    h.refresh();
    expect(stats()).toEqual({ faces: 7, groups: 0 });
    // 5. Push the inner face down through: a hollow rim.
    h.click(pp, [72, 60, 9.25]);
    h.hover(pp, [72, 60, 5]);
    pp.vcb('9 1/4"');
    h.refresh();
    expect(stats()).toEqual({ faces: 10, groups: 0 });
    // 6. Group the frame.
    const frame = group();
    expect(stats()).toEqual({ faces: 10, groups: 1 });
    // 7. Lay out a mid-span post: guide lines 4' in from the front and left rim
    // edges, dragged across the ground, with the frame still on it.
    h.selection.clear();
    const tape = new TapeMeasureTool(h);
    h.click(tape, [72, 0, 0]);
    expect(h.inference.last?.kind).toBe("midpoint");
    h.hover(tape, [72, 48, 0]);
    expect(h.inference.last?.label).toBe("From Point");
    tape.vcb("4'");
    h.click(tape, [0, 60, 0]);
    expect(h.inference.last?.kind).toBe("midpoint");
    h.hover(tape, [48, 60, 0]);
    tape.vcb("4'");
    h.refresh();
    expect(h.flashes).toEqual([]);
    // A line's origin is wherever its edge started; compare the line itself.
    const layout = h.model.guides(ROOT).map((g) => ({ kind: g.kind, dir: g.dir.map((v) => +v.toFixed(6)), across: g.origin.map((v, i) => (g.dir[i] ? 0 : +v.toFixed(6))) }));
    expect(layout).toEqual([
      { kind: "line", dir: [1, 0, 0], across: [0, 48, 0] },
      { kind: "line", dir: [0, 1, 0], across: [48, 0, 0] },
    ]);
    // 8. Raise the frame 3'; the guides are the model's, not the group's, and stay.
    h.selection.set([{ kind: "instance", id: frame }]);
    moveAlong(2, [0, 0, 0], [0, 0, 20], "3'");
    expect(h.model.instances(ROOT).find((i) => i.id === frame)!.transform.slice(12, 15)).toEqual([0, 0, 36]);
    expect(h.model.guides(ROOT).length).toBe(2);
    // 9. The mid-span post: a 4 x 4 drawn from the guides' intersection by snapping alone.
    h.selection.clear();
    h.hover(rect, [48.4, 47.6, 0]);
    expect(h.inference.last?.kind).toBe("intersection");
    h.click(rect, [48.4, 47.6, 0]);
    h.hover(rect, [55, 55, 0]);
    rect.vcb('3 1/2", 3 1/2"');
    h.refresh();
    const footprint = [...new Set(h.scene().triFace)].find((f) => Math.abs(h.model.facePlane(f)!.area - 3.5 * 3.5) < 1e-6)!;
    const corner = h.model.faceOuter(footprint).map((p) => p.map((v) => +v.toFixed(9)).join(","));
    expect(corner).toContain("48,48,0");
    expect(corner).toContain("51.5,51.5,0");
    h.click(pp, [49.75, 49.75, 0]);
    h.hover(pp, [49.75, 49.75, 5]);
    pp.vcb("3'");
    h.refresh();
    group((p) => p[0] >= 47.9 && p[0] <= 51.6 && p[1] >= 47.9 && p[1] <= 51.6);
    expect(stats()).toEqual({ faces: 16, groups: 2 });
    // 10. A 4 x 4 corner post, 3' tall, grouped.
    h.selection.clear();
    h.click(rect, [0, 0, 0]);
    h.hover(rect, [5, 5, 0]);
    rect.vcb('3 1/2", 3 1/2"');
    h.refresh();
    h.click(pp, [1.75, 1.75, 0]);
    h.hover(pp, [1.75, 1.75, 5]);
    pp.vcb("3'");
    h.refresh();
    expect(stats()).toEqual({ faces: 22, groups: 2 });
    const mid = h.model.instances(ROOT).find((i) => i.id !== frame)!.id;
    group();
    expect(stats()).toEqual({ faces: 22, groups: 3 });
    // 11. Copies under the other corners.
    copyAlong(0, [0, 0, 0], [50, 0, 0], "11' 8 1/2\"");
    h.selection.set(h.model.instances(ROOT).filter((i) => i.id !== frame && i.id !== mid).map((i) => ({ kind: "instance" as const, id: i.id })));
    copyAlong(1, [0, 0, 0], [0, 50, 0], "9' 8 1/2\"");
    expect(stats()).toEqual({ faces: 40, groups: 6 });
    const corners = h.model.instances(ROOT).filter((i) => i.id !== frame && i.id !== mid).map((i) => i.transform.slice(12, 14).join(",")).sort();
    expect(corners).toEqual(["0,0", "0,116.5", "140.5,0", "140.5,116.5"]);
    // 12. A joist from the rim's inner top corner, 16" centres by 8x.
    h.selection.clear();
    h.click(rect, [1.5, 1.5, 45.25]);
    expect(h.inference.last?.kind).toBe("endpoint");
    h.hover(rect, [5, 60, 45.25]);
    rect.vcb("1 1/2\", 9' 9\"");
    h.refresh();
    h.click(pp, [2.25, 60, 45.25]);
    h.hover(pp, [2.25, 60, 40]);
    pp.vcb('9 1/4"');
    h.refresh();
    group();
    copyAlong(0, [1.5, 1.5, 45.25], [50, 1.5, 45.25], '16"');
    mv.vcb("8x");
    h.refresh();
    expect(h.flashes).toEqual([]);
    expect(stats()).toEqual({ faces: 94, groups: 15 });
    // 13. The stair stringer, drawn flat and pitched to 37° about red.
    h.selection.clear();
    h.click(rect, [36, -72, 0]);
    h.hover(rect, [40, -30, 0]);
    rect.vcb("11 1/4\", 6'");
    h.refresh();
    h.click(pp, [41, -36, 0]);
    h.hover(pp, [41, -36, 5]);
    pp.vcb('1 1/2"');
    h.refresh();
    const stringer = group((p) => p[1] < -1);
    expect(stats()).toEqual({ faces: 100, groups: 16 });
    h.inference.toggleAxisLock(0);
    h.click(rot, [36, -72, 0]);
    expect(h.overlay.protractor!.normal).toEqual([1, 0, 0]);
    h.click(rot, [36, -30, 0]);
    rot.vcb("37");
    h.refresh();
    expect(h.flashes).toEqual([]);
    const st = h.model.instances(ROOT).find((i) => i.id === stringer)!.transform;
    expect(st[5]).toBeCloseTo(Math.cos((37 * Math.PI) / 180), 9);
    expect(st[14]).toBeCloseTo(72 * Math.sin((37 * Math.PI) / 180), 6);
    expect(stats()).toEqual({ faces: 100, groups: 16 });
    // 14. The railing, built flat to the left of the deck.
    h.selection.clear();
    const beforeRail = h.model.instances(ROOT).map((i) => i.id);
    h.click(rect, [-60, 0, 0]);
    h.hover(rect, [-50, 50, 0]);
    rect.vcb("3', 10'");
    h.refresh();
    expect(stats()).toEqual({ faces: 101, groups: 16 });
    h.click(off, [-58, 60, 0]);
    h.hover(off, [-50, 60, 0]);
    off.vcb('1 1/2"');
    h.refresh();
    expect(stats()).toEqual({ faces: 102, groups: 16 });
    const panel = [...new Set(h.scene().triFace)].find((f) => Math.abs(h.model.facePlane(f)!.area - 33 * 117) < 1e-6)!;
    h.model.transact("Erase", () => h.model.erase([panel], [], []));
    h.refresh();
    expect(stats()).toEqual({ faces: 101, groups: 16 });
    h.click(pp, [-59.25, 60, 0]);
    h.hover(pp, [-59.25, 60, 5]);
    pp.vcb('1 1/2"');
    h.refresh();
    expect(stats()).toEqual({ faces: 110, groups: 16 });
    // A baluster on empty ground, grouped, snapped into the opening's corner and nudged clear.
    h.click(rect, [-100, 0, 0]);
    h.hover(rect, [-80, 10, 0]);
    rect.vcb("2' 8\", 1 1/2\"");
    h.refresh();
    h.click(pp, [-84, 0.75, 0]);
    h.hover(pp, [-84, 0.75, 5]);
    pp.vcb('1 1/2"');
    h.refresh();
    const baluster = group((p) => p[0] <= -67.9);
    expect(stats()).toEqual({ faces: 116, groups: 17 });
    h.click(mv, [-100, 0, 0]);
    h.click(mv, [-58.5, 1.5, 0]);
    expect(h.inference.last?.kind).toBe("endpoint");
    moveAlong(0, [-58.5, 1.5, 0], [-40, 1.5, 0], '1/2"');
    moveAlong(1, [-58, 1.5, 0], [-58, 20, 0], '3"');
    expect(h.model.instances(ROOT).find((i) => i.id === baluster)!.transform.slice(12, 15)).toEqual([42, 4.5, 0]);
    copyAlong(1, [-58, 4.5, 0], [-58, 50, 0], "9' 1 1/2\"");
    mv.vcb("/5");
    h.refresh();
    expect(h.flashes).toEqual([]);
    expect(stats()).toEqual({ faces: 146, groups: 22 });
    const balusters = h.model.instances(ROOT).filter((i) => !beforeRail.includes(i.id));
    expect(balusters.map((i) => +i.transform[13].toFixed(2))).toEqual([4.5, 26.4, 48.3, 70.2, 92.1, 114]);
    // Stand it up about green through its deck-side bottom edge, then onto the rim.
    const railing = () => {
      const { faces, edges } = loose((p) => p[0] < -20);
      h.selection.set([
        ...faces.map((id) => ({ kind: "face" as const, id })),
        ...edges.map((id) => ({ kind: "edge" as const, id })),
        ...balusters.map((i) => ({ kind: "instance" as const, id: i.id })),
      ]);
    };
    railing();
    h.inference.toggleAxisLock(1);
    h.click(rot, [-24, 0, 0]);
    expect(h.overlay.protractor!.normal).toEqual([0, 1, 0]);
    h.click(rot, [-60, 0, 0]);
    rot.vcb("90");
    h.refresh();
    expect(h.flashes).toEqual([]);
    expect(stats()).toEqual({ faces: 146, groups: 22 });
    railing();
    moveAlong(2, [-24, 0, 0], [-24, 0, 30], "3' 9 1/4\"");
    railing();
    moveAlong(0, [-24, 0, 45.25], [0, 0, 45.25], "2'");
    expect(h.flashes).toEqual([]);
    expect(stats()).toEqual({ faces: 146, groups: 22 });
    const s = h.scene();
    expect(s.max[2]).toBeCloseTo(45.25 + 36, 3);
    expect(s.min[0]).toBeCloseTo(-1.5, 3);
    expect(h.model.checkModel()).toEqual([]);
  });
});
