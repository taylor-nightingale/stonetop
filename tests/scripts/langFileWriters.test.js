import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

// Three builders now write languages/en.json — the tag glossary, the "If you want to…" advice, and
// the Coins sidebar — and every other string in that file is hand-authored. They can only coexist
// because each one replaces exactly its OWN subtree and leaves the rest of the tree alone.
//
// That invariant is invisible at the point of the bug: a builder that assigned `strings.stonetop`
// wholesale would silently drop its siblings, and the only symptom would be a ? button that quietly
// stopped showing half its content. So it is checked at the source level.

const LANG = "languages/en.json";

function scripts(dir, found = []) {
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) scripts(full, found);
		else if (entry.endsWith(".js")) found.push(full);
	}
	return found;
}

const writers = scripts("scripts")
	.map(file => ({ file, source: readFileSync(file, "utf8") }))
	.filter(({ source }) => source.includes(LANG) && /writeFileSync\s*\(/.test(source));

describe("languages/en.json writers", () => {
	it("finds the builders that write it", () => {
		const names = writers.map(w => path.basename(w.file));
		expect(names).toEqual(expect.arrayContaining([
			"build-tag-glossary.js", "build-advice.js", "build-items.js",
		]));
	});

	it("each replaces one named subtree, never the whole stonetop tree", () => {
		const offenders = writers.filter(({ source }) =>
			// `x.stonetop = …` or `x.stonetop.foo.bar = …` would reach past a single subtree;
			// `x.stonetop.advice = …` is the shape they must all use.
			/\.stonetop\s*=[^=]/.test(source) || /\.stonetop\.\w+\.\w+\s*=[^=]/.test(source));
		expect(offenders.map(o => path.basename(o.file))).toEqual([]);
	});

	it("each reads the file before writing it, so it merges rather than starts fresh", () => {
		// The read may go through a helper (readJson(LANG)) rather than readFileSync directly.
		const offenders = writers.filter(({ source }) =>
			!/read\w*\(\s*(OUT|LANG|"languages\/en\.json")/.test(source));
		expect(offenders.map(o => path.basename(o.file))).toEqual([]);
	});

	it("no two builders claim the same subtree", () => {
		const claimed = writers.flatMap(({ file, source }) =>
			[...source.matchAll(/\.stonetop\.(\w+)\s*=[^=]/g)].map(m => ({ key: m[1], file: path.basename(file) })));
		const byKey = new Map();
		for (const { key, file } of claimed) byKey.set(key, new Set([...(byKey.get(key) ?? []), file]));
		const shared = [...byKey.entries()].filter(([, files]) => files.size > 1);
		expect(shared.map(([key]) => key)).toEqual([]);
	});
});
