import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Every <prose-mirror> in every template is seeded through {{editorHtml}}, and none is seeded raw.
 *
 * This is a guard, not a unit test, and it exists because the bug it prevents is invisible and
 * destroys data. A <prose-mirror> parses its `value` as HTML: hand it markdown and the whole value
 * arrives as one text run, then the editor writes that back on blur as a single <p> with every line
 * break and list marker welded in. Opening a sheet destroys the text it was showing, once, silently.
 *
 * That is what happened to Bolster — and it happened because the seed was opt-in: four item sheets
 * wrote `value="{{system.description}}"` and the choice editor did the conversion, so choice rows
 * survived while move descriptions did not. Anything opt-in here gets forgotten, so this test makes
 * forgetting a build failure rather than a bug report months later.
 */
const TEMPLATES = path.resolve(process.cwd(), "templates");

function templateFiles(dir = TEMPLATES) {
	return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return templateFiles(full);
		return entry.name.endsWith(".hbs") ? [full] : [];
	});
}

// The whole element, however many attributes and line breaks it is spread across.
const EDITOR = /<prose-mirror\b[\s\S]*?>/gi;
const VALUE  = /\bvalue\s*=\s*"([^"]*)"/i;

const editors = templateFiles().flatMap(file =>
	(readFileSync(file, "utf8").match(EDITOR) ?? [])
		.map(tag => ({ file: path.relative(process.cwd(), file), tag })));

describe("every <prose-mirror> is seeded through {{editorHtml}}", () => {
	it("finds the editors, so the guard cannot pass by matching nothing", () => {
		expect(editors.length).toBeGreaterThanOrEqual(7);
	});

	it.each(editors.map(e => [e.file, e.tag]))("%s seeds its editor converted", (_file, tag) => {
		const value = VALUE.exec(tag)?.[1];
		// An editor with no `value` at all is fine — it is seeded by JS or starts empty.
		if (value === undefined || value.trim() === "") return;
		expect(value, `seeded raw: ${value} — use {{editorHtml …}}, or markdown reaches the editor`)
			.toMatch(/\{\{\s*editorHtml\s/);
	});
});
