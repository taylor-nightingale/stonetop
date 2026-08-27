import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEXT_PATHS, UNTRANSLATED_PATHS } from "../../src/i18n/translatablePaths.js";
import { TRANSLATED_PACKS } from "../../scripts/i18n/files.js";

// The allowlists are hand-authored, so a builder that starts emitting a new prose field would leave
// it untranslatable forever with nothing to say so — the symptom is English text, which is exactly
// what an untranslated string looks like. This walks the real packs and insists that every
// prose-looking string is either translatable or deliberately not, with a reason recorded.

function packFiles(dir, out = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) { if (entry.name !== "_folders") packFiles(full, out); }
		else if (entry.name.endsWith(".json")) out.push(full);
	}
	return out;
}

/** Path patterns of every string in a document, with `[]` for array steps. */
function stringPaths(node, path = "", found = new Map()) {
	if (Array.isArray(node)) {
		for (const element of node) stringPaths(element, `${path}[]`, found);
	} else if (node && typeof node === "object") {
		for (const [key, value] of Object.entries(node)) stringPaths(value, path ? `${path}.${key}` : key, found);
	} else if (typeof node === "string" && node.trim() && !found.has(path)) {
		found.set(path, node);
	}
	return found;
}

// A single token is a slug, an id, a die size or an enum — never a sentence. Anything with
// whitespace in it is prose until someone says otherwise.
const looksLikeProse = value => /\s/u.test(value);

describe("translatable-path coverage over the real packs", () => {
	const uncovered = [];

	for (const pack of TRANSLATED_PACKS) {
		for (const file of packFiles(join("packs/src", pack))) {
			const document  = JSON.parse(readFileSync(file, "utf8"));
			const allowed   = new Set(TEXT_PATHS[document.type] ?? []);
			const exempt    = UNTRANSLATED_PATHS[document.type] ?? {};

			for (const [path, value] of stringPaths(document)) {
				if (allowed.has(path) || Object.hasOwn(exempt, path)) continue;
				if (!looksLikeProse(value)) continue;
				uncovered.push(`${document.type}  ${path}  (${pack}/${file.split("/").pop()})\n      ${JSON.stringify(value.slice(0, 60))}`);
			}
		}
	}

	it("accounts for every prose field, as translatable or as a recorded exception", () => {
		expect(uncovered.join("\n    ")).toBe("");
	});

	it("gives every exception a reason", () => {
		for (const [type, paths] of Object.entries(UNTRANSLATED_PATHS)) {
			for (const [path, reason] of Object.entries(paths)) {
				expect(reason.trim().length, `${type} ${path}`).toBeGreaterThan(10);
			}
		}
	});

	it("never lists a path as both translatable and exempt", () => {
		for (const [type, paths] of Object.entries(UNTRANSLATED_PATHS)) {
			for (const path of Object.keys(paths)) {
				expect(TEXT_PATHS[type] ?? [], `${type} ${path}`).not.toContain(path);
			}
		}
	});

	it("covers every pack the extractor is pointed at", () => {
		for (const pack of TRANSLATED_PACKS) {
			const types = new Set(packFiles(join("packs/src", pack))
				.map(f => JSON.parse(readFileSync(f, "utf8")).type));
			for (const type of types) expect(Object.hasOwn(TEXT_PATHS, type), `${pack} → ${type}`).toBe(true);
		}
	});
});
