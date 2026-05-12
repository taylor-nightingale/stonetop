import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";
import path from "path";
import { PACKS } from "./packs.js";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId() {
	return Array.from({ length: 16 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

async function ensureFolders(srcDir) {
	const entries = await fs.readdir(srcDir, { withFileTypes: true });
	const subdirs = entries.filter(e => e.isDirectory() && !e.name.startsWith("_"));
	if (!subdirs.length) return;

	const foldersDir = path.join(srcDir, "_folders");
	await fs.mkdir(foldersDir, { recursive: true });

	for (const subdir of subdirs) {
		const slug = subdir.name;
		const name = slug.replace(/_/g, " ");
		const folderFile = path.join(foldersDir, `${slug}.json`);

		let folderId;
		try {
			const existing = JSON.parse(await fs.readFile(folderFile, "utf8"));
			folderId = existing._id;
		} catch {
			folderId = randomId();
			const folderDoc = { name, type: "Item", description: "", folder: null, sorting: "a", sort: 0, color: null, flags: {}, _id: folderId, _key: `!folders!${folderId}` };
			await fs.writeFile(folderFile, JSON.stringify(folderDoc, null, 2));
			console.log(`  Created folder: ${name}`);
		}

		const moveDir = path.join(srcDir, slug);
		const files = (await fs.readdir(moveDir)).filter(f => f.endsWith(".json"));
		for (const file of files) {
			const filepath = path.join(moveDir, file);
			const doc = JSON.parse(await fs.readFile(filepath, "utf8"));
			if (doc.folder === folderId) continue;
			doc.folder = folderId;
			await fs.writeFile(filepath, JSON.stringify(doc, null, 2));
		}
	}
}

async function ensureIds(srcDir) {
	const entries = await fs.readdir(srcDir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(srcDir, entry.name);
		if (entry.isDirectory()) {
			await ensureIds(full);
			continue;
		}
		if (!entry.name.endsWith(".json")) continue;
		const doc = JSON.parse(await fs.readFile(full, "utf8"));
		if (doc._id && doc._key) continue;
		doc._id ??= randomId();
		doc._key ??= `!items!${doc._id}`;
		await fs.writeFile(full, JSON.stringify(doc, null, 2));
		console.log(`  Assigned ID to ${entry.name}`);
	}
}

async function main() {
	for (const pack of PACKS) {
		const src = `packs/src/${pack}`;
		try {
			await fs.access(src);
		} catch {
			console.log(`Skipping ${pack} — no source directory at ${src}`);
			continue;
		}
		await ensureFolders(src);
		await ensureIds(src);
		const dest = `packs/${pack}`;
		await fs.rm(dest, { recursive: true, force: true });
		await fs.mkdir(dest, { recursive: true });
		try {
			await compilePack(src, dest, { nedb: false, log: true, recursive: true });
		} catch (err) {
			// Node v24 + abstract-level teardown race: iterator cleanup races with DB close.
			// All files are written before this throws, so it's safe to ignore.
			if (err.code !== "LEVEL_ITERATOR_NOT_OPEN") throw err;
		}
	}
}

// process.exit prevents a Node v24 / abstract-level teardown race where open
// iterators are garbage-collected after the DB closes, causing a spurious crash.
main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
