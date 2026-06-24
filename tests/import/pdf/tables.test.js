import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { extractArticle } from "../../../scripts/import/pdf/layout.js";
import { qualifyTable, tableName, annotateTables, toRollTableDoc, tableUuid } from "../../../scripts/import/pdf/tables.js";

const load = (name) =>
	JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.lines.json`, import.meta.url)), "utf8"));

const ARATIS = "Aratis, the Lawkeeper";
const tableBlocks = (name, title) => {
	const art = extractArticle(load(name), { title });
	const out = [];
	for (const s of art.sections) for (const c of [...s.left, ...s.right]) for (const b of c.blocks) if (b.type === "table") out.push(b);
	return out;
};

// A hand-built `table` block (cells only need a `.text` for roll parsing + `.spans` for joinLines).
const cell = (text) => ({ text, spans: [{ font: "", text }] });
const mkTable = (rolls, header = null) => ({
	type: "table",
	header,
	rows: rolls.map((roll, i) => ({ roll: cell(roll), rest: [cell(`result ${i}`)] })),
});

describe("qualifyTable", () => {
	const [d12, d6] = tableBlocks("aratis", ARATIS);

	it("qualifies a headerless table that tiles 1..12 as 1d12", () => {
		const q = qualifyTable(d12);
		expect(q.formula).toBe("1d12");
		expect(q.results).toHaveLength(9);
		expect(q.results[0].range).toEqual([1, 2]);   // "1-2"
		expect(q.results.at(-1).range).toEqual([12, 12]); // "12"
	});

	it("uses a 1dN header and keeps verbatim result HTML in the description", () => {
		const q = qualifyTable(d6);
		expect(q.formula).toBe("1d6");
		expect(q.results).toHaveLength(6);
		expect(q.results[0].description).toContain("<strong>A grim peat mound</strong>");
	});

	it("rejects a table with a gap in its ranges", () => {
		expect(qualifyTable(mkTable(["1", "2", "4", "5", "6"]))).toBeNull(); // missing 3
	});

	it("rejects a table that does not start at 1", () => {
		expect(qualifyTable(mkTable(["2", "3", "4", "5", "6"]))).toBeNull();
	});

	it("rejects a non-standard die size when there is no header to vouch for it", () => {
		expect(qualifyTable(mkTable(["1", "2", "3", "4", "5", "6", "7"]))).toBeNull(); // 1..7
	});

	it("rejects when an explicit header die disagrees with the rows", () => {
		expect(qualifyTable(mkTable(["1", "2", "3", "4", "5", "6"], { roll: "1d12" }))).toBeNull();
	});

	it("accepts a non-standard size only when a header vouches for it", () => {
		const q = qualifyTable(mkTable(["1", "2", "3", "4", "5", "6", "7"], { roll: "1d7" }));
		expect(q.formula).toBe("1d7");
	});
});

describe("tableName", () => {
	it("prefers the header label, prefixed with the article title", () => {
		expect(tableName(ARATIS, { header: { label: "minor arcanum" } }, "Themes"))
			.toBe(`${ARATIS} — Minor arcanum`);
	});
	it("falls back to the nearest heading when there is no label", () => {
		expect(tableName(ARATIS, { header: null }, "Themes")).toBe(`${ARATIS} — Themes`);
	});
	it("falls back to 'Table' when the heading is just the article title", () => {
		expect(tableName(ARATIS, { header: null }, ARATIS)).toBe(`${ARATIS} — Table`);
	});
});

describe("annotateTables", () => {
	const art = extractArticle(load("aratis"), { title: ARATIS });
	const slug = "aratis-the-lawkeeper";
	const { tables, skipped } = annotateTables(art, { slug, title: ARATIS });

	it("stamps every qualifying table with a deterministic id and uuid", () => {
		expect(tables).toHaveLength(2);
		expect(skipped).toHaveLength(0);
		for (const t of tables) {
			expect(t.rollTable.id).toMatch(/^[A-Za-z0-9]{16}$/);
			expect(t.rollTable.uuid).toBe(tableUuid(t.rollTable.id));
		}
		// Distinct ids per table (keyed by sequence).
		expect(tables[0].rollTable.id).not.toBe(tables[1].rollTable.id);
	});

	it("names the tables from their book caption (the dice-header label)", () => {
		expect(tables.map((t) => t.rollTable.name)).toEqual([
			`${ARATIS} — Theme`,        // from the "1d12 theme" caption, not the "Themes" heading
			`${ARATIS} — Minor arcanum`,
		]);
	});

	it("is deterministic across runs (same ids the journal build will reference)", () => {
		const again = annotateTables(extractArticle(load("aratis"), { title: ARATIS }), { slug, title: ARATIS });
		expect(again.tables.map((t) => t.rollTable.id)).toEqual(tables.map((t) => t.rollTable.id));
	});

	it("disambiguates duplicate names within an article with a counter", () => {
		const dupArt = { title: "X", sections: [{ left: [{ blocks: [
			mkTable(["1", "2", "3", "4", "5", "6"], { label: "encounter" }),
			mkTable(["1", "2", "3", "4", "5", "6"], { label: "encounter" }),
		] }], right: [] }] };
		const out = annotateTables(dupArt, { slug: "x", title: "X" });
		expect(out.tables.map((t) => t.rollTable.name)).toEqual(["X — Encounter", "X — Encounter (2)"]);
	});
});

describe("toRollTableDoc", () => {
	const art = extractArticle(load("aratis"), { title: ARATIS });
	const { tables } = annotateTables(art, { slug: "aratis-the-lawkeeper", title: ARATIS });
	const doc = toRollTableDoc(tables[0], { sort: 1100 });

	it("produces a GM-locked RollTable with the right top-level shape", () => {
		expect(doc._key).toBe(`!tables!${doc._id}`);
		expect(doc.name).toBe(`${ARATIS} — Theme`);
		expect(doc.formula).toBe("1d12");
		expect(doc.ownership).toEqual({ default: 0 });
		expect(doc.sort).toBe(1100);
		expect(doc.type).toBeUndefined(); // RollTable has no top-level type
	});

	it("embeds each result with its own _key, range, and verbatim description", () => {
		expect(doc.results).toHaveLength(9);
		for (const res of doc.results) {
			expect(res._key).toBe(`!tables.results!${doc._id}.${res._id}`);
			expect(res.type).toBe("text");
			expect(res.range).toHaveLength(2);
			expect(res.weight).toBe(1);
			expect(res.description.length).toBeGreaterThan(0);
		}
		expect(doc.results[0].range).toEqual([1, 2]);
	});

	it("gives results deterministic, distinct ids", () => {
		const ids = doc.results.map((r) => r._id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(toRollTableDoc(tables[0]).results[0]._id).toBe(doc.results[0]._id);
	});
});
