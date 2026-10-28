import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { AutosaveStore, MAX_VERSIONS } from "../src/store/autosave";

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
