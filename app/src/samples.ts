// Starter models built with the same kernel operations the tools use.

import { Model, ROOT } from "./kernel/model";
import type { Vec3 } from "./math";

function poly(m: Model, pts: Vec3[]): void {
  pts.forEach((p, i) => m.addLine(ROOT, p, pts[(i + 1) % pts.length]));
}

/** A 10' × 8' shed with a gable roof and a door outline, next to a flat pad. */
export function buildSample(): Model {
  const m = new Model();
  m.transact("Sample", () => {
    poly(m, [[0, 0, 0], [120, 0, 0], [120, 96, 0], [0, 96, 0]]);
    const floor = m.buffers(ROOT).faceIds[0];
    m.pushPull(floor, -96); // ground faces point down, so up is negative
    // A ridge line across the top, lifted to make a gable roof. The gable walls
    // and roof planes stretch with it because the geometry is connected.
    const ridge = m.addLine(ROOT, [0, 48, 96], [120, 48, 96]);
    m.moveVertices(m.verticesOf([], ridge), [0, 0, 36]);
    // A door outline on the front wall, ready to push in.
    poly(m, [[42, 0, 0], [78, 0, 0], [78, 0, 80], [42, 0, 80]]);
    poly(m, [[156, 0, 0], [228, 0, 0], [228, 72, 0], [156, 72, 0]]);
  });
  // Start with empty history, as if the sample were opened from a file.
  return Model.fromJson(m.toJson());
}

/** 2,000 separate boxes, written straight into the file format for speed. */
export function buildStressTest(): Model {
  const vertices: number[][] = [];
  const faces: { outer: number[] }[] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) {
    for (let j = 0; j < 50; j++) {
      const x0 = i * 44;
      const y0 = j * 44;
      const h = 12 + Math.floor(rnd() * 14) * 12;
      const b = vertices.length;
      for (const z of [0, h]) vertices.push([x0, y0, z], [x0 + 32, y0, z], [x0 + 32, y0 + 32, z], [x0, y0 + 32, z]);
      for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) {
        faces.push({ outer: f.map((k) => b + k) });
      }
    }
  }
  const file = {
    format: "builder",
    version: 1,
    units: "inch",
    definitions: [{ name: "Model", kind: "root", vertices, faces }],
  };
  return Model.fromJson(JSON.stringify(file));
}
