// Sync all *.postman_collection.json under ./services to Postman Cloud,
// writing/reading local postman-map.json for collection UIDs.
//
// Env:
//   POSTMAN_API_KEY        (required)
//   POSTMAN_WORKSPACE_ID   (optional; target workspace)
//
// Usage:
//   node --env-file=.env scripts/sync-postman.mjs

import fs from "fs/promises";
import path from "path";

const API = "https://api.getpostman.com";
const KEY = process.env.POSTMAN_API_KEY;
const WORKSPACE = process.env.POSTMAN_WORKSPACE_ID || "";
const ROOT = process.cwd();
const SERVICES_DIR = path.join(ROOT, "services");
const MAP_PATH = path.join(ROOT, "postman-map.json");

if (!KEY) {
  console.error("POSTMAN_API_KEY not set");
  process.exit(1);
}

async function readJsonSafe(p, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}

async function walkCollections(dir) {
  const out = [];
  async function walk(d) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && e.name.endsWith(".postman_collection.json")) {
        out.push(p);
      }
    }
  }
  await walk(dir);
  return out.sort();
}

function normalizeCollectionShape(obj) {
  // Accept either raw v2.1 or { collection: {...} }
  const col = obj.collection ? obj.collection : obj;
  col.schema ||=
    "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
  if (col.info) {
    for (const k of Object.keys(col.info)) {
      if (k.startsWith("_")) delete col.info[k];
    }
  }
  return col;
}

async function upsertCollection({ fileAbs, uid }) {
  const raw = await readJsonSafe(fileAbs);
  if (!raw) throw new Error(`Invalid JSON: ${fileAbs}`);
  const collection = normalizeCollectionShape(raw);
  const body = JSON.stringify({ collection });
  const headers = { "X-Api-Key": KEY, "Content-Type": "application/json" };

  if (!uid) {
    const qs = WORKSPACE ? `?workspace=${encodeURIComponent(WORKSPACE)}` : "";
    const res = await fetch(`${API}/collections${qs}`, {
      method: "POST",
      headers,
      body,
    });
    if (!res.ok)
      throw new Error(`POST failed ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return { uid: json.collection.uid, created: true };
  } else {
    const res = await fetch(`${API}/collections/${uid}`, {
      method: "PUT",
      headers,
      body,
    });
    if (!res.ok)
      throw new Error(`PUT failed ${res.status}: ${await res.text()}`);
    return { uid, created: false };
  }
}

// ---------- main ----------
(async () => {
  // 1) ensure map exists locally (create empty if missing)
  let map = await readJsonSafe(MAP_PATH, {});

  // 2) discover all collection files under ./services
  const files = await walkCollections(SERVICES_DIR);

  // 3) iterate and create/update in Postman
  let changed = false;
  for (const fileAbs of files) {
    const rel = path.relative(ROOT, fileAbs); // use file path as map key
    const entry = map[rel] || { file: rel, uid: "" };

    process.stdout.write(`→ ${rel} … `);
    try {
      const { uid, created } = await upsertCollection({
        fileAbs,
        uid: entry.uid,
      });
      if (!entry.uid) changed = true;
      entry.uid = uid;
      entry.file = rel; // keep path current
      map[rel] = entry;
      console.log(created ? `created uid=${uid}` : `updated uid=${uid}`);
    } catch (e) {
      console.error(`\n   ERROR: ${e.message}`);
      process.exitCode = 1;
    }
  }

  // prune entries not found on disk — disabled by default
  const diskKeys = new Set(files.map((f) => path.relative(ROOT, f)));
  for (const k of Object.keys(map)) {
    if (!diskKeys.has(k)) {
      delete map[k];
      changed = true;
    }
  }

  if (changed || !(await readJsonSafe(MAP_PATH))) {
    await fs.writeFile(MAP_PATH, JSON.stringify(map, null, 2) + "\n");
    console.log("\nUpdated postman-map.json with new/changed UIDs.");
  } else {
    console.log("\npostman-map.json already up to date.");
  }
})();
