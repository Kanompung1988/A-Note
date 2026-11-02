import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Every record is a JSON document in a named collection. Two backends share one small interface:
// Supabase (the `docs` table, see supabase/migrations) when SUPABASE_URL is set, otherwise a JSON
// file in .data/ so the app runs locally with no setup.

export type Collection = "classes" | "assignments" | "students" | "asks" | "runs" | "work" | "ink";

export type Doc = { id: string; classId?: string };

/** Equality filters on document fields. */
export type Where = Record<string, string>;

export interface DocStore {
  find<T extends Doc>(collection: Collection, where?: Where): Promise<T[]>;
  get<T extends Doc>(collection: Collection, id: string): Promise<T | null>;
  /** inserts or replaces the document with the same id */
  put<T extends Doc>(collection: Collection, doc: T): Promise<T>;
  remove(collection: Collection, where: Where): Promise<void>;
}

export const DATA_DIR = process.env.A_NOTE_DATA_DIR ?? path.join(process.cwd(), ".data");

let supabaseClient: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  supabaseClient ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabaseClient;
}

function matches(doc: Doc, where: Where): boolean {
  return Object.entries(where).every(([k, v]) => (doc as Record<string, unknown>)[k] === v);
}

// ---- Supabase ----

const supabaseStore = (sb: SupabaseClient): DocStore => ({
  async find<T extends Doc>(collection: Collection, where: Where = {}) {
    let query = sb.from("docs").select("data").eq("collection", collection);
    for (const [k, v] of Object.entries(where)) query = k === "classId" ? query.eq("class_id", v) : query.eq(`data->>${k}`, v);
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) throw new Error(`store find ${collection}: ${error.message}`);
    return (data ?? []).map((row) => row.data as T);
  },
  async get<T extends Doc>(collection: Collection, id: string) {
    const { data, error } = await sb.from("docs").select("data").eq("collection", collection).eq("id", id).maybeSingle();
    if (error) throw new Error(`store get ${collection}: ${error.message}`);
    return data ? (data.data as T) : null;
  },
  async put<T extends Doc>(collection: Collection, doc: T) {
    const { error } = await sb
      .from("docs")
      .upsert({ collection, id: doc.id, class_id: doc.classId ?? null, data: doc, updated_at: new Date().toISOString() });
    if (error) throw new Error(`store put ${collection}: ${error.message}`);
    return doc;
  },
  async remove(collection: Collection, where: Where) {
    let query = sb.from("docs").delete().eq("collection", collection);
    for (const [k, v] of Object.entries(where)) query = k === "classId" ? query.eq("class_id", v) : k === "id" ? query.eq("id", v) : query.eq(`data->>${k}`, v);
    const { error } = await query;
    if (error) throw new Error(`store remove ${collection}: ${error.message}`);
  },
});

// ---- JSON file (local development) ----

type FileData = Partial<Record<Collection, Doc[]>>;
const FILE = path.join(DATA_DIR, "a-note.json");
let cache: FileData | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<FileData> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(FILE, "utf8")) as FileData;
  } catch {
    cache = {};
  }
  return cache;
}

async function save(data: FileData) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(data));
  await rename(tmp, FILE);
}

// Operations run one at a time so concurrent requests never interleave a read-modify-write.
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

const clone = <T>(value: T): T => structuredClone(value);

const fileStore: DocStore = {
  find: <T extends Doc>(collection: Collection, where: Where = {}) =>
    serial(async () => ((await load())[collection] ?? []).filter((d) => matches(d, where)).map((d) => clone(d) as T)),
  get: <T extends Doc>(collection: Collection, id: string) =>
    serial(async () => {
      const doc = ((await load())[collection] ?? []).find((d) => d.id === id);
      return doc ? (clone(doc) as T) : null;
    }),
  put: <T extends Doc>(collection: Collection, doc: T) =>
    serial(async () => {
      const data = await load();
      const list = (data[collection] ??= []);
      const i = list.findIndex((d) => d.id === doc.id);
      if (i >= 0) list[i] = clone(doc);
      else list.push(clone(doc));
      await save(data);
      return doc;
    }),
  remove: (collection: Collection, where: Where) =>
    serial(async () => {
      const data = await load();
      data[collection] = (data[collection] ?? []).filter((d) => !matches(d, where));
      await save(data);
    }),
};

let selected: DocStore | null = null;

export function db(): DocStore {
  if (selected) return selected;
  const sb = supabase();
  selected = sb ? supabaseStore(sb) : fileStore;
  return selected;
}
