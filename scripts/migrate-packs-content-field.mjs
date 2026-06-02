#!/usr/bin/env node
/**
 * Choice row content-field migration.
 *
 * Converts all choice list items in packs/src/ to the new schema:
 *   - heading rows: top-level title/label/description → content: { title, text }
 *   - input rows:   type "input" → type "heading" with content.text + input object
 *
 * Recurses through all nested arrays in every JSON file, applying
 * transformations only to arrays whose items have a recognised "type" value.
 *
 * Usage:
 *   node scripts/migrate-packs-content-field.mjs           # transform in place
 *   node scripts/migrate-packs-content-field.mjs --dry-run # preview only
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir   = dirname(fileURLToPath(import.meta.url));
const ROOT    = resolve(__dir, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const PACKS   = join(ROOT, "packs/src");

const KNOWN_ROW_TYPES = new Set(["heading", "pick", "follower", "input"]);

/** Returns true if an array looks like a choice list (contains known row types). */
function isChoiceList(arr) {
	return arr.some(el => el && typeof el === "object" && KNOWN_ROW_TYPES.has(el.type));
}

/**
 * Migrate a single choice row item. Returns the (possibly new) item object
 * and a boolean indicating whether anything changed.
 */
function migrateItem(item) {
	if (item.type === "heading") {
		const { title, label, description, content: existingContent, ...rest } = item;

		// Already migrated (has a content object and no legacy fields)
		if (existingContent !== undefined && title === undefined && label === undefined && description === undefined) {
			return { item, changed: false };
		}

		const newContent = {
			title: existingContent?.title ?? title ?? null,
			text:  existingContent?.text  ?? label ?? description ?? null,
		};

		const newItem = { type: "heading" };
		if (rest.slug !== undefined) newItem.slug = rest.slug;
		newItem.content = newContent;
		if (rest.note  !== undefined) newItem.note  = rest.note;
		if (rest.track !== undefined) newItem.track = rest.track;
		if (rest.input !== undefined) newItem.input = rest.input;

		return { item: newItem, changed: true };
	}

	if (item.type === "input") {
		const inputObj = {};
		if (item.placeholder) inputObj.placeholder = item.placeholder;
		if (item.default)     inputObj.default     = item.default;

		const newItem = {
			type:    "heading",
			slug:    item.slug,
			content: { title: null, text: item.text ?? null },
			input:   inputObj,
		};
		return { item: newItem, changed: true };
	}

	return { item, changed: false };
}

/**
 * Recursively walk a value, transforming any choice list arrays in place.
 * Returns true if any change was made.
 */
function walk(value) {
	if (!value || typeof value !== "object") return false;

	if (Array.isArray(value)) {
		let changed = false;
		if (!isChoiceList(value)) {
			for (const el of value) {
				if (walk(el)) changed = true;
			}
			return changed;
		}
		for (let i = 0; i < value.length; i++) {
			const { item: newItem, changed: itemChanged } = migrateItem(value[i]);
			if (itemChanged) {
				value[i] = newItem;
				changed = true;
			}
			// Also recurse into the (possibly new) item's children
			if (walk(newItem)) changed = true;
		}
		return changed;
	}

	// Plain object — recurse into all values
	let changed = false;
	for (const key of Object.keys(value)) {
		if (walk(value[key])) changed = true;
	}
	return changed;
}

/** Collect all .json files under dir recursively. */
function collectJson(dir, results = []) {
	for (const entry of readdirSync(dir)) {
		if (entry.startsWith("_")) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			collectJson(full, results);
		} else if (entry.endsWith(".json")) {
			results.push(full);
		}
	}
	return results;
}

let updated = 0;
let skipped = 0;

for (const path of collectJson(PACKS)) {
	const raw = readFileSync(path, "utf8");
	const doc = JSON.parse(raw);

	const changed = walk(doc);

	if (!changed) {
		skipped++;
		continue;
	}

	const out = JSON.stringify(doc, null, "\t") + "\n";

	if (DRY_RUN) {
		const rel = path.replace(ROOT + "/", "");
		console.log(`[dry-run] would update: ${rel}`);
	} else {
		writeFileSync(path, out, "utf8");
		const rel = path.replace(ROOT + "/", "");
		console.log(`updated: ${rel}`);
	}
	updated++;
}

console.log(`\n${DRY_RUN ? "[dry-run] " : ""}Done: ${updated} updated, ${skipped} skipped (already clean).`);
