import { describe, expect, it } from "vitest";
import { ROOT } from "../src/kernel/model";
import { PushPullTool } from "../src/tools/pushpull";
import { ProtractorTool } from "../src/tools/protractor";
import { RectangleTool } from "../src/tools/rectangle";
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

/** Centre on the ground in front of the box, 0° along red. */
function pickUp(h: TestHost, pro: ProtractorTool) {
  h.click(pro, [0, -100, 0]);
  expect(pro.busy()).toBe(true);
  h.click(pro, [50, -100, 0]);
}

const dirOf = (h: TestHost, i = 0) => h.model.guides(ROOT)[i].dir;

describe("Protractor", () => {
  it("places a guide line at a typed angle, a typed slope, and retypes it as one undo step", () => {
    const h = new TestHost();
    box(h);
    const pro = new ProtractorTool(h);
    expect(h.model.guides(ROOT)).toEqual([]);
    h.hover(pro, [0, -100, 0]);
    expect(h.inference.last?.kind).toBe("ground");
    pickUp(h, pro);
    pro.vcb("37");
    expect(pro.busy()).toBe(false);
    let guides = h.model.guides(ROOT);
    expect(guides.length).toBe(1);
    expect(guides[0].kind).toBe("line");
    guides[0].origin.forEach((v, i) => expect(v).toBeCloseTo([0, -100, 0][i], 9));
    expect(dirOf(h)[0]).toBeCloseTo(Math.cos(37 * DEG), 6);
    expect(dirOf(h)[1]).toBeCloseTo(Math.sin(37 * DEG), 6);
    expect(dirOf(h)[2]).toBeCloseTo(0, 6);
    // Retype as a slope: the same guide moves.
    pro.vcb("3:12");
    guides = h.model.guides(ROOT);
    expect(guides.length).toBe(1);
    const pitch = Math.atan(3 / 12);
    expect(dirOf(h)[0]).toBeCloseTo(Math.cos(pitch), 6);
    expect(dirOf(h)[1]).toBeCloseTo(Math.sin(pitch), 6);
    expect(h.model.undo()).toBe("Guide");
    expect(h.model.guides(ROOT)).toEqual([]);
    expect(h.model.undo()).toBe("Push/Pull");
  });

  it("snaps a sweep near the centre to 15°, measures finer farther out, and exactly on a point", () => {
    const h = new TestHost();
    box(h);
    const pro = new ProtractorTool(h);
    pickUp(h, pro);
    const r = h.camera.dist * 0.12;
    // 22° at half the protractor's radius snaps to 15°.
    h.hover(pro, [0 + 0.5 * r * Math.cos(22 * DEG), -100 + 0.5 * r * Math.sin(22 * DEG), 0]);
    expect(h.vcbText).toBe("15°");
    expect(h.overlay.protractor?.angle).toBeCloseTo(15 * DEG, 9);
    // 22.4° well outside it reads 22°.
    h.hover(pro, [0 + 3 * r * Math.cos(22.4 * DEG), -100 + 3 * r * Math.sin(22.4 * DEG), 0]);
    expect(h.vcbText).toBe("22°");
    h.click(pro, [0 + 3 * r * Math.cos(22.4 * DEG), -100 + 3 * r * Math.sin(22.4 * DEG), 0]);
    expect(dirOf(h)[1] / dirOf(h)[0]).toBeCloseTo(Math.tan(22 * DEG), 6);
    // A point inference sets the angle exactly: the box's front bottom corner.
    pickUp(h, pro);
    h.hover(pro, [120, 0, 0]);
    expect(h.inference.last?.kind).toBe("endpoint");
    const exact = Math.atan2(100, 120);
    expect(h.overlay.protractor?.angle).toBeCloseTo(exact, 9);
    h.click(pro, [120, 0, 0]);
    expect(dirOf(h, 1)[1] / dirOf(h, 1)[0]).toBeCloseTo(100 / 120, 6);
  });

  it("lies on the hovered face, follows an arrow-key axis lock, and sweeps in that plane", () => {
    const h = new TestHost();
    box(h);
    const pro = new ProtractorTool(h);
    h.hover(pro, [70, 0, 40]);
    expect(h.inference.last?.kind).toBe("onFace");
    expect(h.overlay.protractor!.normal[1]).toBeCloseTo(-1, 6);
    h.hover(pro, [-60, -60, 0]);
    expect(h.overlay.protractor!.normal).toEqual([0, 0, 1]);
    h.inference.toggleAxisLock(0);
    h.hover(pro, [70, 0, 40]);
    expect(h.overlay.protractor!.normal).toEqual([1, 0, 0]);
    h.inference.unlock();
    // A guide swept on the front wall, 0° along red, 45° up the wall.
    h.click(pro, [60, 0, 40]);
    expect(h.overlay.protractor!.normal[1]).toBeCloseTo(-1, 6);
    h.click(pro, [100, 0, 40]);
    pro.vcb("45");
    const d = dirOf(h);
    expect(Math.abs(d[0])).toBeCloseTo(Math.SQRT1_2, 6);
    expect(d[1]).toBeCloseTo(0, 6);
    expect(Math.abs(d[2])).toBeCloseTo(Math.SQRT1_2, 6);
    h.model.guides(ROOT)[0].origin.forEach((v, i) => expect(v).toBeCloseTo([60, 0, 40][i], 9));
    // Esc cancels a sweep in progress with no guide placed.
    h.click(pro, [0, -100, 0]);
    expect(pro.key("Escape")).toBe(true);
    expect(pro.busy()).toBe(false);
    expect(h.model.guides(ROOT).length).toBe(1);
  });
});
