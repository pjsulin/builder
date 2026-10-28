import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Model, ROOT } from "../src/kernel/model";
import { buildStressTest } from "../src/samples";
import { AutosaveStore, MAX_VERSIONS } from "../src/store/autosave";
import { Autosaver, DEBOUNCE_MS } from "../src/store/autosaver";
import { newModel } from "./helpers";

/** A hand-rolled timer so the debounce is driven by the test, not the wall clock. */
class FakeClock {
  time = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  private next = 1;
  set = (fn: () => void, ms: number): unknown => {
    const id = this.next++;
    this.timers.set(id, { at: this.time + ms, fn });
    return id;
  };
  clear = (handle: unknown): void => {
    this.timers.delete(handle as number);
  };
  /** Run every timer due within `ms`, in order, then move the clock. */
  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      let due: [number, { at: number; fn: () => void }] | undefined;
      for (const t of this.timers) if (t[1].at <= end && (!due || t[1].at < due[1].at)) due = t;
      if (!due) break;
      this.timers.delete(due[0]);
      this.time = due[1].at;
      due[1].fn();
    }
    this.time = end;
  }
}

let store: AutosaveStore;

const version = (n: number, json = `{"n":${n}}`) => ({ time: 1000 + n, fileName: "shed.builder", operation: `Op ${n}`, json });

beforeEach(() => {
  store = new AutosaveStore("test", new IDBFactory());
});

describe("AutosaveStore ring", () => {
  it("keeps the last MAX_VERSIONS and drops the oldest", async () => {
    for (let n = 1; n <= 12; n++) await store.put(version(n));
    const list = await store.list();
    expect(list).toHaveLength(MAX_VERSIONS);
    expect(list.map((v) => v.id)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
    expect(await store.get(1)).toBeUndefined();
    expect(await store.get(2)).toBeUndefined();
    expect((await store.get(3))!.json).toBe('{"n":3}');
  });

  it("drops the oldest until under the byte budget, never the newest", async () => {
    const small = new AutosaveStore("budget", new IDBFactory(), { bytes: 150 });
    const json = "x".repeat(60);
    await small.put(version(1, json));
    await small.put(version(2, json));
    expect((await small.list()).map((v) => v.id)).toEqual([2, 1]);
    await small.put(version(3, json));
    expect((await small.list()).map((v) => v.id)).toEqual([3, 2]);
    // One version over the budget on its own still stays: it is the one just written.
    const big = await small.put(version(4, "y".repeat(500)));
    expect(big.bytes).toBe(500);
    expect((await small.list()).map((v) => v.id)).toEqual([4]);
  });

  it("measures bytes as UTF-8", async () => {
    const put = await store.put(version(1, "é"));
    expect(put.bytes).toBe(2);
    expect((await store.get(put.id))!.bytes).toBe(2);
  });

  it("lists newest first without json and returns the latest", async () => {
    for (let n = 1; n <= 3; n++) await store.put(version(n));
    const list = await store.list();
    expect(list.map((v) => v.operation)).toEqual(["Op 3", "Op 2", "Op 1"]);
    expect(list[0]).toEqual({ id: 3, time: 1003, fileName: "shed.builder", operation: "Op 3", bytes: 7 });
    expect(list[0]).not.toHaveProperty("json");
    const latest = await store.latest();
    expect(latest).toMatchObject({ id: 3, operation: "Op 3", json: '{"n":3}' });
  });

  it("is empty before any put", async () => {
    expect(await store.list()).toEqual([]);
    expect(await store.latest()).toBeUndefined();
    expect(await store.get(1)).toBeUndefined();
  });

  it("round-trips the dirty flag, false by default", async () => {
    expect(await store.dirty()).toBe(false);
    await store.setDirty(true);
    expect(await store.dirty()).toBe(true);
    await store.setDirty(false);
    expect(await store.dirty()).toBe(false);
  });

  it("clear drops every version and the dirty flag", async () => {
    await store.put(version(1));
    await store.setDirty(true);
    await store.clear();
    expect(await store.list()).toEqual([]);
    expect(await store.dirty()).toBe(false);
  });

  it("keeps separate databases apart", async () => {
    const factory = new IDBFactory();
    const a = new AutosaveStore("a", factory);
    const b = new AutosaveStore("b", factory);
    await a.put(version(1));
    expect(await b.list()).toEqual([]);
  });
});

describe("Autosaver", () => {
  let clock: FakeClock;
  let saver: Autosaver;

  beforeEach(() => {
    clock = new FakeClock();
    saver = new Autosaver({ store, setTimer: clock.set, clearTimer: clock.clear, now: () => 1000 + clock.time });
  });

  it("writes once after commit plus the debounce, never during previews", async () => {
    newModel();
    const model = buildStressTest();
    await saver.attach(model, "stress.builder");
    const toJson = vi.spyOn(model, "toJson");
    const face = model.buffers(ROOT).faceIds[0];
    for (let i = 0; i < 50; i++) {
      model.abort();
      model.begin("Push/Pull");
      model.pushPull(face, i + 1);
    }
    expect(toJson).not.toHaveBeenCalled();
    expect(saver.pending).toBe(false);
    expect(model.commit()).toBe(true);
    expect(saver.pending).toBe(true);
    clock.advance(DEBOUNCE_MS - 1);
    expect(toJson).not.toHaveBeenCalled();
    expect(await store.list()).toEqual([]);
    const t0 = performance.now();
    clock.advance(1);
    const sync = performance.now() - t0;
    expect(toJson).toHaveBeenCalledTimes(1);
    expect(sync).toBeLessThan(100);
    const v = await saver.flush();
    expect(v).toMatchObject({ operation: "Push/Pull", fileName: "stress.builder", time: 1000 + DEBOUNCE_MS });
    expect((await store.list())[0]).toMatchObject({ operation: "Push/Pull", fileName: "stress.builder" });
    expect(await store.dirty()).toBe(true);
    expect(toJson).toHaveBeenCalledTimes(1);
  });

  it("labels undo and redo versions and restarts the debounce on each commit", async () => {
    const model = newModel();
    await saver.attach(model, "shed.builder");
    model.transact("Line", () => model.addLine(ROOT, [0, 0, 0], [10, 0, 0]));
    clock.advance(2000);
    model.transact("Line", () => model.addLine(ROOT, [10, 0, 0], [10, 10, 0]));
    clock.advance(2000);
    expect(await store.list()).toEqual([]);
    clock.advance(1000);
    await saver.flush();
    expect((await store.list()).map((v) => v.operation)).toEqual(["Line"]);
    expect(model.undo()).toBe("Line");
    clock.advance(DEBOUNCE_MS);
    await saver.flush();
    expect(model.redo()).toBe("Line");
    clock.advance(DEBOUNCE_MS);
    await saver.flush();
    expect((await store.list()).map((v) => v.operation)).toEqual(["Redo Line", "Undo Line", "Line"]);
  });

  it("flush writes a pending version now", async () => {
    const model = newModel();
    await saver.attach(model, "shed.builder");
    model.transact("Line", () => model.addLine(ROOT, [0, 0, 0], [10, 0, 0]));
    const v = await saver.flush();
    expect(v?.operation).toBe("Line");
    expect(saver.pending).toBe(false);
    expect(await saver.flush()).toBe(v);
    expect(await store.list()).toHaveLength(1);
  });

  it("does not schedule for an empty commit or an abort", async () => {
    const model = newModel();
    await saver.attach(model, "shed.builder");
    model.begin("Nothing");
    model.abort();
    model.begin("Nothing");
    model.commit();
    expect(saver.pending).toBe(false);
    expect(model.undo()).toBeUndefined();
    expect(saver.pending).toBe(false);
  });

  it("markClean cancels a pending write and clears dirty", async () => {
    const model = newModel();
    await saver.attach(model, "shed.builder");
    model.transact("Line", () => model.addLine(ROOT, [0, 0, 0], [10, 0, 0]));
    clock.advance(DEBOUNCE_MS);
    await saver.flush();
    expect(await store.dirty()).toBe(true);
    model.transact("Line", () => model.addLine(ROOT, [10, 0, 0], [10, 10, 0]));
    expect(saver.pending).toBe(true);
    await saver.markClean();
    expect(saver.pending).toBe(false);
    expect(await store.dirty()).toBe(false);
    clock.advance(DEBOUNCE_MS);
    expect(await store.list()).toHaveLength(1);
  });

  it("attach to a new model stops writes for the old one and sets the dirty flag as asked", async () => {
    const old = newModel();
    await saver.attach(old, "old.builder");
    old.transact("Line", () => old.addLine(ROOT, [0, 0, 0], [10, 0, 0]));
    expect(saver.pending).toBe(true);
    const next = Model.fromJson(old.toJson());
    await saver.attach(next, "next.builder", true);
    expect(saver.pending).toBe(false);
    expect(await store.dirty()).toBe(true);
    old.transact("Line", () => old.addLine(ROOT, [10, 0, 0], [10, 10, 0]));
    expect(saver.pending).toBe(false);
    next.transact("Line", () => next.addLine(ROOT, [10, 0, 0], [10, 10, 0]));
    clock.advance(DEBOUNCE_MS);
    await saver.flush();
    expect((await store.list()).map((v) => v.fileName)).toEqual(["next.builder"]);
    await saver.attach(newModel(), "sample.builder", false);
    expect(await store.dirty()).toBe(false);
  });

  it("reports store failures through onError instead of throwing", async () => {
    const errors: unknown[] = [];
    const failing = {
      put: () => Promise.reject(new Error("quota exceeded")),
      setDirty: () => Promise.resolve(),
    };
    const s = new Autosaver({ store: failing, setTimer: clock.set, clearTimer: clock.clear, onError: (e) => errors.push(e) });
    const model = newModel();
    await s.attach(model, "shed.builder");
    model.transact("Line", () => model.addLine(ROOT, [0, 0, 0], [10, 0, 0]));
    clock.advance(DEBOUNCE_MS);
    expect(await s.flush()).toBeUndefined();
    expect(errors.map((e) => (e as Error).message)).toEqual(["quota exceeded"]);
  });
});
