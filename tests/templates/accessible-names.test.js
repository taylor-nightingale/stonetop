import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// Every form control needs an accessible name. Without one a screen reader announces "edit text,
// blank" and the user has no way to know what they are filling in — and on a character sheet, which
// is almost entirely form controls, that makes the sheet unusable rather than merely awkward.
//
// A name can come from three places, in the order of preference this system uses:
//   1. a wrapping <label>            — the visible text is the name, nothing to keep in sync
//   2. aria-label reusing the key of an adjacent visible <label>/<span>
//   3. aria-label from the control's own placeholder key
// An `id` counts only when a <label for> in the same template actually points at it — an id on its
// own names nothing, and accepting it bare passed seven genuinely nameless NPC fields.

const root = process.cwd();

function hbsFiles(dir, found = []) {
	for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
		const rel = path.join(dir, entry.name);
		if (entry.isDirectory()) hbsFiles(rel, found);
		else if (entry.name.endsWith(".hbs")) found.push(rel);
	}
	return found;
}

const CONTROL = /<(select|textarea|input)\b([^>]*)>/gs;
const WRAPPING_LABEL = /<label\b.*?<\/label>/gs;

/** @returns {{file: string, tag: string, snippet: string}[]} controls with no accessible name */
function unnamedControls(file) {
	const source = readFileSync(path.resolve(root, file), "utf8");
	const labelled = [...source.matchAll(WRAPPING_LABEL)].map(m => [m.index, m.index + m[0].length]);
	const labelTargets = new Set([...source.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map(m => m[1]));
	const found = [];
	for (const m of source.matchAll(CONTROL)) {
		const attrs = m[2];
		if (attrs.includes('type="hidden"')) continue;
		if (/(?:^|\s)aria-label=|(?:^|\s)aria-labelledby=/.test(attrs)) continue;
		// `(^|\s)id=` and not `\bid=`, which also matches inside data-owned-id / data-row-id.
		const id = /(?:^|\s)id="([^"]+)"/.exec(attrs);
		if (id && labelTargets.has(id[1])) continue;
		if (labelled.some(([start, end]) => m.index >= start && m.index < end)) continue;
		found.push({ file, tag: m[1], snippet: m[0].replace(/\s+/g, " ").slice(0, 90) });
	}
	return found;
}

// Buttons and links are held to the same rule, with one difference: `title` does NOT count. It is a
// weak and inconsistent name source — some screen readers announce it only at higher verbosity, it
// never appears on keyboard focus, and it is invisible on touch. Sixteen controls depended on it
// alone. A control's name should not vary with the reader's settings.
const ACTIVATABLE = /<(button|a)\b([^>]*?)>(.*?)<\/\1>/gs;

/** @returns {string[]} descriptions of buttons/links with no text and no aria-label */
function unnamedActivatable(file) {
	const source = readFileSync(path.resolve(root, file), "utf8");
	const found = [];
	for (const m of source.matchAll(ACTIVATABLE)) {
		const [, tag, attrs, inner] = m;
		// Handlebars expressions count as text: they render to the control's visible label.
		const text = inner.replace(/\{\{[^}]*\}\}/g, "X").replace(/<[^>]+>/g, "").trim();
		if (text) continue;
		if (/(?:^|\s)aria-label=|(?:^|\s)aria-labelledby=/.test(attrs)) continue;
		found.push(`<${tag}> ${m[0].replace(/\s+/g, " ").slice(0, 90)}`);
	}
	return found;
}

describe("every form control has an accessible name", () => {
	const files = hbsFiles("templates");

	it("finds templates to check", () => {
		expect(files.length).toBeGreaterThan(50);
	});

	it.each(files)("%s", file => {
		const unnamed = unnamedControls(file);
		expect(unnamed.map(u => `<${u.tag}> ${u.snippet}`)).toEqual([]);
	});
});

describe("every button and link has an accessible name", () => {
	it.each(hbsFiles("templates"))("%s", file => {
		expect(unnamedActivatable(file)).toEqual([]);
	});
});
