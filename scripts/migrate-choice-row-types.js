#!/usr/bin/env node
/**
 * Migrates choice group row types in packs/src/ JSON files.
 *
 * heading → entry  (912 occurrences, 131 files)
 * follower → entry + followers: [slug] + content.text from title  (17 occurrences, 12 files)
 *
 * Run once during development; commit the output.
 * Verify with: grep -r '"type": "follower"' packs/src/ && grep -r '"type": "heading"' packs/src/
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const PACKS_DIR = new URL("../packs/src", import.meta.url).pathname;

let totalFiles = 0;
let changedFiles = 0;
let headingCount = 0;
let followerCount = 0;

function migrateRow(row) {
	if (row.type === "heading") {
		headingCount++;
		return { ...row, type: "entry" };
	}
	if (row.type === "follower") {
		followerCount++;
		const { title, type, ...rest } = row;
		return {
			...rest,
			type: "entry",
			content: { title: null, text: title ?? null },
			followers: [row.slug],
		};
	}
	return row;
}

function migrateList(list) {
	if (!Array.isArray(list)) return list;
	return list.map(migrateRow);
}

function migrateChoicesArray(choices) {
	if (!Array.isArray(choices)) return choices;
	return choices.map(group => {
		if (!group?.list) return group;
		return { ...group, list: migrateList(group.list) };
	});
}

function migrateChoicesObject(choices) {
	if (!choices || typeof choices !== "object" || Array.isArray(choices)) return choices;
	if (!choices.list) return choices;
	return { ...choices, list: migrateList(choices.list) };
}

function migrateValue(value) {
	if (value === null || value === undefined) return value;
	if (Array.isArray(value)) {
		// choices array (NpcItemData.choices is ArrayField)
		if (value.length > 0 && value[0]?.list !== undefined) {
			return migrateChoicesArray(value);
		}
		// list of rows
		if (value.length > 0 && value[0]?.type !== undefined) {
			return migrateList(value);
		}
		return value.map(migrateValue);
	}
	if (typeof value === "object") return migrateObject(value);
	return value;
}

function migrateObject(obj) {
	const result = {};
	for (const [key, val] of Object.entries(obj)) {
		if (key === "choices" && val !== null) {
			result[key] = Array.isArray(val) ? migrateChoicesArray(val) : migrateChoicesObject(val);
		} else if (key === "list" && Array.isArray(val)) {
			result[key] = migrateList(val);
		} else if (typeof val === "object" && val !== null) {
			result[key] = migrateValue(val);
		} else {
			result[key] = val;
		}
	}
	return result;
}

function walkDir(dir) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) { walkDir(full); continue; }
		if (!entry.endsWith(".json")) continue;

		totalFiles++;
		const original = readFileSync(full, "utf8");
		const data = JSON.parse(original);

		const before = headingCount + followerCount;
		const migrated = migrateObject(data);
		const after = headingCount + followerCount;

		if (after > before) {
			writeFileSync(full, JSON.stringify(migrated, null, "\t") + "\n");
			changedFiles++;
		}
	}
}

walkDir(PACKS_DIR);

console.log(`Scanned ${totalFiles} files, updated ${changedFiles}.`);
console.log(`  heading → entry: ${headingCount}`);
console.log(`  follower → entry: ${followerCount}`);
