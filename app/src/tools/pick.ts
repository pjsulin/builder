// Picking whole entities (faces, edges, groups) for Select, Move and Erase.

import type { Entity } from "../kernel/model";
import { dist, lineRayParam, madd, sub } from "../math";
import type { CameraModel } from "../view/camera";
import type { SceneIndex } from "../view/scene";

const EDGE_PX = 5;

export interface EntityPick {
  entity: Entity;
  item: number;
  /** The click landed outside the context being edited. */
  outside: boolean;
}

/** The entity under the cursor. Edges win when the cursor is right on one. */
export function pickEntity(scene: SceneIndex, cam: CameraModel, x: number, y: number): EntityPick | null {
  const ray = cam.ray(x, y);
  const hit = scene.pick(ray, () => true);
  const visibleDepth = hit ? hit.distance * (1 + 2e-3) + 0.05 : Infinity;
  let best: { s: number; d: number } | null = null;
  const xy = scene.screenEdges(cam);
  for (let s = 0; s < scene.segEdge.length; s++) {
    const ax = xy[s * 4], ay = xy[s * 4 + 1];
    const dx = xy[s * 4 + 2] - ax;
    const dy = xy[s * 4 + 3] - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
    if (!(d <= EDGE_PX) || (best && d >= best.d)) continue;
    // The 3D point under the cursor (perspective-correct, unlike the screen t).
    const pa = scene.segEnd(s, 0);
    const u = sub(scene.segEnd(s, 1), pa);
    const k = Math.min(1, Math.max(0, lineRayParam(pa, u, ray) ?? t));
    if (dist(ray.origin, madd(pa, u, k)) > visibleDepth) continue;
    best = { s, d };
  }
  if (best) return entityFor(scene, scene.segItem[best.s], { kind: "edge", id: scene.segEdge[best.s] });
  if (hit) return entityFor(scene, hit.item, { kind: "face", id: hit.face });
  return null;
}

function entityFor(scene: SceneIndex, item: number, raw: Entity): EntityPick {
  const it = scene.items[item];
  if (it.editable) return { entity: raw, item, outside: false };
  if (it.pickInstance !== null) return { entity: { kind: "instance", id: it.pickInstance }, item, outside: false };
  return { entity: raw, item, outside: true };
}

/**
 * Entities inside a screen rectangle. A window (dragged left to right) takes only
 * entities fully inside; a crossing (right to left) takes anything it touches.
 */
export function boxSelect(
  scene: SceneIndex,
  cam: CameraModel,
  rect: { x0: number; y0: number; x1: number; y1: number },
  crossing: boolean,
): Entity[] {
  const minX = Math.min(rect.x0, rect.x1);
  const maxX = Math.max(rect.x0, rect.x1);
  const minY = Math.min(rect.y0, rect.y1);
  const maxY = Math.max(rect.y0, rect.y1);
  // Per entity: [all corners inside, any corner inside].
  const state = new Map<string, { e: Entity; all: boolean; any: boolean }>();
  const visit = (item: number, raw: Entity, corners: [number, number, number][]) => {
    const it = scene.items[item];
    if (!it.active) return;
    const e: Entity = it.editable ? raw : { kind: "instance", id: it.pickInstance! };
    const key = `${e.kind}:${e.id}`;
    const st = state.get(key) ?? { e, all: true, any: false };
    for (const c of corners) {
      const s = cam.project(c);
      const inside = !!s && s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY;
      st.all &&= inside;
      st.any ||= inside;
    }
    state.set(key, st);
  };
  for (let t = 0; t < scene.triFace.length; t++) {
    visit(scene.triItem[t], { kind: "face", id: scene.triFace[t] }, [scene.triCorner(t, 0), scene.triCorner(t, 1), scene.triCorner(t, 2)]);
  }
  for (let s = 0; s < scene.segEdge.length; s++) {
    visit(scene.segItem[s], { kind: "edge", id: scene.segEdge[s] }, [scene.segEnd(s, 0), scene.segEnd(s, 1)]);
  }
  return [...state.values()].filter((st) => (crossing ? st.any : st.all)).map((st) => st.e);
}
