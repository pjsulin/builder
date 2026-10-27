// Survey mode: the minimal UI for a model written by `survey build`. A file with the
// tags Existing, Demo and Proposed is a survey model: Existing and Demo come locked,
// Proposed is the active tag that new groups land on, and the panel shows a tag
// strip (visibility, lock) and the selection's attributes. Milestone 3's tag panel,
// Entity Info and Outliner replace this without changing the kernel calls it makes.

import type { AttrKind, Attributes, Entity, Model, TagInfo } from "../kernel/model";
import type { Selection } from "../tools/tool";
import type { SceneIndex } from "../view/scene";

export const SURVEY_TAGS = ["Existing", "Demo", "Proposed"] as const;

export function surveyTags(m: Model): Record<(typeof SURVEY_TAGS)[number], TagInfo> | null {
  const tags = m.tags();
  const found = SURVEY_TAGS.map((name) => tags.find((t) => t.name === name));
  if (found.some((t) => !t)) return null;
  return { Existing: found[0]!, Demo: found[1]!, Proposed: found[2]! };
}

export function isSurveyModel(m: Model): boolean {
  return surveyTags(m) !== null;
}

/** Group the selection in `ctx`, on `tag` when there is one. One transaction. */
export function groupSelection(model: Model, ctx: number, selection: Selection, tag: number | null): number {
  return model.transact("Make Group", () => {
    const g = model.makeGroup(ctx, selection.ids("face"), selection.ids("edge"), selection.ids("instance"));
    if (tag !== null) model.setInstanceTag(g, tag);
    return g;
  });
}

/** The draw item an entity belongs to, in the scene's items. */
function itemOf(scene: SceneIndex, model: Model, e: Entity): number {
  if (e.kind === "instance") return scene.items.findIndex((it) => it.path[it.path.length - 1] === e.id);
  const owner = e.kind === "face" ? model.facePlane(e.id)?.owner : model.edgeInfo(e.id)?.owner;
  return owner === undefined ? -1 : scene.items.findIndex((it) => it.def === owner);
}

/**
 * The message for a refused edit: `Locked: Existing` when the entities touch a
 * locked tag, else the kernel's own message.
 */
export function lockedMessage(scene: SceneIndex, model: Model, entities: Entity[], raw: string): string {
  if (!/locked tag/i.test(raw)) return raw;
  const tags = new Map(model.tags().map((t) => [t.id, t]));
  const names = new Set<string>();
  for (const e of entities) {
    const i = itemOf(scene, model, e);
    if (i < 0) continue;
    // The nearest locked tag on the path to the item.
    const path = scene.items[i].path;
    for (let k = path.length - 1; k >= 0; k--) {
      const t = model.instanceProps(path[k])?.tag;
      const tag = t === null || t === undefined ? undefined : tags.get(t);
      if (tag?.locked) {
        names.add(tag.name);
        break;
      }
    }
  }
  if (!names.size) for (const t of tags.values()) if (t.locked) names.add(t.name);
  return names.size ? `Locked: ${[...names].join(", ")}` : raw;
}

/** The attributes shown for a selection: each target's namespaces, in order. */
export interface AttributeRow {
  target: string;
  kind: AttrKind;
  id: number;
  attributes: Attributes;
}

export function selectionAttributes(model: Model, selection: Selection): AttributeRow[] {
  const rows: AttributeRow[] = [];
  const seen = new Set<string>();
  const push = (target: string, kind: AttrKind, id: number) => {
    const key = `${kind}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    try {
      rows.push({ target, kind, id, attributes: model.attributes(kind, id) });
    } catch {
      // Gone since the selection was made; prune will drop it.
    }
  };
  for (const e of selection.items) {
    if (e.kind === "instance") {
      const info = model.instanceInfo(e.id);
      if (!info) continue;
      const name = model.instanceProps(e.id)?.name || model.definitionName(info.definition) || `group ${e.id}`;
      push(`${name} (instance)`, "instance", e.id);
      push(`${name} (definition)`, "definition", info.definition);
    } else if (e.kind === "face") {
      push(`face ${e.id}`, "face", e.id);
    }
  }
  return rows;
}

export interface SurveyHost {
  readonly model: Model;
  readonly selection: Selection;
  activeTag: number | null;
  /** The model changed outside a tool. */
  refresh(): void;
  flash(message: string): void;
}

/** The survey panel: a tag strip and a read-only attribute view. */
export class SurveyPanel {
  readonly root: HTMLElement;
  private strip: HTMLElement;
  private attrs: HTMLElement;
  onExport: (() => void) | null = null;

  constructor(
    private host: SurveyHost,
    container: HTMLElement,
  ) {
    this.root = container;
    container.innerHTML = `
      <h2>Survey</h2>
      <div class="tagstrip" id="tagStrip"></div>
      <div class="panel-actions"><button class="btn" id="exportPlanBtn" title="Write the groups on Proposed as a survey plan file">Export plan</button></div>
      <h3>Attributes</h3>
      <div class="attrs" id="attrView"></div>`;
    this.strip = container.querySelector("#tagStrip")!;
    this.attrs = container.querySelector("#attrView")!;
    container.querySelector("#exportPlanBtn")!.addEventListener("click", () => this.onExport?.());
  }

  /** Redraw from the model and selection. Hidden unless the model is a survey model. */
  update(): void {
    const { model } = this.host;
    const survey = isSurveyModel(model);
    this.root.hidden = !survey;
    if (!survey) return;
    this.strip.replaceChildren(...model.tags().map((t) => this.tagRow(t)));
    const rows = selectionAttributes(model, this.host.selection);
    if (!rows.length) {
      this.attrs.innerHTML = `<p class="muted">Select an element to see its attributes.</p>`;
      return;
    }
    this.attrs.replaceChildren(
      ...rows.map((r) => {
        const box = document.createElement("div");
        box.className = "attr-target";
        const h = document.createElement("h4");
        h.textContent = r.target;
        box.append(h);
        const namespaces = Object.keys(r.attributes);
        if (!namespaces.length) {
          const p = document.createElement("p");
          p.className = "muted";
          p.textContent = "none";
          box.append(p);
        }
        for (const ns of namespaces) {
          const dl = document.createElement("dl");
          for (const [k, v] of Object.entries(r.attributes[ns])) {
            const dt = document.createElement("dt");
            dt.textContent = `${ns}:${k}`;
            const dd = document.createElement("dd");
            dd.textContent = String(v);
            if (ns === "survey" && k === "approx" && v === true) dd.className = "approx";
            dl.append(dt, dd);
          }
          box.append(dl);
        }
        return box;
      }),
    );
  }

  private tagRow(t: TagInfo): HTMLElement {
    const row = document.createElement("label");
    row.className = "tag" + (t.id === this.host.activeTag ? " active" : "");
    const vis = document.createElement("input");
    vis.type = "checkbox";
    vis.checked = t.visible;
    vis.title = `Show ${t.name}`;
    vis.addEventListener("change", () => this.setFlags(t, vis.checked, t.locked));
    const name = document.createElement("span");
    name.textContent = t.name;
    const lock = document.createElement("button");
    lock.type = "button";
    lock.className = "lock" + (t.locked ? " on" : "");
    lock.textContent = t.locked ? "Locked" : "Unlocked";
    lock.title = t.locked ? `Unlock ${t.name}` : `Lock ${t.name}`;
    lock.addEventListener("click", (e) => {
      e.preventDefault();
      this.setFlags(t, t.visible, !t.locked);
    });
    row.append(vis, name, lock);
    return row;
  }

  private setFlags(t: TagInfo, visible: boolean, locked: boolean): void {
    const { model } = this.host;
    const what = visible !== t.visible ? (visible ? "Show" : "Hide") : locked ? "Lock" : "Unlock";
    model.transact(`${what} ${t.name}`, () => model.setTagFlags(t.id, visible, locked));
    this.host.refresh();
    this.host.flash(`${what} ${t.name}`);
  }
}
