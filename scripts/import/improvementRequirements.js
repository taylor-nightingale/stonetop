// Reading an improvement's requirement HEADERS, so completion can be computed from what the book
// actually says.
//
// The book states the rule in prose above each list — "Requires all of the following:", "Requires 1
// of the following:", "any 3 of the following:" — and the box parser threw that away, emitting
// every requirement as a tracked entry row. Completion was therefore "every box ticked", which is
// wrong wherever the book says "N of": Greater Harvest is done at 1 of 2 and could never read so.
//
// The choice-group format already carries the cardinality: a PICK row with `pickCount`. So this
// classifies each header and the conversion turns "N of" groups into pick rows, leaving "all of"
// groups as the tracked rows they already are.
//
// Pure and dependency-free so it can be tested against the real sources; the writer is
// build-improvement-requirements.js beside it.

/**
 * The book's header phrasings, most specific first. `count: null` means "all of them".
 *
 * Closed on purpose: a header this table does not recognise is reported and the build fails, rather
 * than defaulting to "all" and quietly restoring the bug this exists to fix.
 */
const HEADERS = [
	// Alternatives between GROUPS rather than within one — "Requires either this: … Or all of these:"
	// A flat pick row cannot hold a branch that is itself a group, so these are flagged, not converted.
	{ re: /\bor\s+all\s+of\s+these\b/i,                      kind: "branch" },
	{ re: /\beither\s+this\b/i,                              kind: "branch" },

	// "any 3 of", "at least 3 of", "2 of the following", "1 of these"
	{ re: /\b(?:any|at least)\s+(\d+)\s+of\b/i,              kind: "any", group: 1 },
	{ re: /\b(\d+)\s+of\s+(?:the\s+following|these)\b/i,     kind: "any", group: 1 },

	// "either one of these", "one of the following"
	{ re: /\beither\s+one\s+of\b/i,                          kind: "any", count: 1 },
	{ re: /\bone\s+of\s+(?:the\s+following|these)\b/i,       kind: "any", count: 1 },
	// "And either of these, to germinate the seeds:" — either OF two, so one of them. Distinct from
	// the "either this / or all of these" branch above, which is matched first.
	{ re: /\beither\s+of\s+(?:the\s+following|these)\b/i,    kind: "any", count: 1 },

	// "all of the following", "all of the following, in order", "all of these", "Requires both"
	{ re: /\ball\s+of\s+(?:the\s+following|these)\b/i,       kind: "all" },
	{ re: /\brequires?\s+both\b/i,                           kind: "all" },

	// A continuation with no quantifier of its own — "And then:", "And these:", "And each of these:"
	{ re: /^\s*and\s+then\b/i,                               kind: "all" },
	{ re: /^\s*and\s+establishing\b/i,                       kind: "all" },
	{ re: /^\s*and\s+(?:each\s+of\s+)?these\b/i,             kind: "all" },
];

const WORDS = /[a-z]/i;

/** How a header row reads, or null when it is not a header at all. */
export function classifyHeader(text) {
	const flat = String(text ?? "").replace(/\*+|_+/g, "").trim();
	if (!flat || !WORDS.test(flat)) return null;
	for (const h of HEADERS) {
		const m = flat.match(h.re);
		if (!m) continue;
		if (h.kind === "branch") return { kind: "branch", prompt: flat };
		if (h.kind === "all")    return { kind: "all", prompt: flat };
		const count = h.count ?? Number(m[h.group]);
		return Number.isFinite(count) && count > 0
			? { kind: "any", count, prompt: flat }
			: { kind: "all", prompt: flat };
	}
	return null;
}

/**
 * The improvement's rows as a sequence of requirement GROUPS.
 *
 * A group is a header row plus the tracked rows that follow it, up to the next row that carries text
 * of its own. Untracked rows that are not headers (the opening flavour line, the closing effect
 * prose) are returned as `prose` so a caller can rebuild the list in order without losing them.
 */
export function readGroups(list = []) {
	const out = [];
	let current = null;

	for (const row of list) {
		if (row?.type === "pick") { current = null; out.push({ kind: "pick", row }); continue; }

		if (row?.track) {
			if (current) current.members.push(row);
			else out.push({ kind: "orphan", row });
			continue;
		}

		const header = classifyHeader(row?.content?.text);
		if (header) {
			current = { kind: "group", header, headerRow: row, members: [] };
			out.push(current);
		} else {
			current = null;
			out.push({ kind: "prose", row });
		}
	}
	return out;
}

/**
 * A tracked requirement row as a pick OPTION.
 *
 * The sentence goes in `content.title`, not `content.text`: buildPickRow maps `content.text` to the
 * option's `description`, and choice-row.hbs renders an option WITH a description as a bordered card.
 * Title keeps the plain label form that matches the tracked rows around it.
 */
export function toOption(row) {
	return { slug: row.slug, content: { title: row?.content?.text ?? "" } };
}

/**
 * Whether a group can become a pick row.
 *
 * "N of" with every member a single box — a pick option is one box, so a multi-box member has to stay
 * a track. And a count that meets or exceeds the membership ("2 of the following", with two of them)
 * is not a choice at all: it means all of them, and converting it would dress a plain requirement up
 * as a decision the table does not get to make.
 */
export function convertible(group) {
	return group.kind === "group"
		&& group.header.kind === "any"
		&& group.members.length > group.header.count
		&& group.members.every(m => (m.track?.max ?? 1) === 1 && m.slug);
}
