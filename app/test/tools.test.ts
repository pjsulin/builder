import { describe, expect, it } from "vitest";
import { ROOT } from "../src/kernel/model";
import { EraseTool } from "../src/tools/erase";
import { LineTool } from "../src/tools/line";
import { MoveTool } from "../src/tools/move";
import { PushPullTool } from "../src/tools/pushpull";
import { RectangleTool } from "../src/tools/rectangle";
import { SelectTool } from "../src/tools/select";
import { TestHost } from "./toolhost";

/** Faces on the front wall plane (y = 0) facing out. */
function wallFaces(h: TestHost): number {
  return [...new Set(h.model.buffers(ROOT).faceIds)]
    .map((f) => h.model.facePlane(f)!)
    .filter((p) => p.normal[1] < -0.99 && Math.abs(p.d) < 1e-6).length;
}

/** Draw a 10' × 8' rectangle on the ground and pull it 8' up. */
function shed(h: TestHost) {
  const rect = new RectangleTool(h);
  h.click(rect, [0, 0, 0]);
  h.hover(rect, [100, 80, 0]);
  rect.vcb("10', 8'");
  h.refresh();
  const pp = new PushPullTool(h);
  h.click(pp, [60, 48, 0.0]);
  return { rect, pp };
}

describe("Rectangle", () => {
  it("draws a face on the ground from typed dimensions", () => {
    const h = new TestHost();
    const rect = new RectangleTool(h);
    h.click(rect, [0, 0, 0]);
    expect(rect.busy()).toBe(true);
    h.hover(rect, [50, 30, 0]);
    expect(h.vcbText).toBe(`4' 2", 2' 6"`);
    rect.vcb("10', 8'");
    expect(rect.busy()).toBe(false);
    expect(h.model.stats().faces).toBe(1);
    const face = h.model.buffers(ROOT).faceIds[0];
    expect(h.model.facePlane(face)!.area).toBeCloseTo(120 * 96);
  });

  it("resizes the last rectangle when you retype", () => {
    const h = new TestHost();
    const rect = new RectangleTool(h);
    h.click(rect, [0, 0, 0]);
    h.click(rect, [50, 30, 0]);
    rect.vcb("6', 4'");
    const face = h.model.buffers(ROOT).faceIds[0];
    expect(h.model.facePlane(face)!.area).toBeCloseTo(72 * 48);
    expect(h.model.stats().faces).toBe(1);
    h.model.undo();
    expect(h.model.stats().faces).toBe(0);
  });

  it("draws on a wall, and the rectangle splits the wall", () => {
    const h = new TestHost();
    const { pp } = shed(h);
    h.hover(pp, [60, 48, 96]);
    pp.vcb("8'");
    h.refresh();
    expect(h.model.stats().faces).toBe(6);
    const rect = new RectangleTool(h);
    // Front wall is y = 0. Start a door at x = 40 on its bottom edge.
    h.click(rect, [40, 0, 0.5]);
    expect(h.inference.last?.kind).toBe("onEdge");
    h.hover(rect, [70, 0, 60]);
    rect.vcb("3', 6' 8\"");
    expect(h.model.stats().faces).toBe(7);
    expect(wallFaces(h)).toBe(2); // the wall and the door, both facing out
  });

  it("starting on a corner of a wall rectangle stays on the wall", () => {
    const h = new TestHost();
    const { pp } = shed(h);
    h.hover(pp, [60, 48, 96]);
    pp.vcb("8'");
    h.refresh();
    const rect = new RectangleTool(h);
    h.click(rect, [40, 0, 0.5]);
    h.hover(rect, [70, 0, 60]);
    rect.vcb("3', 6' 8\"");
    h.refresh();
    expect(wallFaces(h)).toBe(2);
    // Start on the door's top-right corner (an endpoint, not a face) and drag
    // down and right across the wall, as in the reported bug.
    h.click(rect, [76, 0, 80]);
    expect(h.inference.last?.kind).toBe("endpoint");
    h.hover(rect, [100, 0, 20]);
    rect.vcb("2', 5'");
    h.refresh();
    const normals = [...new Set(h.model.buffers(ROOT).faceIds)].map((f) => h.model.facePlane(f)!.normal);
    const horizontal = normals.filter((n) => Math.abs(n[2]) > 0.99);
    expect(horizontal.length).toBe(2); // only the floor and the roof
    expect(h.model.stats().faces).toBe(8); // the wall split again
    expect(wallFaces(h)).toBe(3);
  });
});

describe("Push/Pull", () => {
  it("pulls a ground rectangle into a box by dragging, matching a typed height", () => {
    const h = new TestHost();
    const { pp } = shed(h);
    expect(pp.busy()).toBe(true);
    h.hover(pp, [60, 48, 30]);
    expect(h.vcbText).toMatch(/^2' 6"|2' 5|2' 6/);
    pp.vcb("8'");
    expect(pp.busy()).toBe(false);
    expect(h.model.stats().faces).toBe(6);
    const s = h.scene();
    expect(s.max[2]).toBeCloseTo(96);
  });

  it("aborting a drag leaves the model unchanged", () => {
    const h = new TestHost();
    const { pp } = shed(h);
    const before = h.model.toJson();
    h.hover(pp, [60, 48, 50]);
    expect(h.model.stats().faces).toBe(6);
    pp.key("Escape");
    expect(h.model.toJson()).toBe(before);
    expect(h.model.canRedo()).toBe(false);
  });

  it("retyping changes the last push/pull", () => {
    const h = new TestHost();
    const { pp } = shed(h);
    h.hover(pp, [60, 48, 50]);
    pp.vcb("4'");
    h.refresh();
    expect(h.scene().max[2]).toBeCloseTo(48);
    pp.vcb("7'");
    h.refresh();
    expect(h.scene().max[2]).toBeCloseTo(84);
    h.model.undo();
    expect(h.model.stats().faces).toBe(1);
  });

  it("double-click repeats the last distance on another face", () => {
    const h = new TestHost();
    const { pp } = shed(h);
    h.hover(pp, [60, 48, 50]);
    pp.vcb("2'");
    h.refresh();
    pp.doubleClick!(h.at([60, 48, 24]));
    h.refresh();
    expect(h.scene().max[2]).toBeCloseTo(48);
  });
});

describe("Line", () => {
  it("closes a triangle into a face and ends the chain", () => {
    const h = new TestHost();
    const line = new LineTool(h);
    h.click(line, [0, 0, 0]);
    h.hover(line, [30, 0, 0]);
    line.vcb("5'");
    expect(line.busy()).toBe(true);
    h.click(line, [30, 40, 0]);
    h.click(line, [0, 0, 0]);
    expect(h.model.stats().faces).toBe(1);
    expect(line.busy()).toBe(false);
  });

  it("draws along a locked axis", () => {
    const h = new TestHost();
    const line = new LineTool(h);
    h.click(line, [0, 0, 0]);
    h.inference.toggleAxisLock(2);
    h.hover(line, [40, 10, 50]);
    line.vcb("4'");
    const e = h.model.edgeInfo(h.scene().segEdge[0])!;
    expect(e.b[0]).toBeCloseTo(0);
    expect(e.b[1]).toBeCloseTo(0);
    expect(Math.max(e.a[2], e.b[2])).toBeCloseTo(48);
  });
});

describe("Select, Move, Erase and groups", () => {
  function box(h: TestHost) {
    const { pp } = shed(h);
    h.hover(pp, [60, 48, 50]);
    pp.vcb("8'");
    h.refresh();
  }

  it("moves a selected top face up, stretching the box", () => {
    const h = new TestHost();
    box(h);
    const sel = new SelectTool(h);
    h.click(sel, [60, 48, 96]);
    expect(h.selection.items).toEqual([{ kind: "face", id: expect.any(Number) }]);
    const mv = new MoveTool(h);
    h.click(mv, [60, 48, 96]);
    h.hover(mv, [60, 48, 110]);
    mv.vcb("1'");
    h.refresh();
    expect(h.scene().max[2]).toBeCloseTo(108);
    expect(h.model.stats().faces).toBe(6);
  });

  it("window-selects, groups, and moves the group along an axis", () => {
    const h = new TestHost();
    box(h);
    const sel = new SelectTool(h);
    const all = [[0, 0, 0], [120, 0, 0], [120, 96, 0], [0, 96, 0], [0, 0, 96], [120, 0, 96], [120, 96, 96], [0, 96, 96]].map((p) => h.camera.project(p as [number, number, number])!);
    const x0 = Math.min(...all.map((s) => s.x)) - 10, x1 = Math.max(...all.map((s) => s.x)) + 10;
    const y0 = Math.min(...all.map((s) => s.y)) - 10, y1 = Math.max(...all.map((s) => s.y)) + 10;
    const ptr = (x: number, y: number) => ({ x, y, shift: false, ctrl: false, alt: false, copy: false });
    sel.down(ptr(x0, y0));
    sel.move(ptr(x1, y1));
    sel.up(ptr(x1, y1), true);
    expect(h.selection.ids("face").length).toBe(6);
    expect(h.selection.ids("edge").length).toBe(12);
    const g = h.model.transact("Make Group", () => h.model.makeGroup(ROOT, h.selection.ids("face"), h.selection.ids("edge"), []));
    h.refresh();
    h.selection.set([{ kind: "instance", id: g }]);
    const mv = new MoveTool(h);
    h.click(mv, [0, 0, 0]);
    h.hover(mv, [50, 0, 0]);
    mv.vcb("10'");
    expect(h.model.instances(ROOT)[0].transform.slice(12, 15)).toEqual([120, 0, 0]);
  });

  it("edits inside a group without touching outside geometry", () => {
    const h = new TestHost();
    box(h);
    const faces = [...new Set(h.scene().triFace)];
    const g = h.model.transact("Make Group", () => h.model.makeGroup(ROOT, faces, [...h.scene().segEdge], []));
    h.refresh();
    const sel = new SelectTool(h);
    sel.doubleClick!(h.at([60, 48, 96]));
    expect(h.ctx).toBe(h.model.instanceInfo(g)!.definition);
    const pp = new PushPullTool(h);
    h.click(pp, [60, 48, 96]);
    h.hover(pp, [60, 48, 100]);
    pp.vcb("1'");
    h.refresh();
    expect(h.scene().max[2]).toBeCloseTo(108);
    sel.key!("Escape");
    expect(h.ctx).toBe(ROOT);
  });

  it("erasing the line across a face merges it back", () => {
    const h = new TestHost();
    const rect = new RectangleTool(h);
    h.click(rect, [0, 0, 0]);
    rect.vcb("10', 8'");
    h.refresh();
    const line = new LineTool(h);
    h.click(line, [60, 0, 0]);
    h.click(line, [60, 96, 0]);
    h.refresh();
    expect(h.model.stats().faces).toBe(2);
    const er = new EraseTool(h);
    h.click(er, [60, 48, 0]);
    h.refresh();
    expect(h.model.stats().faces).toBe(1);
    expect(h.model.stats().edges).toBe(4);
  });

  it("commits a fold when a top edge is pushed sideways", () => {
    const h = new TestHost();
    box(h);
    const sel = new SelectTool(h);
    h.click(sel, [120, 48, 96]);
    expect(h.selection.items).toEqual([{ kind: "edge", id: expect.any(Number) }]);
    const mv = new MoveTool(h);
    h.click(mv, [120, 48, 96]);
    h.hover(mv, [120, 72, 96]);
    mv.vcb("1'");
    h.refresh();
    // The front and back walls can no longer stay planar, so each folds in two.
    expect(h.model.stats().faces).toBe(8);
    expect(h.model.stats().edges).toBe(14);
    expect(h.flashes).toEqual([]);
    h.model.undo();
    expect(h.model.stats().faces).toBe(6);
  });

  it("welds a face moved onto another", () => {
    const h = new TestHost();
    box(h);
    // A second box of the same size to the left, 100" away.
    const rect = new RectangleTool(h);
    h.click(rect, [-196, 0, 0]);
    h.hover(rect, [-100, 80, 0]);
    rect.vcb("8', 8'");
    h.refresh();
    const pp = new PushPullTool(h);
    h.click(pp, [-148, 48, 0]);
    h.hover(pp, [-148, 48, 50]);
    pp.vcb("8'");
    h.refresh();
    expect(h.model.stats().faces).toBe(12);
    const sel = new SelectTool(h);
    h.click(sel, [0, 48, 48]);
    expect(h.selection.items).toEqual([{ kind: "face", id: expect.any(Number) }]);
    const mv = new MoveTool(h);
    h.click(mv, [0, 48, 48]);
    h.hover(mv, [-10, 48, 48]);
    mv.vcb("8' 4\"");
    h.refresh();
    // The facing sides cancel and the coplanar sides merge: one 316" box.
    expect(h.flashes).toEqual([]);
    expect(h.model.stats().faces).toBe(6);
    expect(h.scene().min[0]).toBeCloseTo(-196);
    expect(h.scene().max[0]).toBeCloseTo(120);
    h.model.undo();
    expect(h.model.stats().faces).toBe(12);
  });
});

function box(h: TestHost) {
  const { pp } = shed(h);
  h.hover(pp, [60, 48, 50]);
  pp.vcb("8'");
  h.refresh();
}

describe("Model copy", () => {
  it("copies a group and loose geometry in one transaction that undoes as one", () => {
    const h = new TestHost();
    box(h);
    const faces = [...new Set(h.scene().triFace)];
    const g = h.model.transact("Make Group", () => h.model.makeGroup(ROOT, faces, [...h.scene().segEdge], []));
    h.refresh();
    const line = new LineTool(h);
    h.click(line, [200, 0, 0]);
    h.click(line, [260, 0, 0]);
    h.refresh();
    const loose = [...h.scene().segEdge].filter((e) => h.model.edgeInfo(e)!.owner === ROOT);
    expect(loose.length).toBe(1);
    const before = h.model.stats();
    const copies = h.model.transact("Copy", () => ({
      inst: h.model.copyInstance(g, [0, 120, 0]),
      geometry: h.model.copyGeometry(ROOT, [], loose, [0, 120, 0]),
    }));
    const after = h.model.stats();
    expect(after.instances).toBe(before.instances + 1);
    expect(after.edges).toBe(before.edges + 13);
    expect(after.faces).toBe(before.faces + 6);
    expect(copies.geometry.edges.length).toBe(1);
    expect(h.model.instances(ROOT).find((i) => i.id === copies.inst)!.transform.slice(12, 15)).toEqual([0, 120, 0]);
    expect(h.model.undo()).toBe("Copy");
    expect(h.model.stats()).toEqual(before);
  });

  it("refuses to copy an instance on a locked tag and aborts cleanly", () => {
    const h = new TestHost();
    box(h);
    const faces = [...new Set(h.scene().triFace)];
    const g = h.model.transact("Make Group", () => h.model.makeGroup(ROOT, faces, [...h.scene().segEdge], []));
    const tag = h.model.transact("Tag", () => h.model.newTag("Existing"));
    h.model.transact("Lock", () => {
      h.model.setInstanceTag(g, tag);
      h.model.setTagFlags(tag, true, true);
    });
    const before = h.model.stats();
    expect(() => h.model.transact("Copy", () => h.model.copyInstance(g, [0, 120, 0]))).toThrow("locked tag");
    expect(h.model.stats()).toEqual(before);
  });
});

describe("Move with the copy modifier", () => {
  /** A grouped 10' x 8' x 8' box, selected. */
  function grouped(h: TestHost): number {
    box(h);
    const faces = [...new Set(h.scene().triFace)];
    const g = h.model.transact("Make Group", () => h.model.makeGroup(ROOT, faces, [...h.scene().segEdge], []));
    h.refresh();
    h.selection.set([{ kind: "instance", id: g }]);
    return g;
  }
  const origin = (h: TestHost, id: number) => h.model.instances(ROOT).find((i) => i.id === id)!.transform.slice(12, 15);

  it("leaves the original and places a copy at the typed distance", () => {
    const h = new TestHost();
    const g = grouped(h);
    const mv = new MoveTool(h);
    h.copyClick(mv, [0, 0, 0]);
    expect(mv.cursor).toBe("copy");
    expect(mv.hint()).toContain("5x");
    h.hover(mv, [50, 0, 0]);
    mv.vcb('16"');
    h.refresh();
    const insts = h.model.instances(ROOT);
    expect(insts.length).toBe(2);
    expect(origin(h, g)).toEqual([0, 0, 0]);
    expect(insts.find((i) => i.id !== g)!.transform.slice(12, 15)).toEqual([16, 0, 0]);
    expect(h.selection.ids("instance")).toEqual([insts.find((i) => i.id !== g)!.id]);
    expect(h.flashes).toEqual([]);
    expect(h.model.undo()).toBe("Copy");
    expect(h.model.instances(ROOT).length).toBe(1);
    expect(origin(h, g)).toEqual([0, 0, 0]);
  });

  it("copies a loose face without changing the original", () => {
    const h = new TestHost();
    box(h);
    const sel = new SelectTool(h);
    h.click(sel, [60, 48, 96]);
    const mv = new MoveTool(h);
    h.copyClick(mv, [60, 48, 96]);
    h.hover(mv, [60, 48, 110]);
    mv.vcb("2'");
    h.refresh();
    expect(h.model.stats().faces).toBe(7);
    expect(h.scene().max[2]).toBeCloseTo(120);
    expect(h.selection.ids("face").length).toBe(1);
    expect(h.model.undo()).toBe("Copy");
    h.refresh();
    expect(h.model.stats().faces).toBe(6);
    expect(h.scene().max[2]).toBeCloseTo(96);
  });

  it("switches to a copy when the modifier goes down mid-move", () => {
    const h = new TestHost();
    grouped(h);
    const mv = new MoveTool(h);
    h.click(mv, [0, 0, 0]);
    expect(mv.cursor).toBe("move");
    mv.modifier(true);
    expect(mv.cursor).toBe("copy");
    mv.modifier(false);
    expect(mv.cursor).toBe("move");
    mv.modifier(true);
    h.hover(mv, [50, 0, 0]);
    mv.vcb("2'");
    expect(h.flashes).toEqual([]);
    expect(h.model.instances(ROOT).length).toBe(2);
    expect(mv.cursor).toBe("move");
    // Retyping the distance moves the copy, not the original.
    mv.vcb("3'");
    expect(h.flashes).toEqual([]);
    const insts = h.model.instances(ROOT);
    expect(insts.length).toBe(2);
    expect(insts.map((i) => i.transform[12]).sort((a, b) => a - b)).toEqual([0, 36]);
  });

  it("refuses to copy a locked group", () => {
    const h = new TestHost();
    const g = grouped(h);
    h.model.transact("Lock", () => {
      const tag = h.model.newTag("Existing");
      h.model.setInstanceTag(g, tag);
      h.model.setTagFlags(tag, true, true);
    });
    h.refresh();
    h.selection.set([{ kind: "instance", id: g }]);
    const mv = new MoveTool(h);
    h.copyClick(mv, [0, 0, 0]);
    expect(mv.busy()).toBe(false);
    expect(h.flashes.length).toBe(1);
    expect(h.flashes[0]).toMatch(/locked/i);
    expect(h.model.instances(ROOT).length).toBe(1);
  });
});
