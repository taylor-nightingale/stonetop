/**
 * One-time script: adds flags.core.sheetClass to all arcana source files so
 * they automatically open with StonetopArcanumSheet when clicked in-world.
 *
 * Run with: node scripts/stamp-arcana-sheet.js
 */
import { promises as fs } from "fs";
import path from "path";

const SHEET_CLASS = "stonetop.StonetopArcanumSheet";
let updated = 0;

async function processDir(dir) {
	for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) { await processDir(full); continue; }
		if (!entry.name.endsWith(".json")) continue;

		const doc = JSON.parse(await fs.readFile(full, "utf8"));
		if (doc.flags?.core?.sheetClass === SHEET_CLASS) continue;

		doc.flags ??= {};
		doc.flags.core ??= {};
		doc.flags.core.sheetClass = SHEET_CLASS;
		await fs.writeFile(full, JSON.stringify(doc, null, 2));
		updated++;
	}
}

await processDir("packs/src/arcana");
console.log(`Stamped ${updated} files with sheetClass: ${SHEET_CLASS}`);
