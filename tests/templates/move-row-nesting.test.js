import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// `move-row.hbs` renders an `<li>` as its root, so every include of it must sit directly inside a
// list. Nesting it any deeper is not merely untidy — the HTML parser's rule for a `<li>` start tag
// walks up the open-element stack and explicitly EXEMPTS `div` (and `address`/`p`) from the "stop at
// a special element" check, so a `<li><div>{{> move-row}}</div></li>` wrapper gets closed and the
// move escapes to become a sibling. Layout scatters and nothing errors.
//
// This can't be caught by rendering in tests: happy-dom's parser is lenient and does not implement
// that rule, so it happily produces the nesting the template asked for. Hence a source-level check.

const root = process.cwd();

function hbsFiles(dir, found = []) {
	for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
		const rel = path.join(dir, entry.name);
		if (entry.isDirectory()) hbsFiles(rel, found);
		else if (entry.name.endsWith(".hbs")) found.push(rel);
	}
	return found;
}

const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "source", "area", "col"]);

/** The open-tag stack at each `{{> "stonetop.move-row"}}` include in `source`. */
function enclosingTagsAtIncludes(source) {
	const clean = source.replace(/\{\{![\s\S]*?\}\}/g, "");
	const token = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|\{\{>\s*"stonetop\.move-row"/g;
	const stack = [], found = [];
	for (const m of clean.matchAll(token)) {
		if (m[0].startsWith("{{")) { found.push(stack[stack.length - 1] ?? null); continue; }
		const [, close, tag, , selfClose] = m;
		if (VOID.has(tag.toLowerCase()) || selfClose) continue;
		if (close) stack.pop();
		else stack.push(tag.toLowerCase());
	}
	return found;
}

const templates = hbsFiles("templates");

describe("move-row includes", () => {
	it("finds templates that include move-row", () => {
		const including = templates.filter(f => readFileSync(path.join(root, f), "utf8").includes('"stonetop.move-row"'));
		expect(including.length).toBeGreaterThan(0);
	});

	it.each(templates)("%s includes move-row only as a direct child of a list", file => {
		const parents = enclosingTagsAtIncludes(readFileSync(path.join(root, file), "utf8"));
		for (const parent of parents) expect(["ol", "ul"], `enclosing tag was <${parent}>`).toContain(parent);
	});
});
