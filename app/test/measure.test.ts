import { describe, expect, it } from "vitest";
import { ROOT } from "../src/kernel/model";
import { TapeMeasureTool } from "../src/tools/measure";
import { PushPullTool } from "../src/tools/pushpull";
import { RectangleTool } from "../src/tools/rectangle";
import { TestHost } from "./toolhost";

/** A 10' × 8' (120" × 96") deck rim, 1' tall, on the ground. */
function rim(h: TestHost) {
  const rect = new RectangleTool(h);
  h.click(rect, [0, 0, 0]);
  h.hover(rect, [100, 80, 0]);
  rect.vcb("10', 8'");
  h.refresh();
  const pp = new PushPullTool(h);
  h.click(pp, [60, 48, 0]);
  h.hover(pp, [60, 48, 20]);
  pp.vcb("1'");
  h.refresh();
}

const round = (v: number[]) => v.map((x) => Math.round(x * 1e6) / 1e6);

describe("Tape Measure", () => {
  it("places a guide line 4' from the rim's front edge and retypes 3' in one undo step", () => {
    const h = new TestHost();
    rim(h);
    const tape = new TapeMeasureTool(h);
    expect(tape.cursor).toBe("measure");
    // The front edge runs along red at y = 0, z = 12; click its midpoint.
    h.hover(tape, [60, 0, 12]);
    expect(h.inference.last?.kind).toBe("midpoint");
    h.click(tape, [60, 0, 12]);
    expect(tape.busy()).toBe(true);
    expect(tape.vcbLabel()).toBe("Distance");
    h.hover(tape, [60, -30, 12]);
    expect(h.vcbText).toBe(`2' 6"`);
    tape.vcb("4'");
    expect(tape.busy()).toBe(false);
    let guides = h.model.guides(ROOT);
    expect(guides.length).toBe(1);
    expect(guides[0].kind).toBe("line");
    expect(round(guides[0].origin).slice(1)).toEqual([-48, 12]);
    expect(round(guides[0].dir)).toEqual([1, 0, 0]);
    const revision = h.model.revision;
    tape.vcb("3'");
    guides = h.model.guides(ROOT);
    expect(guides.length).toBe(1);
    expect(round(guides[0].origin).slice(1)).toEqual([-36, 12]);
    expect(h.model.revision).toBeGreaterThan(revision);
    expect(h.model.undo()).toBe("Guide");
    expect(h.model.guides(ROOT)).toEqual([]);
    expect(h.model.undo()).toBe("Push/Pull");
  });

  it("places a guide point 2' from an endpoint and a line parallel to a dragged edge", () => {
    const h = new TestHost();
    rim(h);
    const tape = new TapeMeasureTool(h);
    h.click(tape, [120, 0, 12]);
    expect(h.inference.last?.kind).toBe("endpoint");
    h.hover(tape, [160, 0, 12]);
    expect(h.inference.last?.kind).toBe("axis");
    tape.vcb("2'");
    const guides = h.model.guides(ROOT);
    expect(guides).toEqual([{ id: 0, kind: "point", origin: [144, 0, 12], dir: [0, 0, 0] }]);
    // Drag off the bottom left edge (along green at x = 0) for a line 1' outside it.
    h.drag(tape, [0, 20, 0], [-12, 20, 0]);
    const line = h.model.guides(ROOT)[1];
    expect(line.kind).toBe("line");
    expect(round(line.origin)[0]).toBeCloseTo(-12, 6);
    expect(round(line.dir)).toEqual([0, 1, 0]);
    expect(h.model.undo()).toBe("Guide");
    expect(h.model.guides(ROOT).length).toBe(1);
  });

  it("measures only after the Ctrl tap, leaving the model unchanged", () => {
    const h = new TestHost();
    rim(h);
    const tape = new TapeMeasureTool(h);
    tape.modifier();
    expect(tape.cursor).toBe("measure-only");
    expect(tape.vcbLabel()).toBe("Length");
    const revision = h.model.revision;
    h.click(tape, [0, 0, 12]);
    h.hover(tape, [120, 0, 12]);
    expect(h.vcbText).toBe(`10' 0"`);
    expect(h.overlay.dims?.[0].text).toBe(`10' 0"`);
    h.click(tape, [120, 0, 12]);
    expect(tape.busy()).toBe(false);
    expect(h.model.guides(ROOT)).toEqual([]);
    expect(h.model.revision).toBe(revision);
    tape.vcb("4'");
    expect(h.flashes.at(-1)).toMatch(/Measuring only/);
    tape.modifier();
    expect(tape.cursor).toBe("measure");
  });

  it("refuses a locked context before any preview", () => {
    const h = new TestHost();
    rim(h);
    const faces = [...new Set(h.scene().triFace)];
    const g = h.model.transact("Make Group", () => h.model.makeGroup(ROOT, faces, [...h.scene().segEdge], []));
    const tag = h.model.transact("Tag", () => h.model.newTag("Existing"));
    h.model.transact("Lock", () => {
      h.model.setInstanceTag(g, tag);
      h.model.setTagFlags(tag, true, true);
    });
    h.enterGroup(g);
    const tape = new TapeMeasureTool(h);
    h.click(tape, [60, 0, 12]);
    expect(tape.busy()).toBe(false);
    expect(h.flashes.at(-1)).toMatch(/Locked: Existing/);
    expect(h.model.guides(h.ctx)).toEqual([]);
  });
});
