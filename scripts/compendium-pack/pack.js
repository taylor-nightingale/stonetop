import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { PACKS } from "./packs.js";
import { PACK_VERSION_FLAG } from "../../src/migration/PackVersionCheck.js";
import { buildLanguageFiles } from "../i18n/buildLanguages.js";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId() {
	return Array.from({ length: 16 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

async function ensureFolders(srcDir, parentFolderId = null) {
	const entries = await fs.readdir(srcDir, { withFileTypes: true });
	const subdirs = entries.filter(e => e.isDirectory() && !e.name.startsWith("_"));
	if (!subdirs.length) return;

	const foldersDir = path.join(srcDir, "_folders");
	await fs.mkdir(foldersDir, { recursive: true });

	for (const subdir of subdirs) {
		const slug = subdir.name;
		const name = slug.replace(/[-_]/g, " ");
		const folderFile = path.join(foldersDir, `${slug}.json`);

		let folderId;
		try {
			const existing = JSON.parse(await fs.readFile(folderFile, "utf8"));
			folderId = existing._id;
			if (existing.folder !== parentFolderId) {
				existing.folder = parentFolderId;
				await fs.writeFile(folderFile, JSON.stringify(existing, null, 2));
			}
		} catch {
			folderId = randomId();
			const folderDoc = { name, type: "Item", description: "", folder: parentFolderId, sorting: "a", sort: 0, color: null, flags: {}, _id: folderId, _key: `!folders!${folderId}` };
			await fs.writeFile(folderFile, JSON.stringify(folderDoc, null, 2));
			console.log(`  Created folder: ${name}`);
		}

		const moveDir = path.join(srcDir, slug);
		const files = (await fs.readdir(moveDir)).filter(f => f.endsWith(".json"));
		for (const file of files) {
			const filepath = path.join(moveDir, file);
			let doc;
			try {
				doc = JSON.parse(await fs.readFile(filepath, "utf8"));
			} catch (e) {
				throw new Error("Failed parsing " + filepath, { cause: e });
			}
			if (doc.folder === folderId) continue;
			doc.folder = folderId;
			await fs.writeFile(filepath, JSON.stringify(doc, null, 2));
		}

		await ensureFolders(moveDir, folderId);
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
		let doc;
		try {
			doc = JSON.parse(await fs.readFile(full, "utf8"));
		} catch (e) {
			throw new Error("Failed parsing " + full, { cause: e });
		}

		if (doc._id && doc._key) continue;
		doc._id ??= randomId();
		doc._key ??= `!items!${doc._id}`;
		await fs.writeFile(full, JSON.stringify(doc, null, 2));
		console.log(`  Assigned ID to ${entry.name}`);
	}
}

// Every compiled document carries the version of the system that built it, so the running system can
// tell that the compendium it is reading is older than its own code — an install where the packs were
// left behind serves stale content silently, and that content gets copied onto characters. The stamp
// lives only in the compiled pack: `packs/src` is the committed source and stays free of it, so a
// version bump is not a diff across every pack file.
export function stampPackVersion(version) {
	return (doc) => {
		doc.flags ??= {};
		doc.flags.stonetop = { ...(doc.flags.stonetop ?? {}), [PACK_VERSION_FLAG]: version };
	};
}

async function systemVersion() {
	return JSON.parse(await fs.readFile("system.json", "utf8")).version;
}

async function main() {
	const version = await systemVersion();
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
			await compilePack(src, dest, { nedb: false, log: true, recursive: true, transformEntry: stampPackVersion(version) });
		} catch (err) {
			// Node v24 + abstract-level teardown race: iterator cleanup races with DB close.
			// All files are written before this throws, so it's safe to ignore.
			if (err.code !== "LEVEL_ITERATOR_NOT_OPEN") throw err;
		}
	}

	// Compendium translations are compiled from the same sources that were just packed, so they can
	// never be built against an older English than the packs carry.
	console.log("\nCompendium translations:");
	const languages = await buildLanguageFiles();
	if (!languages.length) console.log("  none");
}

// Only when run as a script: importing this module (the stamp is tested) must not compile every pack
// and take the importing process down with it.
// process.exit prevents a Node v24 / abstract-level teardown race where open
// iterators are garbage-collected after the DB closes, causing a spurious crash.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
