// Convert the book's dice tables (extracted as `table` blocks by layout.js) into Foundry RollTable
// documents for the GM-locked `wonder-tables` pack, and annotate the source blocks so the shared
// renderer can drop an inline "Draw" affordance next to each rendered table.
//
// Conservative by design (see plan): a `table` block only becomes a RollTable when its roll cells
// tile 1..N contiguously and N is a real die size (or the block carries a matching `1dN` header).
// Anything else stays a plain rendered table and is flagged for review — we never fabricate a die.
import { deterministicId } from "../ids.js";
import { joinLines } from "./render-html.js";

export const SYSTEM = "stonetop";
export const TABLE_PACK = "wonder-tables";

/** The compendium UUID a wonder-tables RollTable resolves to (the contract for the inline draw). */
export function tableUuid(id) {
	return `Compendium.${SYSTEM}.${TABLE_PACK}.RollTable.${id}`;
}

// Standard polyhedral dice we'll trust when inferring a formula from row ranges alone.
const DIE_FACES = new Set([2, 3, 4, 6, 8, 10, 12, 20, 100]);
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Parse a roll cell ("5" or "1-2"/"1–2") into an inclusive [min,max], or null if it isn't one. */
function parseRange(cell) {
	const t = (cell?.text ?? "").trim();
	let m = t.match(/^(\d+)\s*[–-]\s*(\d+)$/);
	if (m) { const a = +m[1], b = +m[2]; return b >= a ? [a, b] : null; }
	m = t.match(/^(\d+)$/);
	return m ? [+m[1], +m[1]] : null;
}

/** Faces of a `NdM` header roll (e.g. "1d6" → 6), or null when absent/not single-die. */
function headerFaces(header) {
	const m = (header?.roll ?? "").trim().match(/^1?d(\d+)$/i);
	return m ? +m[1] : null;
}

/**
 * Decide whether a `table` block is a rollable dice table and, if so, return its `{formula, results}`.
 * Rows must tile 1..N with no gap or overlap; N must be a real die (or equal the block's `1dN`
 * header). Returns null otherwise — the caller keeps the static table and flags it.
 */
export function qualifyTable(block) {
	const rows = block.rows ?? [];
	if (rows.length < 2) return null;
	const ranges = rows.map((r) => parseRange(r.roll));
	if (ranges.some((r) => r === null)) return null;
	// Contiguous tiling from 1.
	const sorted = ranges.map((r, i) => ({ r, i })).sort((a, b) => a.r[0] - b.r[0]);
	if (sorted[0].r[0] !== 1) return null;
	let expect = 1;
	for (const { r } of sorted) { if (r[0] !== expect) return null; expect = r[1] + 1; }
	const N = expect - 1;
	const hf = headerFaces(block.header);
	if (hf != null) { if (hf !== N) return null; }          // header die must match the rows
	else if (!DIE_FACES.has(N)) return null;                // no header → only trust standard dice
	const results = sorted.map(({ r, i }) => ({ range: r, description: joinLines(rows[i].rest) }));
	return { formula: `1d${N}`, results };
}

/**
 * Name a qualifying table. Prefer its own header label (e.g. "Encounter"); else the nearest
 * preceding section heading; else a bare "Table". Always prefixed with the article title so the
 * pack sidebar and chat output identify the source. The caller adds a counter for collisions.
 */
const normalize = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function tableName(articleTitle, block, heading) {
	const label = block.header?.label?.trim();
	// A heading that just restates the article title (any case/punctuation) is no better than "Table".
	const useHeading = heading && normalize(heading) !== normalize(articleTitle);
	const base = label ? capitalize(label) : (useHeading ? heading : "Table");
	return `${articleTitle} — ${base}`;
}

/**
 * Walk an extracted article in reading order, qualify each `table` block, and stamp the qualifiers
 * with `block.rollTable = {id, uuid, name, formula, results}` (deterministic id keyed by article
 * slug + sequence). Returns `{ tables: [stamped blocks], skipped: [{name?, reason}] }`. Both the
 * journal build (for the inline draw link) and the table-pack build call this, so they agree on ids.
 */
export function annotateTables(article, { slug, title }) {
	const articleTitle = title ?? article.title ?? "";
	const tables = [];
	const skipped = [];
	const usedNames = new Map(); // name -> count, to disambiguate within an article
	let heading = null;          // nearest preceding section heading, in reading order

	for (const section of article.sections) {
		for (const column of [...section.left, ...section.right]) {
			for (const block of column.blocks) {
				if (block.type === "heading") { heading = block.line?.text?.trim() || heading; continue; }
				if (block.type !== "table") continue;
				const q = qualifyTable(block);
				if (!q) {
					// Capture enough to eyeball it against the PDF: where it is, the roll cells we saw,
					// and the first result. (Left as a static table in the journal — never fabricated.)
					skipped.push({
						reason: "not a clean 1..N dice table",
						heading,
						header: block.header,
						rolls: (block.rows ?? []).map((r) => (r.roll?.text ?? "").trim()),
						firstResult: joinLines((block.rows?.[0]?.rest) ?? []).replace(/<[^>]+>/g, "").slice(0, 80),
					});
					continue;
				}
				const seq = tables.length;
				const id = deterministicId(TABLE_PACK, `${slug}#table-${seq}`);
				let name = tableName(articleTitle, block, heading);
				const n = (usedNames.get(name) ?? 0) + 1;
				usedNames.set(name, n);
				if (n > 1) name = `${name} (${n})`;
				block.rollTable = { id, uuid: tableUuid(id), name, formula: q.formula, results: q.results };
				tables.push(block);
			}
		}
	}
	return { tables, skipped };
}

/**
 * Build the RollTable pack JSON for one stamped table block. Embedded TableResults carry their own
 * `_key` (= `!tables.results!<tableId>.<resultId>`) so the foundryvtt-cli packs them under the
 * parent. Each result is a v13 "text" result: the verbatim cell HTML lives in `description`
 * (the legacy `text` field is gone). GM-only via `ownership.default: 0`.
 */
export function toRollTableDoc(block, { sort = 0 } = {}) {
	const { id, name, formula, results } = block.rollTable;
	return {
		_id: id,
		_key: `!tables!${id}`,
		name,
		img: "icons/svg/d20-grey.svg",
		description: "",
		results: results.map((res, i) => {
			const rid = deterministicId(TABLE_PACK, `${id}#result-${i}`);
			return {
				_id: rid,
				_key: `!tables.results!${id}.${rid}`,
				type: "text",
				name: "",
				description: res.description,
				img: null,
				documentUuid: null,
				weight: 1,
				range: res.range,
				drawn: false,
				flags: {},
			};
		}),
		formula,
		replacement: true,
		displayRoll: true,
		folder: null,
		sort,
		ownership: { default: 0 },
		flags: { stonetop: { source: "wider-world" } },
	};
}
