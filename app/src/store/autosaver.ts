// Debounced autosave. Follows the model's commit points (`Model.onCommit`, which
// `abort()` never fires, so previews cost nothing) and writes one version to the
// store a few seconds after the last commit. The timer callback is the only place
// `toJson()` runs.

import type { Model } from "../kernel/model";
import type { AutosaveStore, VersionInfo } from "./autosave";

export const DEBOUNCE_MS = 3000;

export interface AutosaverOptions {
  store: Pick<AutosaveStore, "put" | "setDirty">;
  /** Default DEBOUNCE_MS. */
  debounceMs?: number;
  /** Default Date.now. */
  now?: () => number;
  /** Default globalThis.setTimeout / clearTimeout; tests inject a fake clock. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Default console.error. Store failures land here, never in the tool that committed. */
  onError?: (e: unknown) => void;
}

export class Autosaver {
  private readonly store: AutosaverOptions["store"];
  private readonly debounceMs: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly onError: (e: unknown) => void;

  private model?: Model;
  private fileName = "";
  private operation = "";
  private timer: unknown;
  private inflight?: Promise<VersionInfo | undefined>;
  /** Bumped by attach and markClean so a write that was in flight cannot re-dirty the store. */
  private generation = 0;

  constructor(opts: AutosaverOptions) {
    this.store = opts.store;
    this.debounceMs = opts.debounceMs ?? DEBOUNCE_MS;
    this.now = opts.now ?? Date.now;
    this.setTimer = opts.setTimer ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>));
    this.onError = opts.onError ?? ((e) => console.error(e));
  }

  /** A write is scheduled and has not run yet. */
  get pending(): boolean {
    return this.timer !== undefined;
  }

  /** Follow `model`: its commits schedule writes, the previous model's no longer
   *  do; cancels any pending write; `dirty` is what the store's flag becomes
   *  (false for a load from disk or a sample, true for a restored version). */
  async attach(model: Model, fileName: string, dirty = false): Promise<void> {
    if (this.model && this.model !== model) this.model.onCommit = undefined;
    this.cancel();
    this.generation++;
    this.model = model;
    this.fileName = fileName;
    model.onCommit = (operation) => this.schedule(operation);
    try {
      await this.store.setDirty(dirty);
    } catch (e) {
      this.onError(e);
    }
  }

  /** Restart the debounce; `operation` labels the eventual version. */
  schedule(operation: string): void {
    this.cancel();
    this.operation = operation;
    this.timer = this.setTimer(() => {
      this.timer = undefined;
      this.inflight = this.write();
    }, this.debounceMs);
  }

  /** Write now if a write is pending (or wait for one in flight); resolves with the version or undefined. */
  async flush(): Promise<VersionInfo | undefined> {
    if (this.pending) {
      this.cancel();
      this.inflight = this.write();
    }
    return this.inflight;
  }

  /** Cancel a pending write and clear the dirty flag. Called after Save. */
  async markClean(): Promise<void> {
    this.cancel();
    this.generation++;
    try {
      await this.store.setDirty(false);
    } catch (e) {
      this.onError(e);
    }
  }

  private cancel(): void {
    if (this.timer === undefined) return;
    this.clearTimer(this.timer);
    this.timer = undefined;
  }

  private async write(): Promise<VersionInfo | undefined> {
    const model = this.model;
    if (!model) return undefined;
    const generation = this.generation;
    try {
      const json = model.toJson();
      const v = await this.store.put({ time: this.now(), fileName: this.fileName, operation: this.operation, json });
      if (generation === this.generation) await this.store.setDirty(true);
      return v;
    } catch (e) {
      this.onError(e);
      return undefined;
    }
  }
}
