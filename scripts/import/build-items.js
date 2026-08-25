// Build everything Book I's value tables (printed pp. 92-97) feed:
//   • the gear the pack is still missing → packs/src/outfit-items/…
//   • the livestock stat blocks → packs/src/followers/livestock/…
//   • the "Common & Special Items" reference page → packs/src/reference/…
//
// Usage: node scripts/import/build-items.js [Book_I.pdf]      (requires Book I and mutool)
//
// One builder rather than three, because all of it hangs off ONE resolution step: which table rows
// already ship as items and which don't. Splitting it would mean re-deriving that mapping to write
// the page's links, and the two could then disagree about what exists.
//
// Nothing here rewrites an item that already ships. Most Common-items rows are already in the pack
// under the Inventory insert's name for them (see item-docs.js) — those contribute only their id, so
// hand-authored weights, columns, slugs and ids are left exactly as they are.

import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { toSlug } from "../../src/utils/slug.js";
import { deterministicId, documentKey } from "./ids.js";
import { resolveBooks, requireTools } from "./pdf/books.js";
import { parseItemTables, knownTagSlugs, parseStatBlock } from "./pdf/items.js";
import { toFollowerDoc } from "./pdf/creatures.js";
import {
	OUTFIT_PACK, FOLLOWER_PACK, resolveRow, toOutfitItemDoc, toFolderDoc,
	normalizeName, sectionTitle, followerName, followerSlug, generatedFlags, isGenerated,
} from "./item-docs.js";

const OUTFIT_DIR    = `packs/src/${OUTFIT_PACK}`;
const FOLLOWER_DIR  = `packs/src/${FOLLOWER_PACK}`;
const SPECIAL_DIR   = `${OUTFIT_DIR}/special`;

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));
const writeJson = (f, doc) => writeFileSync(f, JSON.stringify(doc, null, "\t") + "\n");

/** Every document already in a pack source tree, with the file it came from. */
function loadPack(dir) {
	const walk = (d) => readdirSync(d).flatMap((n) => {
		const f = join(d, n);
		if (statSync(f).isDirectory()) return n === "_folders" ? [] : walk(f);
		return n.endsWith(".json") ? [f] : [];
	});
	return walk(dir).map((file) => ({ file, doc: readJson(file) }));
}

/** Delete this build's previous output — every document it stamped — so a rerun starts clean and
 *  can't mistake its own items for gear that already shipped. Hand-authored files carry no stamp and
 *  are never touched. */
function clearGenerated(dir) {
	let removed = 0;
	const walk = (d) => {
		for (const name of readdirSync(d)) {
			const f = join(d, name);
			if (statSync(f).isDirectory()) { walk(f); if (!readdirSync(f).length) rmSync(f, { recursive: true }); continue; }
			if (name.endsWith(".json") && isGenerated(readJson(f))) { rmSync(f); removed++; }
		}
	};
	walk(dir);
	return removed;
}

function main() {
	requireTools(["mutool"]);
	const { bookI } = resolveBooks(process.argv.slice(2), process.env);
	const known = knownTagSlugs(readJson("languages/en.json"));

	const tables = parseItemTables(bookI, known);

	const cleared = clearGenerated(OUTFIT_DIR) + clearGenerated(FOLLOWER_DIR);
	const existing = loadPack(OUTFIT_DIR);
	const byName = new Map(existing.map((e) => [normalizeName(e.doc.name), e.doc]));
	// The book's own folder names, so a new item lands beside the ones already filed under it.
	const folders = readdirSync(join(OUTFIT_DIR, "_folders")).map((n) => readJson(join(OUTFIT_DIR, "_folders", n)));
	const folderByName = new Map(folders.map((f) => [f.name.toLowerCase(), f]));
	const dirs = new Set(readdirSync(OUTFIT_DIR).filter((n) => statSync(join(OUTFIT_DIR, n)).isDirectory()));

	const resolved = new Map();   // BookItem -> ResolvedRow
	const newItems = [], newFollowers = [], newFolders = [];   // newFolders: { file, doc }
	const specialParent = toFolderDoc("Special items", { pack: OUTFIT_PACK, key: "special" });
	const livestockFolder = toFolderDoc("Livestock", { pack: FOLLOWER_PACK, key: "livestock" });
	let usedSpecialParent = false, usedLivestock = false;

	for (const table of tables) {
		for (const section of table.sections) {
			for (const item of section.items) {
				const row = resolveRow(item, section, byName);
				resolved.set(item, row);
				if (row.kind === "category" || row.existing) continue;

				if (row.kind === "follower") {
					usedLivestock = true;
					const creature = parseStatBlock(item.statBlock, {
						name: followerName(item.name), tagList: item.tagList,
					});
					newFollowers.push(toFollowerDoc(creature, {
						slug: followerSlug(item.name), id: row.id, flags: generatedFlags(),
						key: documentKey("Item", row.id), folder: livestockFolder._id,
					}));
					continue;
				}

				// A brand-new COMMON row files into the folder the book already has for its category
				// (only "Maul, iron" is one); a SPECIAL row gets a category folder of its own, nested
				// under "Special items" so the insert's folders keep their meaning.
				const catSlug = toSlug(section.title.replace(/\*+$/, ""));
				const isCommon = table.availability === "common";
				let folder, dir;
				if (isCommon && folderByName.has(section.title.toLowerCase()) && dirs.has(catSlug)) {
					folder = folderByName.get(section.title.toLowerCase());
					dir = join(OUTFIT_DIR, catSlug);
				} else {
					usedSpecialParent = true;
					folder = toFolderDoc(sectionTitle(section.title), {
						pack: OUTFIT_PACK, parent: specialParent._id, key: `special/${catSlug}`,
					});
					const file = join(SPECIAL_DIR, "_folders", `${catSlug}.json`);
					if (!newFolders.some((f) => f.doc._id === folder._id)) newFolders.push({ file, doc: folder });
					dir = join(SPECIAL_DIR, catSlug);
				}
				newItems.push({ dir, doc: toOutfitItemDoc(item, { folder: folder._id }) });
			}
		}
	}

	for (const { dir, doc } of newItems) {
		mkdirSync(dir, { recursive: true });
		writeJson(join(dir, `${doc.system.slug}.json`), doc);
	}
	if (newFollowers.length) mkdirSync(join(FOLLOWER_DIR, "livestock"), { recursive: true });
	for (const doc of newFollowers) writeJson(join(FOLLOWER_DIR, "livestock", `${doc.system.slug}.json`), doc);

	if (usedSpecialParent) newFolders.unshift({ file: join(OUTFIT_DIR, "_folders", "special.json"), doc: specialParent });
	for (const { file, doc } of newFolders) {
		mkdirSync(join(file, ".."), { recursive: true });
		writeJson(file, doc);
	}
	if (usedLivestock) writeJson(join(FOLLOWER_DIR, "_folders", "livestock.json"), livestockFolder);

	const rows = [...resolved.values()];
	console.log(`\nparsed ${rows.length} rows from ${bookI} (cleared ${cleared} previously generated doc(s))`);
	console.log(`  ${rows.filter((r) => r.existing).length} already in ${OUTFIT_PACK}`);
	console.log(`  ${newItems.length} new outfit item(s), ${newFollowers.length} new follower(s), ${newFolders.length} new folder(s)`);
	console.log(`  ${rows.filter((r) => r.kind === "category").length} category row(s) with no item (rendered as text)`);
	console.log(`\nThe reference PAGE that links these is built by build-book-one.js, which runs next.`);
	console.log(`Review \`git diff packs/src/\`, then compile with \`npm run pack\`.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
