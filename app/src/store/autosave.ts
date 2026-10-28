// Autosaved versions of the open model in IndexedDB. One database holds a ring
// of whole `Model.toJson()` strings and a dirty flag that says whether a version
// was written since the last Save or load. The ring is bounded by a count and a
// byte budget; the newest version is never dropped.

export const MAX_VERSIONS = 10;
export const MAX_BYTES = 50 * 1024 * 1024;
export const DB_NAME = "builder";

const VERSIONS = "versions";
const META = "meta";
const DIRTY = "dirty";

/** One autosaved model. `bytes` is the UTF-8 length of `json`. */
export interface Version {
  /** IndexedDB autoIncrement key, ascending with time. */
  id: number;
  /** `Date.now()` at the write. */
  time: number;
  /** `App.fileName` at the write. */
  fileName: string;
  /** `Model.lastOperation` at the write ("Push/Pull", "Undo Move", ...). */
  operation: string;
  bytes: number;
  /** `Model.toJson()`. */
  json: string;
}
export type VersionInfo = Omit<Version, "json">;

export interface RingLimits {
  versions?: number;
  bytes?: number;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function info(v: Version): VersionInfo {
  const { id, time, fileName, operation, bytes } = v;
  return { id, time, fileName, operation, bytes };
}

export class AutosaveStore {
  private db?: Promise<IDBDatabase>;
  private readonly maxVersions: number;
  private readonly maxBytes: number;

  /** `factory` is injectable so tests pass fake-indexeddb's IDBFactory; `limits`
   *  so they can exercise the byte budget without multi-megabyte strings. */
  constructor(
    private readonly name = DB_NAME,
    private readonly factory: IDBFactory = indexedDB,
    limits: RingLimits = {},
  ) {
    this.maxVersions = limits.versions ?? MAX_VERSIONS;
    this.maxBytes = limits.bytes ?? MAX_BYTES;
  }

  private open(): Promise<IDBDatabase> {
    return (this.db ??= new Promise((resolve, reject) => {
      const req = this.factory.open(this.name, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore(VERSIONS, { keyPath: "id", autoIncrement: true });
        db.createObjectStore(META);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  /** Append a version, then drop the oldest until count <= MAX_VERSIONS and
   *  sum(bytes) <= MAX_BYTES; the version just written is never dropped. */
  async put(v: Omit<Version, "id" | "bytes">): Promise<VersionInfo> {
    const db = await this.open();
    const bytes = new TextEncoder().encode(v.json).byteLength;
    const tx = db.transaction(VERSIONS, "readwrite");
    const store = tx.objectStore(VERSIONS);
    const id = (await request(store.add({ ...v, bytes }))) as number;
    // Oldest first; the ring is small enough that reading it back is cheap next to the write.
    const ring = (await request(store.getAll())).map(info);
    let total = ring.reduce((n, r) => n + r.bytes, 0);
    while (ring.length > 1 && (ring.length > this.maxVersions || total > this.maxBytes)) {
      const oldest = ring.shift()!;
      total -= oldest.bytes;
      await request(store.delete(oldest.id));
    }
    await complete(tx);
    return { id, time: v.time, fileName: v.fileName, operation: v.operation, bytes };
  }

  /** Newest first, without json. */
  async list(): Promise<VersionInfo[]> {
    const db = await this.open();
    const all = await request(db.transaction(VERSIONS).objectStore(VERSIONS).getAll());
    return all.map(info).reverse();
  }

  async get(id: number): Promise<Version | undefined> {
    const db = await this.open();
    return request(db.transaction(VERSIONS).objectStore(VERSIONS).get(id));
  }

  async latest(): Promise<Version | undefined> {
    const db = await this.open();
    const cursor = await request(db.transaction(VERSIONS).objectStore(VERSIONS).openCursor(null, "prev"));
    return cursor?.value;
  }

  /** True when a version was written after the last Save or load. */
  async dirty(): Promise<boolean> {
    const db = await this.open();
    return (await request(db.transaction(META).objectStore(META).get(DIRTY))) === true;
  }

  async setDirty(dirty: boolean): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(META, "readwrite");
    tx.objectStore(META).put(dirty, DIRTY);
    await complete(tx);
  }

  async clear(): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([VERSIONS, META], "readwrite");
    tx.objectStore(VERSIONS).clear();
    tx.objectStore(META).clear();
    await complete(tx);
  }
}
