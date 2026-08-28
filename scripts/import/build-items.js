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
import { parseItemTables, parseInsertItems, parseInsertLines, knownTagSlugs, parseStatBlock } from "./pdf/items.js";
import { INVENTORY_INSERT_PAGE } from "../../src/model/data/character/inventoryInsertPage.js";
import { toFollowerDoc } from "./pdf/creatures.js";
import {
	OUTFIT_PACK, FOLLOWER_PACK, InsertList, resolveRow, toOutfitItemDoc, toFolderDoc,
	normalizeName, sectionTitle, followerName, followerSlug, generatedFlags, isGenerated,
	fullOutfitItemName, insertKey,
} from "./item-docs.js";

const OUTFIT_DIR    = `packs/src/${OUTFIT_PACK}`;
const FOLLOWER_DIR  = `packs/src/${FOLLOWER_PACK}`;
// Where a row is filed is what it IS to a character sheet: "Default" is the Inventory insert's
// checklist, which every sheet draws in full, and "Special items" is the catalog behind it that a GM
// drags from. Both ship; only the first is on anybody's sheet by default.
const DEFAULT_DIR   = `${OUTFIT_DIR}/default`;
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

/**
 * The insert shelf holds the Inventory insert's gear and nothing else. Filing is only shelving now —
 * the PAGE decides what a sheet draws (see reconcileWithPage) — but a shelf that quietly disagrees
 * with the printed page is still a data bug to fix in `packs/src`, never something to paper over.
 */
function reconcileWithInsert(insert, defaultNames) {
	const missing = insert.missingFrom(defaultNames);
	const extra   = defaultNames.filter((name) => !insert.has(name));
	if (!missing.length && !extra.length) return;
	const lines = [
		`${OUTFIT_PACK}/default does not match the Inventory insert (printed p. 142):`,
		...missing.map((n) => `  on the insert, missing from Default: ${n}`),
		...extra.map((n) => `  in Default, not on the insert: ${n}`),
	];
	throw new Error(lines.join("\n"));
}

/**
 * The inventory page is what a character sheet actually draws, so it is the thing that has to match
 * p. 142 — not a folder, which is how 46 rows of the value tables once reached every sheet in the
 * world. Both halves are checked, because a page is both:
 *
 *   membership — every printed row appears, and nothing appears that the book does not print;
 *   layout     — the rows come in printed order, and the pairs the book sets two-across are pairs.
 *
 * Compared per column and line by line, which catches all of that at once. Section breaks are the
 * page's own (the book marks them only with whitespace), so they are not compared.
 */
function reconcileWithPage(printedLines, page, docs) {
	const slugOf = new Map(docs.map((doc) => [insertKey(fullOutfitItemName(doc)), doc.system?.slug]));
	const unknown = [];

	const printed = (column) => printedLines
		.map((line) => line.filter((row) => row.column === column).map((row) => {
			const slug = slugOf.get(insertKey(row.name));
			if (!slug) unknown.push(row.name);
			return slug ?? `?${row.name}`;
		}))
		.filter((line) => line.length);

	const onPage = (column) => (page.column(column)?.sections ?? [])
		.flatMap((section) => section.lines)
		.map((line) => [line].flat());

	const problems = [];
	for (const column of ["regular", "small"]) {
		const want = printed(column), have = onPage(column);
		if (JSON.stringify(want) === JSON.stringify(have)) continue;
		problems.push(`  ${column} column:`, `    p. 142: ${JSON.stringify(want)}`, `    page:   ${JSON.stringify(have)}`);
	}
	if (unknown.length) problems.unshift(`  printed rows no pack item matches: ${[...new Set(unknown)].join(", ")}`);
	if (!problems.length) return;

	throw new Error([
		"src/model/data/character/inventoryInsertPage.js does not match the Inventory insert (printed p. 142):",
		...problems,
	].join("\n"));
}

function main() {
	requireTools(["mutool"]);
	const { bookI } = resolveBooks(process.argv.slice(2), process.env);
	const known = knownTagSlugs(readJson("languages/en.json"));

	const tables = parseItemTables(bookI, known);
	// What the printed sheet actually lists. Only these rows may become pack items — see resolveRow.
	const insert = new InsertList(parseInsertItems(bookI));

	const cleared = clearGenerated(OUTFIT_DIR) + clearGenerated(FOLLOWER_DIR);
	const existing = loadPack(OUTFIT_DIR);
	// Keyed on the name the BOOK prints — `name` holds only the item, `system.qualifier` the rest —
	// so a value-table row still finds the item that already ships.
	const byName = new Map(existing.map((e) => [normalizeName(fullOutfitItemName(e.doc)), e.doc]));
	// The insert's own printed groups, so a new insert row lands beside the ones already filed under it.
	const folders = readdirSync(join(DEFAULT_DIR, "_folders")).map((n) => readJson(join(DEFAULT_DIR, "_folders", n)));
	const folderByName = new Map(folders.map((f) => [f.name.toLowerCase(), f]));
	const dirs = new Set(readdirSync(DEFAULT_DIR).filter((n) => statSync(join(DEFAULT_DIR, n)).isDirectory()));

	const resolved = new Map();   // BookItem -> ResolvedRow
	const newItems = [], newFollowers = [], newFolders = [];   // newFolders: { file, doc }
	let usedSpecialParent = false;
	// Generated, like everything under it: clearGenerated has just removed the previous run's copy, so
	// it is rebuilt from the same deterministic key rather than read back off disk.
	const specialParent = toFolderDoc("Special items", { pack: OUTFIT_PACK, key: "special" });
	const livestockFolder = toFolderDoc("Livestock", { pack: FOLLOWER_PACK, key: "livestock" });
	let usedLivestock = false;

	for (const table of tables) {
		for (const section of table.sections) {
			for (const item of section.items) {
				const row = resolveRow(item, section, byName, insert);
				resolved.set(item, row);
				// A category row names no object, and `existing` is already in the pack.
				if (!row.id || row.existing) continue;

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

				// An insert row joins the printed group it belongs to (only "Maul, iron" has ever been
				// a new one); everything else gets a category folder under "Special items", so the
				// insert's own groups keep meaning exactly what the printed sheet says they mean.
				const catSlug = toSlug(section.title.replace(/\*+$/, ""));
				let folder, dir;
				if (row.onInsert) {
					folder = folderByName.get(section.title.toLowerCase());
					if (!folder || !dirs.has(catSlug)) {
						throw new Error(`${item.name}: the insert prints it, but ${OUTFIT_PACK}/default has `
							+ `no "${section.title}" group to file it under.`);
					}
					dir = join(DEFAULT_DIR, catSlug);
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

	reconcileWithInsert(insert, [
		...existing.filter((e) => e.file.startsWith(`${DEFAULT_DIR}/`)).map((e) => fullOutfitItemName(e.doc)),
		...newItems.filter((n) => n.dir.startsWith(DEFAULT_DIR)).map((n) => fullOutfitItemName(n.doc)),
	]);
	reconcileWithPage(parseInsertLines(bookI), INVENTORY_INSERT_PAGE, [
		...existing.map((e) => e.doc), ...newItems.map((n) => n.doc),
	]);

	const rows = [...resolved.values()];
	console.log(`\nparsed ${rows.length} rows from ${bookI} (cleared ${cleared} previously generated doc(s))`);
	console.log(`  ${rows.filter((r) => r.existing).length} already in ${OUTFIT_PACK}`);
	console.log(`  ${newItems.length} new outfit item(s), ${newFollowers.length} new follower(s), ${newFolders.length} new folder(s)`);
	console.log(`  ${rows.filter((r) => r.kind === "category").length} category row(s) with no item (rendered as text)`);
	console.log(`  ${rows.filter((r) => r.kind === "outfitItem" && !r.onInsert).length} row(s) filed under Special items (not on the printed insert)`);
	console.log(`\nThe reference PAGE that links these is built by build-book-one.js, which runs next.`);
	console.log(`Review \`git diff packs/src/\`, then compile with \`npm run pack\`.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
