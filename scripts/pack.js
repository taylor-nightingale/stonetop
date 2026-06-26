import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { PACKS, DOC_KEY_PREFIX } from "./packs.js";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId() {
	return Array.from({ length: 16 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

function slugToLabel(slug) {
	return slug.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// Recursively ensures folder docs exist for every subdirectory and that each
// item/sub-folder doc has its `folder` field pointing at the right parent.
//
// - srcDir:        directory being processed
// - parentId:      the Foundry folder _id this level belongs to (null = root)
// - folderType:    "Item" | "JournalEntry" — written into folder docs
// - rootFoldersDir: the single _folders/ dir at the top of this pack (all
//                   folder docs live there regardless of nesting depth)
// Folder docs whose slug matches no directory anywhere in the pack are "virtual"
// grouping folders — a parent category authored purely in the folder docs (e.g.
// regions nested under a "Regions" category that has no directory of its own).
// `ensureFolders` must not reparent a real folder back to root just because its
// category has no matching directory. Returns the set of such folder _ids.
async function collectVirtualFolderIds(src) {
	const foldersDir = path.join(src, "_folders");
	let files;
	try { files = await fs.readdir(foldersDir); } catch { return new Set(); }

	const dirNames = new Set();
	async function walkDirs(dir) {
		for (const e of await fs.readdir(dir, { withFileTypes: true })) {
			if (!e.isDirectory() || e.name.startsWith("_")) continue;
			dirNames.add(e.name);
			await walkDirs(path.join(dir, e.name));
		}
	}
	await walkDirs(src);

	const virtual = new Set();
	for (const f of files) {
		if (!f.endsWith(".json")) continue;
		if (dirNames.has(f.slice(0, -5))) continue; // directory-backed
		const doc = JSON.parse(await fs.readFile(path.join(foldersDir, f), "utf8"));
		virtual.add(doc._id);
	}
	return virtual;
}

async function ensureFolders(srcDir, parentId = null, folderType = "Item", rootFoldersDir = null, virtualFolderIds = new Set()) {
	if (!rootFoldersDir) rootFoldersDir = path.join(srcDir, "_folders");

	const entries = await fs.readdir(srcDir, { withFileTypes: true });
	const subdirs  = entries.filter(e => e.isDirectory() && !e.name.startsWith("_"));
	if (!subdirs.length) return;

	await fs.mkdir(rootFoldersDir, { recursive: true });

	for (const subdir of subdirs) {
		const slug       = subdir.name;
		const folderFile = path.join(rootFoldersDir, `${slug}.json`);

		// Read existing doc or create a fresh one.
		let folderDoc;
		try {
			folderDoc = JSON.parse(await fs.readFile(folderFile, "utf8"));
		} catch {
			const id  = randomId();
			folderDoc = {
				name: slugToLabel(slug),
				type: folderType,
				description: "",
				folder: null,
				sorting: "a",
				sort: 0,
				color: null,
				flags: {},
				_id: id,
				_key: `!folders!${id}`,
			};
			console.log(`  Created folder: ${folderDoc.name}`);
		}

		// Sync parent reference — but don't clobber a parent that points at a
		// virtual grouping folder (a category authored in the folder docs, with no
		// directory of its own).
		const parentIsVirtual = folderDoc.folder && virtualFolderIds.has(folderDoc.folder);
		if (!parentIsVirtual && folderDoc.folder !== (parentId ?? null)) {
			folderDoc.folder = parentId ?? null;
		}
		await fs.writeFile(folderFile, JSON.stringify(folderDoc, null, 2));

		const folderId   = folderDoc._id;
		const subDirPath = path.join(srcDir, slug);
		const subEntries = await fs.readdir(subDirPath, { withFileTypes: true });
		const subSubdirs = subEntries.filter(e => e.isDirectory() && !e.name.startsWith("_"));

		if (subSubdirs.length > 0) {
			// Nested pack — recurse; sub-folder docs live in the same rootFoldersDir.
			await ensureFolders(subDirPath, folderId, folderType, rootFoldersDir, virtualFolderIds);
		} else {
			// Flat — assign every item doc to this folder.
			const files = subEntries.filter(e => !e.isDirectory() && e.name.endsWith(".json"));
			for (const file of files) {
				const filepath = path.join(subDirPath, file.name);
				const doc = JSON.parse(await fs.readFile(filepath, "utf8"));
				if (doc.folder === folderId) continue;
				doc.folder = folderId;
				await fs.writeFile(filepath, JSON.stringify(doc, null, 2));
			}
		}
	}
}

// Stamps _id/_key onto every embedded doc in `collection` (e.g. an actor's
// items/effects), matching the foundryvtt-cli key scheme so compilePack can
// write each as its own LevelDB record. Returns true if anything changed.
function ensureEmbeddedKeys(doc, parentId, parentCollection, collection) {
	const arr = doc[collection];
	if (!Array.isArray(arr)) return false;
	let changed = false;
	for (const embedded of arr) {
		if (!embedded._id) { embedded._id = randomId(); changed = true; }
		const key = `!${parentCollection}.${collection}!${parentId}.${embedded._id}`;
		if (embedded._key !== key) { embedded._key = key; changed = true; }
	}
	return changed;
}

async function ensureIds(srcDir, keyPrefix = "items") {
	const entries = await fs.readdir(srcDir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(srcDir, entry.name);
		if (entry.isDirectory()) {
			await ensureIds(full, keyPrefix);
			continue;
		}
		if (!entry.name.endsWith(".json")) continue;
		let doc;
		try {
			doc = JSON.parse(await fs.readFile(full, "utf8"));
		} catch (e) {
			throw new Error("Failed parsing " + full, { cause: e });
		}

		let changed = false;
		if (!doc._id)  { doc._id = randomId(); changed = true; }
		if (!doc._key) { doc._key = `!${keyPrefix}!${doc._id}`; changed = true; }
		// Actor packs store embedded items/effects as their own keyed records.
		if (keyPrefix === "actors") {
			changed = ensureEmbeddedKeys(doc, doc._id, "actors", "items")   || changed;
			changed = ensureEmbeddedKeys(doc, doc._id, "actors", "effects") || changed;
		}
		if (changed) {
			await fs.writeFile(full, JSON.stringify(doc, null, 2));
			console.log(`  Assigned ID/keys to ${entry.name}`);
		}
	}
}

async function main() {
	// Optional CLI filter: `node scripts/pack.js stonetop-journal [...]` rebuilds
	// only the named pack(s). With no args every pack is rebuilt. Handy when one
	// pack's LevelDB is locked (e.g. open in Foundry) but another needs recompiling.
	const only = new Set(process.argv.slice(2));
	for (const { name: pack, type: packType, sources } of PACKS) {
		if (only.size && !only.has(pack)) continue;
		// One published pack may be assembled from several source dirs (see PACKS);
		// each is folder/id-normalised on its own, then all compile into one dest.
		const srcDirs = (sources ?? [pack]).map(s => `packs/src/${s}`);
		const present = [];
		for (const src of srcDirs) {
			try { await fs.access(src); present.push(src); }
			catch { console.log(`Skipping source ${src} — not found`); }
		}
		if (!present.length) {
			console.log(`Skipping ${pack} — no source directories`);
			continue;
		}

		// Normalise each source dir in place (folder docs + ids), as the generators do.
		for (const src of present) {
			const virtualFolderIds = await collectVirtualFolderIds(src);
			await ensureFolders(src, null, packType, null, virtualFolderIds);
			await ensureIds(src, DOC_KEY_PREFIX[packType] ?? "items");
		}

		const dest = `packs/${pack}`;
		await fs.rm(dest, { recursive: true, force: true });
		await fs.mkdir(dest, { recursive: true });

		// compilePack clears its dest on each call, so it can't accumulate across
		// several sources. For a multi-source pack, stage every (already-normalised)
		// source tree into one temp dir — folder/entry ids are globally unique, so
		// they coexist — then compile that once. A single-source pack compiles direct.
		let compileSrc = present[0];
		let staging = null;
		if (present.length > 1) {
			staging = await fs.mkdtemp(path.join(os.tmpdir(), `${pack}-`));
			for (const src of present) {
				await fs.cp(src, path.join(staging, path.basename(src)), { recursive: true });
			}
			compileSrc = staging;
		}

		try {
			await compilePack(compileSrc, dest, { nedb: false, log: true, recursive: true });
		} catch (err) {
			// Node v24 + abstract-level teardown race: iterator cleanup races with DB close.
			// All files are written before this throws, so it's safe to ignore.
			if (err.code !== "LEVEL_ITERATOR_NOT_OPEN") throw err;
		} finally {
			if (staging) await fs.rm(staging, { recursive: true, force: true });
		}
	}
}

// process.exit prevents a Node v24 / abstract-level teardown race where open
// iterators are garbage-collected after the DB closes, causing a spurious crash.
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
