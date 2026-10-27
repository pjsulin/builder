// Three.js rendering. One mesh pair (front/back) and one line set per definition,
// shared by every placement of it, so draw calls grow with definitions and
// instances, not with faces. Overlays (highlights, previews, guides) are small
// separate objects.

import * as THREE from "three";
import type { SceneIndex } from "./scene";
import type { CameraModel } from "./camera";
import type { Vec3 } from "../math";

export interface Theme {
  face: string;
  back: string;
  edge: string;
  sel: string;
  hover: string;
  axes: [string, string, string];
  preview: string;
}

interface DefGeometry {
  faces: THREE.BufferGeometry;
  edges: THREE.BufferGeometry;
}

export class Viewport {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 1, 100000);
  private modelGroup = new THREE.Group();
  private overlayGroup = new THREE.Group();
  private geometries = new Map<number, DefGeometry>();
  private axes: THREE.Line[] = [];
  private needsFrame = false;
  onFrame: ((ms: number) => void) | null = null;

  readonly mat = {
    front: new THREE.MeshLambertMaterial({ side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    back: new THREE.MeshLambertMaterial({ side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    edge: new THREE.LineBasicMaterial(),
    frontFaded: new THREE.MeshLambertMaterial({ side: THREE.FrontSide, transparent: true, opacity: 0.35, depthWrite: false }),
    backFaded: new THREE.MeshLambertMaterial({ side: THREE.BackSide, transparent: true, opacity: 0.35, depthWrite: false }),
    edgeFaded: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.3 }),
    select: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    selectEdge: new THREE.LineBasicMaterial({ depthTest: true }),
    hover: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    preview: new THREE.LineBasicMaterial({ depthTest: false, transparent: true }),
    previewFill: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    guide: new THREE.LineDashedMaterial({ dashSize: 6, gapSize: 4, depthTest: false, transparent: true }),
    box: new THREE.LineBasicMaterial({ depthTest: false, transparent: true, opacity: 0.8 }),
  };

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.prepend(this.renderer.domElement);
    this.camera.up.set(0, 0, 1);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x80868f, 2.2);
    hemi.position.set(0, 0, 1);
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-0.5, -1, 1.6);
    this.scene.add(hemi, sun, this.modelGroup, this.overlayGroup);
    this.overlayGroup.renderOrder = 10;
    for (let i = 0; i < 3; i++) {
      const dir = new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
      const L = 60000;
      const pos = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), dir.clone().multiplyScalar(L)]), new THREE.LineBasicMaterial());
      const neg = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), dir.clone().multiplyScalar(-L)]), new THREE.LineDashedMaterial({ dashSize: 14, gapSize: 10 }));
      neg.computeLineDistances();
      this.scene.add(pos, neg);
      this.axes.push(pos, neg);
    }
  }

  setTheme(t: Theme): void {
    this.mat.front.color.set(t.face);
    this.mat.frontFaded.color.set(t.face);
    this.mat.back.color.set(t.back);
    this.mat.backFaded.color.set(t.back);
    this.mat.edge.color.set(t.edge);
    this.mat.edgeFaded.color.set(t.edge);
    this.mat.select.color.set(t.sel);
    this.mat.selectEdge.color.set(t.sel);
    this.mat.box.color.set(t.sel);
    this.mat.hover.color.set(t.hover);
    this.mat.preview.color.set(t.preview);
    this.mat.previewFill.color.set(t.hover);
    this.axes.forEach((l, i) => (l.material as THREE.LineBasicMaterial).color.set(t.axes[Math.floor(i / 2)]));
    this.request();
  }

  resize(): void {
    const r = this.host.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.request();
  }

  syncCamera(cam: CameraModel): void {
    const e = cam.eye;
    this.camera.position.set(e[0], e[1], e[2]);
    this.camera.fov = cam.fov;
    this.camera.aspect = cam.width / cam.height;
    this.camera.near = cam.near;
    this.camera.far = cam.far;
    this.camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.request();
  }

  /** Rebuild draw objects from a scene index. Geometry is shared per definition. */
  setScene(index: SceneIndex): void {
    for (const g of this.geometries.values()) {
      g.faces.dispose();
      g.edges.dispose();
    }
    this.geometries.clear();
    this.modelGroup.clear();
    for (const [def, b] of index.buffers) {
      const faces = new THREE.BufferGeometry();
      faces.setAttribute("position", new THREE.BufferAttribute(b.positions, 3));
      faces.setAttribute("normal", new THREE.BufferAttribute(b.normals, 3));
      faces.computeBoundingSphere();
      const edges = new THREE.BufferGeometry();
      edges.setAttribute("position", new THREE.BufferAttribute(b.edgePositions, 3));
      edges.computeBoundingSphere();
      this.geometries.set(def, { faces, edges });
    }
    for (const it of index.items) {
      const g = this.geometries.get(it.def)!;
      const m = new THREE.Matrix4().fromArray(it.matrix);
      const objs = it.active
        ? [new THREE.Mesh(g.faces, this.mat.front), new THREE.Mesh(g.faces, this.mat.back), new THREE.LineSegments(g.edges, this.mat.edge)]
        : [new THREE.Mesh(g.faces, this.mat.frontFaded), new THREE.Mesh(g.faces, this.mat.backFaded), new THREE.LineSegments(g.edges, this.mat.edgeFaded)];
      for (const o of objs) {
        o.matrixAutoUpdate = false;
        o.matrix.copy(m);
        this.modelGroup.add(o);
      }
    }
    this.request();
  }

  // ---- overlays ----

  private layers = new Map<string, THREE.Object3D>();

  private setLayer(name: string, obj: THREE.Object3D | null): void {
    const old = this.layers.get(name);
    if (old) {
      this.overlayGroup.remove(old);
      old.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
      });
      this.layers.delete(name);
    }
    if (obj) {
      this.overlayGroup.add(obj);
      this.layers.set(name, obj);
    }
    this.request();
  }

  clearLayer(name: string): void {
    this.setLayer(name, null);
  }

  /** Filled triangles (9 floats per triangle) in a highlight style. */
  setTriangles(name: string, tris: number[], style: "select" | "hover" | "previewFill"): void {
    if (!tris.length) return this.setLayer(name, null);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tris), 3));
    this.setLayer(name, new THREE.Mesh(g, this.mat[style]));
  }

  /** Line segments (6 floats per segment). */
  setSegments(name: string, segs: number[], style: "selectEdge" | "preview" | "guide" | "box"): void {
    if (!segs.length) return this.setLayer(name, null);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
    const l = new THREE.LineSegments(g, this.mat[style]);
    if (style === "guide") l.computeLineDistances();
    this.setLayer(name, l);
  }

  /** A guide line in one of the axis colors (or the preview color). */
  setGuide(name: string, a: Vec3, b: Vec3, color: string): void {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    const mat = new THREE.LineDashedMaterial({ color, dashSize: 6, gapSize: 4, depthTest: false, transparent: true });
    const l = new THREE.Line(g, mat);
    l.computeLineDistances();
    this.setLayer(name, l);
  }

  request(): void {
    if (this.needsFrame) return;
    this.needsFrame = true;
    requestAnimationFrame(() => {
      this.needsFrame = false;
      const t0 = performance.now();
      this.renderer.render(this.scene, this.camera);
      this.onFrame?.(performance.now() - t0);
    });
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
