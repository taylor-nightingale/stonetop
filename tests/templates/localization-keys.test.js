import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// A {{localize}} key with no entry in en.json renders the KEY ITSELF into the sheet — the player
// sees "stonetop.steading.colName" where a column header should be. Nothing throws, no test fails,
// and it survives until someone opens that tab and notices. This sweep is the thing that notices.

const root = process.cwd();

function hbsFiles(dir, found = []) {
	for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
		const rel = path.join(dir, entry.name);
		if (entry.isDirectory()) hbsFiles(rel, found);
		else if (entry.name.endsWith(".hbs")) found.push(rel);
	}
	return found;
}

const en = JSON.parse(readFileSync(path.join(root, "languages/en.json"), "utf8"));

function lookup(key) {
	let node = en;
	for (const part of key.split(".")) {
		if (typeof node !== "object" || node === null || !(part in node)) return undefined;
		node = node[part];
	}
	return node;
}

// `{{localize "a.b.c"}}`, `{{localize 'a.b.c' name=x}}`, and the same inside a subexpression.
function keysIn(source) {
	return [...source.matchAll(/localize\s+["']([A-Za-z0-9_.]+)["']/g)].map(m => m[1]);
}

const templates = hbsFiles("templates");

describe("template localization keys", () => {
	it("finds templates to check", () => {
		expect(templates.length).toBeGreaterThan(0);
	});

	it.each(templates)("%s resolves every localize key it uses", file => {
		const unresolved = keysIn(readFileSync(path.join(root, file), "utf8"))
			.filter(key => typeof lookup(key) !== "string");
		expect(unresolved).toEqual([]);
	});
});
