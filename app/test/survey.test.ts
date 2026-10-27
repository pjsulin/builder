import { describe, expect, it } from "vitest";
import { ROOT, type Model } from "../src/kernel/model";
import { groupSelection, isSurveyModel, lockedMessage, selectionAttributes, surveyTags } from "../src/survey/mode";
import { EraseTool } from "../src/tools/erase";
import { MoveTool } from "../src/tools/move";
import { PushPullTool } from "../src/tools/pushpull";
import { RectangleTool } from "../src/tools/rectangle";
import { SelectTool } from "../src/tools/select";
import { newModel } from "./helpers";
import { TestHost } from "./toolhost";

function facesIn(m: Model, x0: number, y0: number, x1: number, y1: number): number[] {
  const e = 1e-6;
  return [...new Set(m.buffers(ROOT).faceIds)].filter((f) =>
    m.faceOuter(f).every((v) => v[0] >= x0 - e && v[0] <= x1 + e && v[1] >= y0 - e && v[1] <= y1 + e),
  );
}

/**
 * A survey-shaped model: a 100" x 8" x 90" wall on Existing (locked), a 40" x 40"
 * x 40" box on Demo (locked), and an empty Proposed tag.
 */
function surveyHost(): { h: TestHost; wall: number; tags: NonNullable<ReturnType<typeof surveyTags>> } {
  const m = newModel();
  const box = (x0: number, y0: number, w: number, l: number, h: number) => {
    m.addLine(ROOT, [x0, y0, 0], [x0 + w, y0, 0]);
    m.addLine(ROOT, [x0 + w, y0, 0], [x0 + w, y0 + l, 0]);
    m.addLine(ROOT, [x0 + w, y0 + l, 0], [x0, y0 + l, 0]);
    m.addLine(ROOT, [x0, y0 + l, 0], [x0, y0, 0]);
    m.pushPull(facesIn(m, x0, y0, x0 + w, y0 + l)[0], -h);
    return m.makeGroup(ROOT, facesIn(m, x0, y0, x0 + w, y0 + l), [], []);
  };
  const wall = box(0, 0, 100, 8, 90);
  const demo = box(200, 0, 40, 40, 40);
  const existing = m.newTag("Existing");
  const demoTag = m.newTag("Demo");
  m.newTag("Proposed");
  m.setInstanceTag(wall, existing);
  m.setInstanceTag(demo, demoTag);
  m.setTagFlags(existing, true, true);
  m.setTagFlags(demoTag, true, true);
  const def = m.instanceInfo(wall)!.definition;
  m.setAttribute("definition", def, "survey", "kind", "wall");
  m.setAttribute("definition", def, "survey", "approx", true);
  m.commit();
  const h = new TestHost(m);
  h.camera.target = [100, 20, 40];
  h.camera.dist = 900;
  h.refresh();
  return { h, wall, tags: surveyTags(m)! };
}

describe("survey mode", () => {
  it("recognises a survey model by its tags", () => {
    const { h } = surveyHost();
    expect(isSurveyModel(h.model)).toBe(true);
    expect(isSurveyModel(newModel())).toBe(false);
  });

  it("refuses Move on Existing with a Locked message", () => {
    const { h, wall } = surveyHost();
    h.selection.set([{ kind: "instance", id: wall }]);
    const before = h.model.toJson();
    const move = new MoveTool(h);
    h.click(move, [50, 0, 45]);
    expect(h.flashes.at(-1)).toBe("Locked: Existing");
    h.click(move, [50, -30, 45]);
    expect(h.model.toJson()).toBe(before);
    expect(move.busy()).toBe(false);
  });

  it("does not offer locked faces to Push/Pull or the Eraser", () => {
    const { h } = surveyHost();
    const faces = h.model.stats().faces;
    const pp = new PushPullTool(h);
    h.click(pp, [50, 0, 45]);
    expect(pp.busy()).toBe(false);
    const erase = new EraseTool(h);
    h.click(erase, [50, 0, 45]);
    expect(h.model.stats().faces).toBe(faces);
    expect(h.overlay.hoverEntity ?? null).toBeNull();
  });

  it("still lets Select pick a locked wall and shows its attributes", () => {
    const { h, wall } = surveyHost();
    const sel = new SelectTool(h);
    h.click(sel, [50, 0, 45]);
    expect(h.selection.items).toEqual([{ kind: "instance", id: wall }]);
    const rows = selectionAttributes(h.model, h.selection);
    expect(rows.map((r) => r.kind)).toEqual(["instance", "definition"]);
    expect(rows[1].attributes).toEqual({ survey: { kind: "wall", approx: true } });
    // Entering the locked group is refused by the app; the host used here just records it.
    expect(h.model.instanceProps(wall)!.locked).toBe(true);
  });

  it("puts a new group on Proposed and leaves it editable", () => {
    const { h, tags } = surveyHost();
    const rect = new RectangleTool(h);
    h.click(rect, [20, -60, 0]);
    h.click(rect, [50, -30, 0]);
    h.refresh();
    const pp = new PushPullTool(h);
    h.click(pp, [35, -45, 0]);
    pp.vcb("34\"");
    h.refresh();
    h.selection.set(facesIn(h.model, 20, -60, 50, -30).map((id) => ({ kind: "face" as const, id })));
    const g = groupSelection(h.model, ROOT, h.selection, tags.Proposed.id);
    h.refresh();
    expect(h.model.instanceProps(g)).toMatchObject({ tag: tags.Proposed.id, locked: false });
    h.model.undo();
    expect(h.model.instanceInfo(g)).toBeNull();
    h.model.redo();
    expect(h.model.instanceProps(g)!.tag).toBe(tags.Proposed.id);
    h.refresh();
    h.selection.set([{ kind: "instance", id: g }]);
    const move = new MoveTool(h);
    h.click(move, [35, -45, 34]);
    h.hover(move, [35, -45, 44]);
    move.vcb("10\"");
    expect(h.flashes.at(-1) ?? "").not.toMatch(/Locked/);
    expect(h.model.worldTransform(h.model.instanceInfo(g)!.definition)[14]).toBeCloseTo(10);
  });

  it("hides a tag's items and journals the flags", () => {
    const { h, tags } = surveyHost();
    const tris = h.scene().triFace.length;
    h.model.transact("Hide Existing", () => h.model.setTagFlags(tags.Existing.id, false, true));
    h.refresh();
    expect(h.scene().triFace.length).toBe(tris - 12);
    expect(h.scene().items.some((it) => it.tag === tags.Existing.id)).toBe(false);
    h.model.undo();
    h.refresh();
    expect(h.scene().triFace.length).toBe(tris);
  });

  it("names the locked tag in the message, from the hovered entity too", () => {
    const { h, wall } = surveyHost();
    const raw = "That is on a locked tag";
    expect(lockedMessage(h.scene(), h.model, [{ kind: "instance", id: wall }], raw)).toBe("Locked: Existing");
    expect(lockedMessage(h.scene(), h.model, [], "Nothing selected")).toBe("Nothing selected");
  });
});
