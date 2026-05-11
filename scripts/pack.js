import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";
import path from "path";
import { PACKS } from "./packs.js";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId() {
	return Array.from({ length: 16 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

async function ensureIds(srcDir) {
	const files = (await fs.readdir(srcDir)).filter(f => f.endsWith(".json"));
	for (const file of files) {
		const filepath = path.join(srcDir, file);
		const doc = JSON.parse(await fs.readFile(filepath, "utf8"));
		if (doc._id && doc._key) continue;
		doc._id ??= randomId();
		doc._key ??= `!items!${doc._id}`;
		await fs.writeFile(filepath, JSON.stringify(doc, null, 2));
		console.log(`  Assigned ID to ${file}`);
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
		await ensureIds(src);
		const dest = `packs/${pack}`;
		await fs.mkdir(dest, { recursive: true });
		try {
			await compilePack(src, dest, { nedb: false, log: true });
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
