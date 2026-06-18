// One-off pack maintenance: stamp a stable `system.slug` (= toSlug(name)) onto every move JSON
// under packs/src that lacks one, so move references survive renames. Preserves each file's existing
// indentation (tabs vs spaces) and trailing newline. Run: node scripts/backfill-move-slugs.js
import { promises as fs } from "fs";
import path from "path";
import { toSlug } from "../src/utils/slug.js";

const ROOT = "packs/src";

async function* walk(dir) {
	for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(p);
		else if (entry.name.endsWith(".json")) yield p;
	}
}

function detectIndent(text) {
	const m = text.match(/\n([\t ]+)"/);
	return m ? m[1] : "\t";
}

let changed = 0;
for await (const file of walk(ROOT)) {
	const text = await fs.readFile(file, "utf8");
	let data;
	try { data = JSON.parse(text); } catch { continue; }
	if (data?.type !== "move") continue;
	data.system ??= {};
	if (data.system.slug) continue;
	data.system.slug = toSlug(data.name);
	const indent = detectIndent(text);
	const out = JSON.stringify(data, null, indent) + (text.endsWith("\n") ? "\n" : "");
	await fs.writeFile(file, out);
	changed++;
}
console.log(`Stamped system.slug on ${changed} move JSON(s).`);
