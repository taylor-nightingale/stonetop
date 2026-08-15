import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Every embedded-item write on an actor goes through GrantedItems, so "which items exist because of
// X?" has one answer and a new grant path can't quietly invent a sixth provenance convention. This
// test is the seam's fence: the audit that found the duplication bug had to read 19 call sites.
//
// Migrations are outside it on purpose — they recreate items to change their TYPE (npc → follower,
// equipment → arcanum), which is not granting.

const ROOTS = ["src/actors", "src/item", "src/model"];
const ALLOWED = ["src/actors/GrantedItems.js"];

function jsFilesIn(dir) {
	return readdirSync(dir).flatMap(entry => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) return jsFilesIn(path);
		return path.endsWith(".js") ? [path] : [];
	});
}

describe("one writer of embedded items", () => {
	it("only GrantedItems calls createEmbeddedDocuments", () => {
		const offenders = ROOTS
			.flatMap(jsFilesIn)
			.filter(path => !ALLOWED.includes(path))
			.filter(path => readFileSync(path, "utf8").includes("createEmbeddedDocuments"));
		expect(offenders).toEqual([]);
	});
});
