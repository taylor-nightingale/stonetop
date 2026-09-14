import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { explainWrap } from "../../../scripts/import/pdf/dehyphen.js";

// The built pack sources, read as text: a hyphen followed by a space and a lower-case word is the
// book's line-break hyphen surviving into shipped text ("w/advan- tage"), which is the whole point of
// dehyphen.js. Guards every builder at once — a parser that joins wrapped lines without the shared
// rule shows up here even if nothing else notices.
const SRC = path.join(import.meta.dirname, "../../../packs/src");
const WRAP = /([A-Za-z]{2,}-) ([a-z][A-Za-z]*)/g;

/** Two places where the book's own text layer carries the space INSIDE one printed line, so no line
 *  join ever sees them — mutool reads "giant- sized" as a single line. Listed so they cannot multiply
 *  quietly; fixing them means normalising lines as they are read, not joining them differently. */
const IN_LINE_ARTIFACTS = new Set(["giant- sized", "berry- laden"]);

/** Every hyphen-space in `text` that is neither a suspended hyphen ("Nepalese- and Tibetan-inspired",
 *  which the shared rule recognises) nor one of the known in-line artifacts, with its context. */
function unexplained(text) {
	const out = [];
	for (const m of text.matchAll(WRAP)) {
		const [, left, right] = m;
		if (IN_LINE_ARTIFACTS.has(`${left} ${right}`)) continue;
		const rest = text.slice(m.index + left.length + 1, m.index + left.length + 60);
		if (explainWrap(left, rest).reason === "suspended") continue;
		out.push(text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 20));
	}
	return out;
}

function* jsonFiles(dir) {
	for (const entry of readdirSync(dir)) {
		const p = path.join(dir, entry);
		if (statSync(p).isDirectory()) yield* jsonFiles(p);
		else if (p.endsWith(".json")) yield p;
	}
}

describe("the built pack sources carry no unexplained line-break hyphens", () => {
	it("leaves only suspended hyphens standing", () => {
		const found = [];
		for (const file of jsonFiles(SRC))
			found.push(...unexplained(readFileSync(file, "utf8")).map((ctx) => `${path.relative(SRC, file)}: ${ctx}`));
		expect(found).toEqual([]);
	});

	it("would catch a wrap hyphen that got through, and excuses a suspended one", () => {
		expect(unexplained('"text": "rolls d10 w/advan- tage (close)"')).toHaveLength(1);
		expect(unexplained('"text": "a fettered soul long- and cruelly-bound"')).toEqual([]);
	});
});
