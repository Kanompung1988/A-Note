import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AskRecord, Assignment, ClassRoom, Student } from "./types";

// A JSON file is enough for a single-server demo and keeps the data easy to inspect.
// Every read and write goes through `read`/`write`, so swapping in a hosted database
// only touches this file and classes.ts.

export type Data = {
  classes: ClassRoom[];
  assignments: Assignment[];
  students: Student[];
  asks: AskRecord[];
};

export const DATA_DIR = process.env.A_NOTE_DATA_DIR ?? path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "a-note.json");

let cache: Data | null = null;
let queue: Promise<unknown> = Promise.resolve();

function empty(): Data {
  return { classes: [], assignments: [], students: [], asks: [] };
}

async function load(): Promise<Data> {
  if (cache) return cache;
  try {
    cache = { ...empty(), ...(JSON.parse(await readFile(FILE, "utf8")) as Partial<Data>) };
  } catch {
    cache = empty();
  }
  return cache;
}

async function save(data: Data) {
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

export function read<T>(fn: (data: Data) => T): Promise<T> {
  return serial(async () => fn(await load()));
}

export function write<T>(fn: (data: Data) => T): Promise<T> {
  return serial(async () => {
    const data = await load();
    const result = fn(data);
    await save(data);
    return result;
  });
}
