import { execFileSync } from "child_process";

// Top-level outline titles that are not gazetteer articles.
const SKIP_TITLES = new Set(["Contents", "Maps", "INDEX"]);
// Appendices we skip: C/D are the Minor/Major Arcana, already shipped in our `arcana` pack.
const SKIP_APPENDIX = /^APPENDIX [CD]:/i;

/**
 * Parse `mutool show <pdf> outline` text into ordered entries.
 * Lines look like: `|\t\t"The Vicinity"\t#page=5&zoom=...` — leading `|`/`+`, then one tab per
 * depth level, the quoted title, then the `#page=N` target. Returns `[{title, pdfPage, depth}]`
 * in document order (depth 1 = top level).
 */
export function parseOutline(raw) {
	const entries = [];
	for (const line of String(raw).split(/\r?\n/)) {
		const m = line.match(/^[|+](\t+)"(.*)"\t#page=(\d+)/);
		if (!m) continue;
		entries.push({ title: m[2], pdfPage: Number(m[3]), depth: m[1].length });
	}
	return entries;
}

/**
 * The importable gazetteer articles, in book order, each with its PDF page range. The range end
 * is the next top-level entry's start minus one (computed over ALL top-level entries so skipped
 * ones still bound their neighbours), or `totalPages` for the last. `pdfPage`/`endPage` are
 * 1-based PDF page indices (each a 2-page spread).
 */
export function articleRanges(entries, totalPages) {
	const top = entries.filter((e) => e.depth === 1);
	const out = [];
	for (let i = 0; i < top.length; i++) {
		const e = top[i];
		const endPage = (i + 1 < top.length ? top[i + 1].pdfPage - 1 : totalPages);
		if (SKIP_TITLES.has(e.title) || SKIP_APPENDIX.test(e.title)) continue;
		out.push({ title: e.title, pdfPage: e.pdfPage, endPage });
	}
	return out;
}

/** Run mutool and parse the outline. */
export function loadOutline(pdfPath) {
	const raw = execFileSync("mutool", ["show", pdfPath, "outline"], { encoding: "utf8", maxBuffer: 1 << 24 });
	return parseOutline(raw);
}
