// Writes the tag definitions into languages/en.json under `stonetop.tagGlossary` — they are text a
// player reads, so they live where every other string a translator handles lives (see
// src/model/data/TagGlossary.js, which reads them back). Two sidebars in Book I define tags: "Gear
// terms & tags" (general + range) and the artifact-writing sidebar's "additional tags not found on
// mundane items". Both mark tags with a bold-italic term and mechanical modifiers with a bold-roman
// one, so parseGlossary reads the split off the font (see tag-glossary.js).
//
// The category is the NESTING (general / range / artifact) rather than a key of its own, so nothing
// a translator should leave alone sits in among the strings.
//
// Run `npm run tag-glossary` after changing which pages are parsed. Requires Book I and mutool.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadStext } from "./stext.js";
import { resolveBooks, requireTools } from "./books.js";
import { parseGearTerms, parseArtifactTags } from "./tag-glossary.js";

const OUT = "languages/en.json";

// Page windows rather than exact pages, so a reprint that shifts the layout by a few leaves still
// resolves — and fails loudly rather than writing a partial glossary if it shifts further.
const SECTIONS = [
	{ name: "Gear terms & tags", window: "40-60",   anchor: /^gear terms & tags$/im, parse: parseGearTerms },
	{ name: "Artifact tags",     window: "210-230", anchor: /additional tags/i,      parse: parseArtifactTags },
];

/** The one page in `window` carrying `anchor`. Throws rather than guessing. */
function findPage(pdf, { name, window, anchor }) {
	const pages = loadStext(pdf, window);
	const hit = pages.find((p) => p.lines.some((l) => anchor.test(l.text.trim())));
	if (!hit) throw new Error(`${name}: no page in ${window} of ${pdf} matches ${anchor}`);
	return hit;
}

function main() {
	requireTools(["mutool"]);
	const { bookI } = resolveBooks(process.argv.slice(2), process.env);

	const entries = SECTIONS.flatMap((section) => {
		const found = section.parse(findPage(bookI, section).lines);
		if (!found.length) throw new Error(`${section.name}: page matched but no tags parsed`);
		return found;
	});

	const bySlug = new Map();
	for (const entry of entries) {
		const seen = bySlug.get(entry.slug);
		if (seen && seen.definition !== entry.definition) {
			throw new Error(`${entry.slug}: defined twice with different text ("${seen.definition}" / "${entry.definition}")`);
		}
		bySlug.set(entry.slug, entry);
	}

	// Group by the book's own sections, then fold into the language file — every other key it holds
	// is hand-authored, so only `stonetop.tagGlossary` is replaced.
	const glossary = {};
	for (const entry of bySlug.values()) {
		(glossary[entry.category] ??= {})[entry.slug] = entry.definition;
	}

	const strings = JSON.parse(readFileSync(OUT, "utf8"));
	strings.stonetop.tagGlossary = glossary;
	writeFileSync(OUT, JSON.stringify(strings, null, "\t") + "\n");

	const counts = Object.entries(glossary).map(([k, v]) => `${Object.keys(v).length} ${k}`);
	console.log(`${OUT}: ${bySlug.size} tag definitions (${counts.join(", ")})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
