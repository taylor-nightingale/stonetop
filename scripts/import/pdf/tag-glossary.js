import { toSlug } from "../../../src/utils/slug.js";

// Book I prints gear terms in two typefaces, and that distinction IS the rule (p. 94: "Terms in
// italic typeface are tags… Terms in regular typeface are mechanical"). Bold-italic terms are tags;
// bold-roman terms are mechanical modifiers ([n] armor, +[n] damage, [n] piercing, hours, uses,
// requires ___). We keep only the tags, so the split is read off the font rather than a
// hand-maintained list that would drift from the book.
const isTag      = (font) => /-BoldItalic$/.test(font);
const isModifier = (font) => /-Bold$/.test(font);
const isHeading  = (font) => /(^|\+)Avara/.test(font);

// "area: affects everything in an area." — the term, then its definition. Bounded so a prose line
// that happens to contain a colon can't read as a term.
const ENTRY = /^([^:]{1,40}):\s*(.*)$/;

const leadFont = (line) => line.spans?.[0]?.font ?? line.font ?? "";

/** Join a wrapped definition line, healing the book's hyphenated line breaks ("require-" + "ments"). */
const joinWrapped = (definition, text) =>
	definition.endsWith("-") ? definition.slice(0, -1) + text : `${definition} ${text}`;

/**
 * Collect glossary entries from a run of stext lines.
 *
 * `start` marks the first line of the region (consumed, not parsed). `category` is what entries are
 * tagged with until a heading in `sections` switches it; any OTHER heading ends the region, which is
 * how "Ammo" stops the gear-terms sidebar without needing to know what follows it.
 */
export function parseGlossary(lines, { start, category, sections = {} }) {
	const entries = [];
	let current = null;
	let started = false;
	let cat = category;

	for (const line of lines) {
		const text = line.text.trim();
		if (!started) {
			if (start(line)) started = true;
			continue;
		}
		if (!text) continue;
		const font = leadFont(line);

		if (isHeading(font)) {
			const next = sections[text.toLowerCase()];
			if (!next) break;
			cat = next;
			current = null;
			continue;
		}

		const entry = ENTRY.exec(text);
		if (entry && (isTag(font) || isModifier(font))) {
			// A modifier is tracked exactly like a tag so its own wrapped lines are attributed to it
			// and cannot leak into the tag above — it is simply never emitted.
			current = { term: entry[1].trim(), definition: entry[2].trim(), category: cat, x: line.bbox[0], keep: isTag(font) };
			if (current.keep) entries.push(current);
			continue;
		}

		// A wrapped definition line: the book indents it past the term it belongs to.
		if (current && line.bbox[0] > current.x) {
			current.definition = joinWrapped(current.definition, text);
			continue;
		}
		current = null;
	}

	return entries.map(({ term, definition, category: c }) => ({
		slug: toSlug(term),
		label: term,
		definition,
		category: c,
	}));
}

/** The "Gear terms & tags" sidebar — general tags, then the "Range Tags" sub-list. */
export function parseGearTerms(lines) {
	return parseGlossary(lines, {
		start: (l) => /^gear terms & tags$/i.test(l.text.trim()),
		category: "general",
		sections: { "range tags": "range" },
	});
}

/** The artifact-writing sidebar's "additional tags not found on mundane items". */
export function parseArtifactTags(lines) {
	return parseGlossary(lines, {
		start: (l) => /additional tags/i.test(l.text),
		category: "artifact",
	});
}
