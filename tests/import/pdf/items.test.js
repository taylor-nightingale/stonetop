import { describe, it, expect } from "vitest";
import {
	tableSections, sectionLines, rowClusters, parseRow, parseItemPage, tableLead,
	attachTableMarkers, statMarkdown, parseStatBlock, lineText, knownTagSlugs, BookItem,
} from "../../../scripts/import/pdf/items.js";

// Lines as parseStext yields them. A value table is read off geometry AND font, so both are spelled
// out: `runs` is a list of [text, font] so a row can mix the book's roman/italic/bold faces the way
// the page does, and `xs` is filled in per character because spliceGlyph places markers by x.
const REG = "ACaslonPro-Regular", ITA = "ACaslonPro-Italic", BOLD = "ACaslonPro-Bold";
const FELL = "Historical-FellTypeRoman", AVARA = "Avara-Bold", DING = "ZapfDingbats";

const CH = 4; // nominal character advance, so xs are monotonic and rows line up predictably

function line(runs, x, y, size = 8) {
	let cursor = x;
	const spans = runs.map(([text, font = REG]) => {
		const xs = [...text].map((_, i) => cursor + i * CH);
		cursor += text.length * CH;
		return { font, size, text, xs };
	});
	const text = spans.map((s) => s.text).join("");
	return { bbox: [x, y, cursor, y + 9], text, font: spans[0]?.font ?? REG, size, spans };
}
const row   = (runs, x, y) => line(runs, x, y);
const value = (v, y) => line([[v]], 572, y);
const head  = (title, y) => line([[title, FELL]], 432, y, 9);
const val   = (y) => line([["value", FELL]], 564, y, 9);

const page = (...lines) => ({ width: 792, height: 612, lines });

describe("tableSections", () => {
	it("pairs a section heading with the value heading on its own rule", () => {
		const [s] = tableSections(page(head("weapons", 177), val(177)));
		expect(s.title).toBe("weapons");
		expect(s.band.left).toBe(432);
		expect(s.band.valueX).toBe(564);
	});

	it("ends a section where the next one in the same column begins", () => {
		const [weapons, armor] = tableSections(page(head("weapons", 177), val(177), head("armor", 367), val(367)));
		expect(weapons.band.bottom).toBe(367);
		expect(armor.band.bottom).toBe(Infinity);
	});

	it("ignores a heading with no value heading beside it", () => {
		expect(tableSections(page(head("Common items", 86)))).toEqual([]);
	});
});

describe("sectionLines", () => {
	it("keeps the column's body and drops the folio set in the display face", () => {
		const [s] = tableSections(page(head("weapons", 177), val(177)));
		const p = page(head("weapons", 177), val(177), row([["Staff (close)"]], 432, 190), line([["95", AVARA]], 574, 585, 9));
		expect(sectionLines(p, s).map((l) => l.text)).toEqual(["Staff (close)"]);
	});
});

describe("rowClusters", () => {
	it("groups a row's value cell with its name and starts a new row further down", () => {
		const lines = [row([["Staff"]], 432, 190), value("0", 190), row([["Sling"]], 432, 209), value("0", 210)];
		expect(rowClusters(lines).map((c) => c.map((l) => l.text))).toEqual([["Staff", "0"], ["Sling", "0"]]);
	});

	it("puts a wrapped continuation in a cluster of its own", () => {
		const lines = [row([["Bow"]], 432, 190), value("0", 190), row([["low ammo)"]], 451, 199)];
		expect(rowClusters(lines)).toHaveLength(2);
	});
});

describe("parseRow", () => {
	const section = { title: "weapons", band: { left: 432, valueX: 564, right: 585, top: 177, bottom: 367 } };
	const parse = (lines, known = new Set()) => parseRow(lines, section, "common", known);

	it("splits the name from its parenthetical, and tags from mechanical notes by face", () => {
		const item = parse([row([["◇ "], ["Sword", BOLD], [", iron ("], ["close", ITA], [", +1 damage)"]], 432, 190), value("1", 190)]);
		expect(item.name).toBe("Sword, iron");
		expect(item.tagList).toEqual(["close"]);
		expect(item.note).toBe("+1 damage");
		expect(item.value).toBe(1);
	});

	it("counts leading load diamonds as weight, and no diamond as a small item", () => {
		expect(parse([row([["◇◇ Maul, iron"]], 432, 190), value("0", 190)]).weight).toBe(2);
		const small = parse([row([["Gloves"]], 432, 190), value("0", 190)]);
		expect(small.weight).toBe(0);
		expect(small.inventoryColumn).toBe("small");
	});

	it("records the book's starred Value as a footnote reference", () => {
		expect(parse([row([["Battleaxe"]], 432, 190), value("1*", 190)]).footnoted).toBe(true);
	});

	it("turns each ○ into a resource slot labelled with the text that follows it", () => {
		const item = parse([row([["Extra arrows (○ plenty left, ○ low ammo, ○ all out)"]], 432, 190), value("0", 190)]);
		expect(item.resource).toEqual({ max: 3, title: null, labels: ["plenty left", "low ammo", "all out"] });
		expect(item.note).toBe("");
	});

	it("labels only the last slot when the circles run together", () => {
		const item = parse([row([["Oil lamp (○○○ hours)"]], 432, 190), value("0", 190)]);
		expect(item.resource.labels).toEqual(["", "", "hours"]);
	});

	it("reads an armor rating as a base value or a stacking modifier", () => {
		expect(parse([row([["Thick hides (1 armor)"]], 432, 190), value("0", 190)]).armor).toEqual({ base: 1 });
		expect(parse([row([["Shield (+1 armor)"]], 432, 190), value("0", 190)]).armor).toEqual({ modifier: 1 });
	});

	it("reads a known tag the book failed to italicise as a tag anyway", () => {
		const roman = [row([["Cloak (warm)"]], 432, 190), value("0", 190)];
		expect(parse(roman).note).toBe("warm");                                  // face alone: a note
		expect(parse(roman, new Set(["warm"])).tagList).toEqual(["warm"]);       // glossary corroborates
	});

	it("cuts the parenthetical at the last ) even when punctuation follows it", () => {
		expect(parse([row([["Candle (lasts ~1 hour, ", REG], ["close", ITA], [", ", REG], ["area", ITA], [")."]], 432, 190), value("0", 190)]).note)
			.toBe("lasts ~1 hour");
	});

	it("returns null for a row with no value cell", () => {
		expect(parse([row([["awkward)"]], 444, 297)])).toBeNull();
	});
});

describe("parseItemPage", () => {
	it("folds a wrapped continuation into the row above it", () => {
		const p = page(head("armor", 177), val(177),
			row([["◇◇ Shield (+1 armor, +1 Readiness on"]], 432, 190), value("0", 190),
			row([["a 7+ to Defend)"]], 444, 199));
		const [section] = parseItemPage(p, "common");
		expect(section.items).toHaveLength(1);
		expect(section.items[0].note).toBe("+1 armor, +1 Readiness on a 7+ to Defend");
	});

	it("keeps a section's footnote off the item list", () => {
		const p = page(head("weapons of war", 177), val(177),
			row([["Battleaxe, iron"]], 432, 190), value("1*", 190),
			row([["*Value 2 to get 1 piercing"]], 432, 210));
		const [section] = parseItemPage(p, "special");
		expect(section.items.map((i) => i.name)).toEqual(["Battleaxe, iron"]);
		expect(section.footnote).toBe("*Value 2 to get 1 piercing");
	});
});

describe("tableLead", () => {
	const title = (t, x) => line([[t, AVARA]], x, 86, 12);

	it("reads the paragraph the book sets under the table's title", () => {
		const p = page(title("Common items", 432), head("weapons", 177), val(177),
			row([["The following are commonly available,"]], 432, 99),
			row([["mundane items."]], 432, 109));
		expect(tableLead(p, tableSections(p))).toBe("The following are commonly available, mundane items.");
	});

	it("ignores a facing sidebar's title, which stands over no column of this table", () => {
		const p = page(title("Gear terms & tags", 36), title("Common items", 432),
			head("weapons", 177), val(177),
			row([["Many items appear with a list of terms"]], 36, 99),
			row([["The following are commonly available."]], 432, 99));
		expect(tableLead(p, tableSections(p))).toBe("The following are commonly available.");
	});

	it("stops at the column's right edge, not one column-width over", () => {
		const p = page(title("Common items", 432), head("weapons", 177), val(177),
			row([["The lead."]], 432, 99),
			row([["Rushlight (lasts ~15-30 minutes,"]], 600, 161));   // the next column's first row
		expect(tableLead(p, tableSections(p))).toBe("The lead.");
	});
});

describe("attachTableMarkers", () => {
	it("splices a circle at its own x, so resource labels keep the book's order", () => {
		const l = row([["Extra arrows (x piercing,  plenty left)"]], 432, 190);
		attachTableMarkers(page(l), [{ x: 432 + 26 * CH, y: 196, w: 5, h: 5, kind: "circle" }]);
		expect(l.text).toContain("○ plenty left");
	});

	it("prepends a leading diamond that sits left of every character", () => {
		const l = row([["Staff (close)"]], 438, 190);
		attachTableMarkers(page(l), [{ x: 432, y: 196, w: 6, h: 6, kind: "diamond" }]);
		expect(l.text).toBe("◇Staff (close)");
	});

	it("appends a glyph that trails the last character instead of leading the line", () => {
		const l = row([["worth a "]], 605, 414);
		attachTableMarkers(page(l), [{ x: l.bbox[2] + 2, y: 420, w: 6, h: 6, kind: "diamond" }]);
		expect(l.text).toBe("worth a ◇");
	});

	it("never hangs a marker on a bare value cell", () => {
		const name = row([["Extra arrows (x piercing,"]], 438, 209);
		const cell = value("0", 210);
		attachTableMarkers(page(name, cell), [{ x: 521, y: 215, w: 5, h: 5, kind: "circle" }]);
		expect(cell.text).toBe("0");
		expect(name.text).toContain("○");
	});
});

describe("statMarkdown", () => {
	it("wraps the book's italic damage tags in markdown emphasis", () => {
		const lines = [line([["HP 6; ", BOLD], ["Damage d6 ("], ["hand", ITA], [", "], ["grabby", ITA], [");"]], 612, 112)];
		expect(statMarkdown(lines)).toBe("HP 6; Damage d6 (_hand_, _grabby_);");
	});
});

describe("parseStatBlock", () => {
	it("reads each labelled clause into the creature shape toFollowerDoc consumes", () => {
		const c = parseStatBlock("HP 6; Damage d6 (_hand_); Instinct to get distracted; Cost training",
			{ name: "Dog", tagList: ["keen-nosed"] });
		expect(c.hp).toEqual({ value: 6, max: 6 });
		expect(c.damage).toBe("d6 (_hand_)");
		expect(c.instinct).toBe("to get distracted");
		expect(c.cost).toBe("training");
		expect(c.tagList).toEqual(["keen-nosed"]);
	});

	it("keeps an unlabelled trailing clause as a special quality", () => {
		expect(parseStatBlock("HP 3; Instinct to explore; butcher for ◇ provisions (○ uses)").specialQuality)
			.toBe("butcher for ◇ provisions (○ uses)");
	});
});

describe("lineText", () => {
	it("translates the book's dingbat load diamond back into ◇", () => {
		expect(lineText(line([["butcher for "], ["4", DING], [" provisions"]], 612, 171))).toBe("butcher for ◇ provisions");
	});
});

describe("knownTagSlugs", () => {
	it("reads the tag tokens out of the language file's glossary", () => {
		const en = { stonetop: { tagGlossary: { general: { warm: "…", thrown: "…" }, range: { close: "…" } } } };
		expect(knownTagSlugs(en)).toEqual(new Set(["warm", "thrown", "close"]));
	});
});

describe("BookItem", () => {
	it("calls an item with no load diamond a small item", () => {
		const item = new BookItem("common", "household goods");
		expect(item.inventoryColumn).toBe("small");
		item.weight = 1;
		expect(item.inventoryColumn).toBe("regular");
	});
});
