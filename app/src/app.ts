// The application shell: owns the model, the active editing context, selection,
// camera and tools, and implements ToolHost for them.

import { AXES, InferenceEngine, type Inference } from "./inference/engine";
import { Model, ROOT, type Entity } from "./kernel/model";
import { add, applyDir, apply, invert, IDENTITY, scale, type Mat4, type Vec3 } from "./math";
import { buildSample, buildStressTest } from "./samples";
import { EraseTool } from "./tools/erase";
import { LineTool } from "./tools/line";
import { MoveTool } from "./tools/move";
import { NavTool } from "./tools/nav";
import { PushPullTool } from "./tools/pushpull";
import { RectangleTool } from "./tools/rectangle";
import { SelectTool } from "./tools/select";
import { groupSelection, lockedMessage, surveyTags, SurveyPanel } from "./survey/mode";
import { exportProposed } from "./survey/plan-export";
import { errorMessage, Selection, type Overlay, type Tool, type ToolHost, type ToolPointer } from "./tools/tool";
import { formatLength, type UnitSystem } from "./units";
import { CameraModel } from "./view/camera";
import { SceneIndex } from "./view/scene";
import { Viewport } from "./view/viewport";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const MARKER_CLASS: Record<string, string> = {
  endpoint: "end",
  origin: "end",
  midpoint: "mid",
  onEdge: "edge",
  onFace: "face",
  axis: "axis",
  line: "face",
  plane: "face",
  ground: "face",
};

export class App implements ToolHost {
  model = new Model();
  ctx = ROOT;
  readonly camera = new CameraModel();
  readonly selection = new Selection();
  readonly inference: InferenceEngine;
  units: UnitSystem = "imperial";
  /** The tag new groups land on (Proposed in a survey model). */
  activeTag: number | null = null;

  private view: Viewport;
  private survey: SurveyPanel;
  private drawScene!: SceneIndex;
  private pickScene!: SceneIndex;
  private ctxMatrix: Mat4 = IDENTITY;
  private ctxInverse: Mat4 = IDENTITY;
  private tools: Record<string, Tool>;
  private tool!: Tool;
  private overlay: Overlay = {};
  private vcbTyping = false;
  private fileName = "model.builder";
  private savedRevision = 0;

  constructor() {
    this.view = new Viewport($("view"));
    this.inference = new InferenceEngine(() => this.pickScene, this.camera);
    const nav = () => this.cameraChanged();
    this.tools = {
      select: new SelectTool(this),
      line: new LineTool(this),
      rectangle: new RectangleTool(this),
      pushpull: new PushPullTool(this),
      move: new MoveTool(this),
      erase: new EraseTool(this),
      orbit: new NavTool(this, "orbit", nav),
      pan: new NavTool(this, "pan", nav),
    };
    this.survey = new SurveyPanel(this, $("survey"));
    this.survey.onExport = () => this.exportPlan();
    this.selection.onChange = () => {
      this.drawSelection();
      this.survey.update();
    };
    this.view.onFrame = (ms) => this.frameStats(ms);
    this.bindUi();
    this.readTheme();
    new ResizeObserver(() => this.resize()).observe($("view"));
    this.loadModel(buildSample(), "sample.builder");
    this.setTool("pushpull");
    this.resize();
  }

  // ---- ToolHost ----

  scene(): SceneIndex {
    return this.pickScene;
  }
  toLocal(p: Vec3): Vec3 {
    return apply(this.ctxInverse, p);
  }
  toLocalDir(d: Vec3): Vec3 {
    return applyDir(this.ctxInverse, d);
  }
  format = (inches: number): string => formatLength(inches, this.units);

  refresh(opts: { preview?: boolean } = {}): void {
    this.drawScene = SceneIndex.build(this.model, this.ctx);
    if (!opts.preview) {
      this.pickScene = this.drawScene;
      this.selection.prune(this.model);
      this.updateButtons();
      this.survey.update();
    }
    this.view.setScene(this.drawScene);
    this.drawSelection();
    this.drawOverlay();
  }

  show(overlay: Overlay): void {
    this.overlay = overlay;
    this.drawOverlay();
  }

  setVcb(text: string): void {
    if (!this.vcbTyping) $<HTMLInputElement>("vcb").value = text;
  }

  private toastTimer = 0;
  flash(message: string): void {
    const t = $("toast");
    const hover = this.overlay.hoverEntity ? [this.overlay.hoverEntity] : [];
    t.textContent = lockedMessage(this.drawScene, this.model, [...this.selection.items, ...hover], message);
    t.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove("show"), 1800);
  }

  hintChanged(): void {
    $("hint").textContent = this.tool.hint();
    $("vcbLabel").textContent = this.tool.vcbLabel();
  }

  enterGroup(instance: number): void {
    const info = this.model.instanceInfo(instance);
    if (!info) return;
    if (this.model.instanceProps(instance)?.locked) {
      this.selection.set([{ kind: "instance", id: instance }]);
      return this.flash("that is on a locked tag");
    }
    this.setContext(info.definition);
  }

  exitGroup(): void {
    if (this.ctx === ROOT) return;
    const path = this.pickScene.activePath;
    const inst = path[path.length - 1];
    const parent = inst === undefined ? ROOT : (this.model.instanceInfo(inst)?.parent ?? ROOT);
    this.setContext(parent);
    if (inst !== undefined) this.selection.set([{ kind: "instance", id: inst }]);
  }

  // ---- context ----

  private setContext(def: number): void {
    this.tool.deactivate();
    this.ctx = def;
    this.ctxMatrix = def === ROOT ? IDENTITY : this.model.worldTransform(def);
    this.ctxInverse = invert(this.ctxMatrix);
    this.selection.clear();
    this.refresh();
    const crumb = $("context");
    crumb.hidden = def === ROOT;
    crumb.textContent = "Editing group · Esc to close";
    this.hintChanged();
  }

  // ---- tools ----

  setTool(id: string): void {
    const next = this.tools[id];
    if (!next) return;
    this.tool?.deactivate();
    this.inference.unlock();
    this.tool = next;
    next.activate?.();
    document.querySelectorAll<HTMLButtonElement>(".tool").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === id)));
    this.view.canvas.style.cursor = next.cursor;
    this.overlay = {};
    this.drawOverlay();
    this.hintChanged();
  }

  // ---- model lifecycle ----

  loadModel(model: Model, name: string): void {
    this.tool?.deactivate();
    this.model = model;
    this.fileName = name;
    this.ctx = ROOT;
    this.ctxMatrix = IDENTITY;
    this.ctxInverse = IDENTITY;
    $("context").hidden = true;
    this.selection.clear();
    const tags = surveyTags(model);
    this.activeTag = tags ? tags.Proposed.id : null;
    this.refresh();
    this.savedRevision = this.model.revision;
    this.zoomExtents();
    if (tags) this.flash("Survey model: Existing and Demo are locked, new groups go on Proposed");
  }

  private undo(redo = false): void {
    this.tool.deactivate();
    const name = redo ? this.model.redo() : this.model.undo();
    if (name) this.flash(`${redo ? "Redo" : "Undo"} ${name}`);
    if (this.ctx !== ROOT && !this.model.definitions().includes(this.ctx)) this.setContext(ROOT);
    else this.refresh();
    this.hintChanged();
  }

  private eraseSelection(): void {
    if (this.selection.empty) return;
    const s = this.selection;
    try {
      this.model.transact("Erase", () => this.model.erase(s.ids("face"), s.ids("edge"), s.ids("instance")));
    } catch (e) {
      this.flash(errorMessage(e));
    }
    this.selection.clear();
    this.refresh();
  }

  private makeGroup(): void {
    const s = this.selection;
    if (s.empty) return this.flash("Select something to group first");
    try {
      const g = groupSelection(this.model, this.ctx, s, this.ctx === ROOT ? this.activeTag : null);
      this.refresh();
      this.selection.set([{ kind: "instance", id: g }]);
      const tag = this.activeTag !== null && this.ctx === ROOT ? this.model.tags().find((t) => t.id === this.activeTag) : null;
      this.flash(tag ? `Grouped on ${tag.name}` : "Grouped");
    } catch (e) {
      this.flash(errorMessage(e));
    }
  }

  private explode(): void {
    const insts = this.selection.ids("instance");
    if (!insts.length) return this.flash("Select a group to explode");
    const out: Entity[] = [];
    try {
      this.model.transact("Explode", () => {
        for (const i of insts) {
          const r = this.model.explode(i);
          out.push(...r.faces.map((id) => ({ kind: "face" as const, id })), ...r.edges.map((id) => ({ kind: "edge" as const, id })));
          out.push(...r.instances.map((id) => ({ kind: "instance" as const, id })));
        }
      });
    } catch (e) {
      this.flash(errorMessage(e));
    }
    this.refresh();
    this.selection.set(out);
  }

  private exportPlan(): void {
    const name = prompt("Plan name (model/plans/NAME.yaml)", "proposed");
    if (!name) return;
    const { yaml, skipped } = exportProposed(this.model, name);
    const blob = new Blob([yaml], { type: "application/yaml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.yaml`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.flash(skipped.length ? `Exported ${name}.yaml. Not exported (not axis-aligned boxes): ${skipped.join(", ")}` : `Exported ${name}.yaml`);
  }

  private selectAll(): void {
    const s = this.pickScene;
    const out: Entity[] = [];
    s.items.forEach((it, i) => {
      if (it.editable) {
        const b = s.buffers.get(it.def)!;
        new Set(b.faceIds).forEach((id) => out.push({ kind: "face", id }));
        b.edgeIds.forEach((id) => out.push({ kind: "edge", id }));
      } else if (it.pickInstance !== null && s.items.findIndex((x) => x.pickInstance === it.pickInstance) === i) {
        out.push({ kind: "instance", id: it.pickInstance });
      }
    });
    this.selection.set(out);
  }

  // ---- files ----

  private save(): void {
    const blob = new Blob([this.model.toJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = this.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.savedRevision = this.model.revision;
    this.flash(`Saved ${this.fileName}`);
  }

  private async open(file: File): Promise<void> {
    try {
      const model = Model.fromJson(await file.text());
      this.loadModel(model, file.name);
      this.flash(`Opened ${file.name}`);
    } catch (e) {
      this.flash(errorMessage(e));
    }
  }

  private confirmDiscard(): boolean {
    return this.model.revision === this.savedRevision || confirm("Discard unsaved changes to this model?");
  }

  // ---- drawing ----

  private zoomExtents(): void {
    const s = this.drawScene;
    if (s.empty) {
      this.camera.target = [0, 0, 0];
      this.camera.dist = 600;
    } else this.camera.fit(s.min, s.max);
    this.cameraChanged();
  }

  private cameraChanged(): void {
    this.view.syncCamera(this.camera);
    this.positionLabels();
  }

  private resize(): void {
    const r = $("view").getBoundingClientRect();
    this.camera.width = Math.max(1, r.width);
    this.camera.height = Math.max(1, r.height);
    this.view.resize();
    this.cameraChanged();
  }

  private readTheme(): void {
    const cs = getComputedStyle(document.documentElement);
    const g = (k: string) => cs.getPropertyValue(k).trim();
    this.view.setTheme({
      face: g("--face"),
      back: g("--back"),
      edge: g("--edge"),
      sel: g("--sel"),
      hover: g("--hover"),
      axes: [g("--ax-x"), g("--ax-y"), g("--ax-z")],
      preview: g("--fg"),
    });
    this.axisColors = [g("--ax-x"), g("--ax-y"), g("--ax-z")];
    this.previewColor = g("--muted");
  }
  private axisColors: string[] = ["red", "green", "blue"];
  private previewColor = "gray";

  /** Triangles and segments of an entity in world space, for highlighting. */
  private entityGeometry(e: Entity): { tris: number[]; segs: number[] } {
    const s = this.drawScene;
    const tris: number[] = [];
    const segs: number[] = [];
    if (e.kind === "face") {
      tris.push(...s.faceTriangles(s.editableItem(), e.id));
    } else if (e.kind === "edge") {
      for (let i = 0; i < s.segEdge.length; i++) {
        if (s.segEdge[i] === e.id && s.items[s.segItem[i]].editable) for (let k = 0; k < 6; k++) segs.push(s.seg[i * 6 + k]);
      }
    } else {
      // A box around every placement under the instance.
      const min: Vec3 = [Infinity, Infinity, Infinity];
      const max: Vec3 = [-Infinity, -Infinity, -Infinity];
      const grow = (x: number, y: number, z: number) => {
        const p = [x, y, z];
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], p[k]);
          max[k] = Math.max(max[k], p[k]);
        }
      };
      for (let i = 0; i < s.segEdge.length; i++) {
        if (s.items[s.segItem[i]].pickInstance === e.id) {
          grow(s.seg[i * 6], s.seg[i * 6 + 1], s.seg[i * 6 + 2]);
          grow(s.seg[i * 6 + 3], s.seg[i * 6 + 4], s.seg[i * 6 + 5]);
        }
      }
      if (min[0] <= max[0]) segs.push(...boxSegments(min, max));
    }
    return { tris, segs };
  }

  private drawSelection(): void {
    const tris: number[] = [];
    const segs: number[] = [];
    for (const e of this.selection.items) {
      const g = this.entityGeometry(e);
      tris.push(...g.tris);
      segs.push(...g.segs);
    }
    this.view.setTriangles("selection", tris, "select");
    this.view.setSegments("selectionEdges", segs, "selectEdge");
    const n = this.selection.items.length;
    $("selInfo").textContent = n ? `${n} selected` : "";
    this.updateButtons();
  }

  private drawOverlay(): void {
    const o = this.overlay;
    const v = this.view;
    if (o.hover) v.setTriangles("hover", this.drawScene.faceTriangles(o.hover.item, o.hover.face), "hover");
    else if (o.hoverEntity) {
      const g = this.entityGeometry(o.hoverEntity);
      v.setTriangles("hover", g.tris, "hover");
      v.setSegments("hoverEdges", g.segs, "box");
    } else v.clearLayer("hover");
    if (!o.hoverEntity) v.clearLayer("hoverEdges");
    v.setSegments("preview", (o.segments ?? []).flat(), "preview");
    if (o.fill && o.fill.length >= 3) {
      const f = o.fill;
      const tris: number[] = [];
      for (let i = 1; i + 1 < f.length; i++) tris.push(...f[0], ...f[i], ...f[i + 1]);
      v.setTriangles("fill", tris, "previewFill");
    } else v.clearLayer("fill");
    this.drawGuide(o.inference ?? null);
    this.positionLabels();
  }

  private drawGuide(r: Inference | null): void {
    // A dotted line from a matched point to where it was projected.
    if (r?.ref) this.view.setGuide("refGuide", r.ref.point, r.point, this.previewColor);
    else this.view.clearLayer("refGuide");
    if (r && r.from && (r.kind === "axis" || r.kind === "line")) {
      const color = r.axis !== undefined ? this.axisColors[r.axis] : this.previewColor;
      const dir = r.axis !== undefined ? AXES[r.axis] : null;
      if (dir) {
        const far = this.camera.dist * 4;
        this.view.setGuide("guide", add(r.from, scale(dir, -far)), add(r.from, scale(dir, far)), color);
      } else this.view.setGuide("guide", r.from, r.point, color);
    } else this.view.clearLayer("guide");
  }

  private positionLabels(): void {
    const o = this.overlay;
    const place = (el: HTMLElement, p: Vec3 | undefined, dx = 0, dy = 0, center = false) => {
      const s = p && this.camera.project(p);
      if (!s) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.style.transform = `translate(${s.x + dx}px, ${s.y + dy}px)${center ? " translate(-50%, -50%)" : ""}`;
    };
    const r = o.inference;
    const marker = $("marker");
    // Matched inferences mark the point they matched, like SketchUp.
    const mk = r?.ref ? { point: r.ref.point, kind: r.ref.kind, axis: undefined } : r;
    const showMarker = mk && mk.kind !== "ground" && mk.kind !== "plane" && mk.kind !== "line";
    marker.className = `ov marker ${mk ? MARKER_CLASS[mk.kind] : ""}${mk?.axis !== undefined ? ` ax${mk.axis}` : ""}`;
    place(marker, showMarker ? mk!.point : undefined, -6, -6);
    const tip = $("tip");
    tip.textContent = r?.label ?? "";
    place(tip, r?.label ? r.point : undefined, 14, 12);
    const dims = o.dims ?? [];
    ["dimA", "dimB"].forEach((id, i) => {
      const el = $(id);
      el.textContent = dims[i]?.text ?? "";
      place(el, dims[i]?.pos, 0, 0, true);
    });
    const mq = $("marquee");
    if (o.marquee) {
      const m = o.marquee;
      mq.hidden = false;
      mq.classList.toggle("crossing", m.crossing);
      Object.assign(mq.style, {
        left: `${Math.min(m.x0, m.x1)}px`,
        top: `${Math.min(m.y0, m.y1)}px`,
        width: `${Math.abs(m.x1 - m.x0)}px`,
        height: `${Math.abs(m.y1 - m.y0)}px`,
      });
    } else mq.hidden = true;
    const lock = $("lock");
    lock.hidden = !this.inference.locked;
    lock.textContent = this.inference.lockAxis !== null ? `Locked: ${["Red", "Green", "Blue"][this.inference.lockAxis]} axis` : "Locked";
  }

  private frameAvg = 0;
  private frameStats(ms: number): void {
    this.frameAvg = this.frameAvg ? this.frameAvg * 0.8 + ms * 0.2 : ms;
    const st = this.model.stats();
    $("perf").textContent = `${this.frameAvg.toFixed(1)} ms draw · ${st.faces.toLocaleString()} faces`;
  }

  private updateButtons(): void {
    $<HTMLButtonElement>("undoBtn").disabled = !this.model.canUndo();
    $<HTMLButtonElement>("redoBtn").disabled = !this.model.canRedo();
    $<HTMLButtonElement>("groupBtn").disabled = this.selection.empty;
    $<HTMLButtonElement>("explodeBtn").disabled = !this.selection.ids("instance").length;
  }

  // ---- input ----

  private pointer(ev: PointerEvent | MouseEvent | WheelEvent): ToolPointer {
    const r = this.view.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top, shift: ev.shiftKey, ctrl: ev.ctrlKey || ev.metaKey, alt: ev.altKey };
  }

  private bindUi(): void {
    const canvas = this.view.canvas;
    let drag: { mode: "tool" | "orbit" | "pan"; x: number; y: number; moved: boolean } | null = null;

    canvas.addEventListener("pointerdown", (ev) => {
      canvas.setPointerCapture(ev.pointerId);
      if (document.activeElement === $("vcb")) $("vcb").blur();
      const p = this.pointer(ev);
      if (ev.button === 1 || ev.button === 2) {
        drag = { mode: ev.shiftKey ? "pan" : "orbit", x: p.x, y: p.y, moved: false };
        canvas.style.cursor = "grabbing";
        ev.preventDefault();
        return;
      }
      if (ev.button !== 0) return;
      drag = { mode: "tool", x: p.x, y: p.y, moved: false };
      this.tool.down(p);
    });
    canvas.addEventListener("pointermove", (ev) => {
      const p = this.pointer(ev);
      if (drag && drag.mode !== "tool") {
        const dx = p.x - drag.x;
        const dy = p.y - drag.y;
        drag.x = p.x;
        drag.y = p.y;
        if (drag.mode === "orbit") this.camera.orbit(dx, dy);
        else this.camera.pan(dx, dy);
        this.cameraChanged();
        return;
      }
      if (drag && Math.hypot(p.x - drag.x, p.y - drag.y) > 6) drag.moved = true;
      this.tool.move(p);
    });
    canvas.addEventListener("pointerup", (ev) => {
      const d = drag;
      drag = null;
      canvas.style.cursor = this.tool.cursor;
      if (d?.mode === "tool") this.tool.up(this.pointer(ev), d.moved);
    });
    canvas.addEventListener("dblclick", (ev) => this.tool.doubleClick?.(this.pointer(ev)));
    canvas.addEventListener("pointerleave", () => {
      if (!drag && !this.tool.busy()) this.show({});
    });
    canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
    canvas.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const p = this.pointer(ev);
        const f = Math.exp(Math.max(-60, Math.min(60, ev.deltaY)) * 0.0022);
        const ray = this.camera.ray(p.x, p.y);
        const hit = this.drawScene.pick(ray, () => true);
        let at = hit?.point ?? null;
        if (!at) {
          const t = ray.dir[2] !== 0 ? -ray.origin[2] / ray.dir[2] : -1;
          at = t > 0 && t < this.camera.dist * 8 ? add(ray.origin, scale(ray.dir, t)) : this.camera.target;
        }
        this.camera.zoomToward(at, f);
        this.cameraChanged();
        if (!this.tool.busy() || this.tool.id !== "orbit") this.tool.move(p);
      },
      { passive: false },
    );

    document.querySelectorAll<HTMLButtonElement>(".tool").forEach((b) =>
      b.addEventListener("click", () => {
        this.setTool(b.dataset.tool!);
        b.blur();
      }),
    );
    const button = (id: string, fn: () => void) =>
      $(id).addEventListener("click", (e) => {
        fn();
        (e.currentTarget as HTMLElement).blur();
      });
    button("undoBtn", () => this.undo());
    button("redoBtn", () => this.undo(true));
    button("zoomBtn", () => this.zoomExtents());
    button("groupBtn", () => this.makeGroup());
    button("explodeBtn", () => this.explode());
    button("saveBtn", () => this.save());
    button("openBtn", () => this.confirmDiscard() && $<HTMLInputElement>("fileInput").click());
    button("newBtn", () => this.confirmDiscard() && this.loadModel(new Model(), "model.builder"));
    button("sampleBtn", () => this.confirmDiscard() && this.loadModel(buildSample(), "sample.builder"));
    button("stressBtn", () => {
      if (!this.confirmDiscard()) return;
      const t0 = performance.now();
      this.loadModel(buildStressTest(), "stress.builder");
      this.flash(`Loaded 2,000 boxes in ${Math.round(performance.now() - t0)} ms`);
    });
    button("unitsBtn", () => {
      this.units = this.units === "imperial" ? "metric" : "imperial";
      $("unitsBtn").textContent = this.units === "imperial" ? "Feet & inches" : "Metric";
      this.flash(this.units === "imperial" ? "Showing feet and inches" : "Showing millimetres");
    });
    $<HTMLInputElement>("fileInput").addEventListener("change", (ev) => {
      const input = ev.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) void this.open(file);
      input.value = "";
    });

    const vcb = $<HTMLInputElement>("vcb");
    vcb.addEventListener("input", () => (this.vcbTyping = true));
    vcb.addEventListener("blur", () => (this.vcbTyping = false));
    document.addEventListener("keydown", (ev) => this.keydown(ev));
    document.addEventListener("keyup", (ev) => {
      if (ev.key === "Shift" && this.inference.locked && this.inference.lockAxis === null) {
        this.inference.unlock();
        this.positionLabels();
      }
    });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.readTheme());
    window.addEventListener("beforeunload", (ev) => {
      if (this.model.revision !== this.savedRevision) ev.preventDefault();
    });
  }

  private keydown(ev: KeyboardEvent): void {
    const vcb = $<HTMLInputElement>("vcb");
    if (document.activeElement === vcb) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const text = vcb.value;
        this.vcbTyping = false;
        vcb.blur();
        this.tool.vcb(text);
        this.hintChanged();
      } else if (ev.key === "Escape") {
        this.vcbTyping = false;
        vcb.value = "";
        vcb.blur();
      }
      return;
    }
    const k = ev.key;
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && k.toLowerCase() === "z") {
      ev.preventDefault();
      return this.undo(ev.shiftKey);
    }
    if (mod && k.toLowerCase() === "y") {
      ev.preventDefault();
      return this.undo(true);
    }
    if (mod && k.toLowerCase() === "s") {
      ev.preventDefault();
      return this.save();
    }
    if (mod && k.toLowerCase() === "o") {
      ev.preventDefault();
      if (this.confirmDiscard()) $<HTMLInputElement>("fileInput").click();
      return;
    }
    if (mod && k.toLowerCase() === "a") {
      ev.preventDefault();
      this.setTool("select");
      return this.selectAll();
    }
    if (mod || ev.altKey) return;
    if ((document.activeElement as HTMLElement | null)?.tagName === "BUTTON" && (k === "Enter" || k === " ")) return;

    // Typing a number goes straight to the Measurements box.
    if (/^[0-9.'",\-/]$/.test(k)) {
      ev.preventDefault();
      vcb.value = (this.vcbTyping ? vcb.value : "") + k;
      this.vcbTyping = true;
      vcb.focus();
      vcb.setSelectionRange(vcb.value.length, vcb.value.length);
      return;
    }
    const arrows: Record<string, 0 | 1 | 2> = { ArrowRight: 0, ArrowLeft: 1, ArrowUp: 2 };
    if (k in arrows) {
      ev.preventDefault();
      this.inference.toggleAxisLock(arrows[k]);
      this.positionLabels();
      return;
    }
    if (k === "ArrowDown") {
      ev.preventDefault();
      this.inference.unlock();
      this.positionLabels();
      return;
    }
    if (k === "Shift" && !ev.repeat && this.tool.busy()) {
      if (this.inference.lockCurrent()) this.positionLabels();
      return;
    }
    if (this.tool.key?.(k, ev.shiftKey)) {
      this.hintChanged();
      return;
    }
    const keys: Record<string, string> = {
      " ": "select", l: "line", r: "rectangle", p: "pushpull", m: "move", e: "erase", o: "orbit", h: "pan",
    };
    if (k === " ") ev.preventDefault();
    if (k === "Z" && ev.shiftKey) return this.zoomExtents();
    if (keys[k.toLowerCase()]) return this.setTool(keys[k.toLowerCase()]);
    if (k === "g" || k === "G") return this.makeGroup();
    if (k === "Delete" || k === "Backspace") {
      ev.preventDefault();
      return this.eraseSelection();
    }
    if (k === "Escape") {
      if (this.ctx !== ROOT) this.exitGroup();
      else this.selection.clear();
    }
  }
}

function boxSegments(min: Vec3, max: Vec3): number[] {
  const c = (i: number): Vec3 => [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
  const pairs = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  return pairs.flatMap(([a, b]) => [...c(a), ...c(b)]);
}
