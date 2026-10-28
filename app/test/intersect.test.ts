import { describe, expect, it } from "vitest";
import { ROOT } from "../src/kernel/model";
import { newModel } from "./helpers";

/** Two 10 × 10 rectangles crossing like a plus: one vertical at y = 5, one
 *  horizontal at z = 5. */
function cross() {
  const m = newModel();
  const poly = (pts: [number, number, number][]) => {
    for (let i = 0; i < pts.length; i++) m.addLine(ROOT, pts[i], pts[(i + 1) % pts.length]);
  };
  m.transact("Rectangle", () => poly([[0, 5, 0], [10, 5, 0], [10, 5, 10], [0, 5, 10]]));
  m.transact("Rectangle", () => poly([[0, 0, 5], [10, 0, 5], [10, 10, 5], [0, 10, 5]]));
  return m;
}

describe("Intersect Faces", () => {
  it("draws the crossing edge and splits both faces", () => {
    const m = cross();
    expect(m.stats().faces).toBe(2);
    const faces = [...new Set(m.buffers(ROOT).faceIds)];
    const edges = m.transact("Intersect Faces", () => m.intersectFaces(ROOT, faces, [], true));
    expect(edges.length).toBe(1);
    expect(m.stats().faces).toBe(4);
    expect(m.checkModel()).toEqual([]);
    expect(m.canUndo()).toBe(true);
    m.undo();
    expect(m.stats().faces).toBe(2);
  });

  it("with selection only cuts the selected pair", () => {
    const m = cross();
    const [a] = [...new Set(m.buffers(ROOT).faceIds)];
    // One face selected and nothing else: no pair to cut.
    const edges = m.transact("Intersect Faces", () => m.intersectFaces(ROOT, [a], [], false));
    expect(edges).toEqual([]);
    expect(m.stats().faces).toBe(2);
  });

  it("refuses an empty selection with a readable error", () => {
    const m = cross();
    expect(() => m.intersectFaces(ROOT, [], [], true)).toThrow("nothing selected");
  });
});
