// Compile a content module's pack source (JSON) into LevelDB, using this package's
// @foundryvtt/foundryvtt-cli — so a companion module full of compendium content doesn't need its
// own node toolchain. Point MODULE_DIR at the module; every subdirectory of its packs/src/ is
// compiled to packs/<name>/. Ids are deterministic (written by the importers), so no id/folder
// bookkeeping is needed here.
//
//   MODULE_DIR=../my-module npm run pack:module
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";

const MODULE = process.env.MODULE_DIR;

async function main() {
	if (!MODULE) {
		console.error("Usage: MODULE_DIR=/path/to/module npm run pack:module");
		process.exit(1);
	}
	const srcRoot = `${MODULE}/packs/src`;
	let packs;
	try {
		packs = (await fs.readdir(srcRoot, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith("_")).map((e) => e.name);
	} catch {
		console.error(`No pack source at ${srcRoot}`);
		process.exit(1);
	}
	if (!packs.length) {
		console.error(`No pack source directories under ${srcRoot}`);
		process.exit(1);
	}
	for (const pack of packs) {
		const dest = `${MODULE}/packs/${pack}`;
		await fs.rm(dest, { recursive: true, force: true });
		await fs.mkdir(dest, { recursive: true });
		try {
			await compilePack(`${srcRoot}/${pack}`, dest, { nedb: false, log: true, recursive: true });
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
