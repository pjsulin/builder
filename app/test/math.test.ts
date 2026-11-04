import { describe, expect, it } from "vitest";
import { apply, applyDir, invert, lineRayParam, mul, planeBasis, rayTriangle, rotation, translation, type Mat4 } from "../src/math";
import { CameraModel } from "../src/view/camera";

describe("matrices", () => {
  it("inverts an affine transform", () => {
    const c = Math.cos(0.7), s = Math.sin(0.7);
    const m: Mat4 = mul(translation([5, -3, 2]), [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const p = apply(invert(m), apply(m, [1, 2, 3]));
    p.forEach((x, i) => expect(x).toBeCloseTo([1, 2, 3][i], 9));
  });

  it("rotates about an axis through a centre, matching the kernel's convention", () => {
    const quarter = rotation([0, 0, 0], [0, 0, 1], Math.PI / 2);
    apply(quarter, [1, 0, 0]).forEach((x, i) => expect(x).toBeCloseTo([0, 1, 0][i], 12));
    applyDir(quarter, [0, 1, 0]).forEach((x, i) => expect(x).toBeCloseTo([-1, 0, 0][i], 12));
    // The same matrix as a rotation through the origin moved to the centre.
    const c: [number, number, number] = [10, 5, 3];
    const m = rotation(c, [1, 1, 0], 0.7);
    apply(m, c).forEach((x, i) => expect(x).toBeCloseTo(c[i], 12));
    const viaTranslation = mul(translation(c), mul(rotation([0, 0, 0], [1, 1, 0], 0.7), translation([-10, -5, -3])));
    m.forEach((x, i) => expect(x).toBeCloseTo(viaTranslation[i], 12));
    // Its inverse is the opposite rotation.
    invert(m).forEach((x, i) => expect(x).toBeCloseTo(rotation(c, [1, 1, 0], -0.7)[i], 12));
    rotation(c, [0, 1, 0], 0).forEach((x, i) => expect(x).toBeCloseTo([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1][i], 12));
  });
});

describe("rays", () => {
  it("hits a triangle", () => {
    const t = rayTriangle({ origin: [0.2, 0.2, 5], dir: [0, 0, -1] }, [0, 0, 0], [1, 0, 0], [0, 1, 0]);
    expect(t).toBeCloseTo(5);
    expect(rayTriangle({ origin: [2, 2, 5], dir: [0, 0, -1] }, [0, 0, 0], [1, 0, 0], [0, 1, 0])).toBeNull();
  });

  it("finds the closest point on a line to a ray", () => {
    const t = lineRayParam([0, 0, 0], [0, 0, 1], { origin: [5, 0, 7], dir: [-1, 0, 0] });
    expect(t).toBeCloseTo(7);
  });

  it("uses a horizontal first axis on walls, like the kernel", () => {
    const [u, v] = planeBasis([0, -1, 0]);
    expect(u[2]).toBeCloseTo(0);
    expect(v[2]).toBeCloseTo(1);
  });
});

describe("camera", () => {
  it("projects the point under a pixel back to that pixel", () => {
    const cam = new CameraModel();
    const r = cam.ray(310, 205);
    const p = [r.origin[0] + r.dir[0] * 300, r.origin[1] + r.dir[1] * 300, r.origin[2] + r.dir[2] * 300] as [number, number, number];
    const s = cam.project(p)!;
    expect(s.x).toBeCloseTo(310, 6);
    expect(s.y).toBeCloseTo(205, 6);
  });
});
