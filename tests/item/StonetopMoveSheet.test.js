import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { moveSheetRichText, moveResultFields, ROLL_STAT_CHOICES, rollStatChoiceLabels } from "../../src/item/StonetopMoveSheet.js";
import { STAT_KEYS } from "../../src/model/data/character/Stats.js";
import { fakeI18n } from "../fakes/foundry/FakeI18n.js";
import { RichText } from "../../src/model/snapshot/RichText.js";

describe("moveSheetRichText", () => {
	it("wraps description and the three move results as RichText", () => {
		const r = moveSheetRichText({
			description: "**hit** them",
			moveResults: {
				success: { value: "10+ text" },
				partial: { value: "7-9 text" },
				failure: { value: "miss text" },
			},
		});
		for (const k of ["description", "success", "partial", "failure"]) {
			expect(r[k]).toBeInstanceOf(RichText);
		}
		expect(r.description.raw).toBe("**hit** them");
		expect(r.success.raw).toBe("10+ text");
		expect(r.partial.raw).toBe("7-9 text");
		expect(r.failure.raw).toBe("miss text");
	});

	it("defaults missing fields to empty RichText (renders to '')", () => {
		const r = moveSheetRichText({});
		expect(r.description.render()).toBe("");
		expect(r.success.render()).toBe("");
		expect(r.partial.render()).toBe("");
		expect(r.failure.render()).toBe("");
	});
});

// The three rows the sheet AUTHORS, drawn by the same partial the season box draws a move's results
// with. All three always: a move with only a 10+ written still needs somewhere to write the other two.
describe("moveResultFields", () => {
	const system = { moveResults: {
		success: { label: "12+", value: "10+ text" },
		partial: { value: "7-9 text" },
	} };

	it("gives every tier a row, best first", () => {
		expect(moveResultFields(system).map(f => f.key)).toEqual(["success", "partial", "failure"]);
	});

	it("prints the move's own notation, and the default where it authored none", () => {
		const [success, partial, failure] = moveResultFields(system);
		expect(success.label).toBe("12+");
		expect(partial.label).toBe("7-9");
		expect(failure.label).toBe("6-");
	});

	// The textarea edits markdown; the read-only row renders the enriched text. Both off one field.
	it("carries the stored markdown and the text as it reads", () => {
		const rich = moveSheetRichText(system);
		const [success] = moveResultFields(system, rich);
		expect(success.raw).toBe("10+ text");
		expect(success.text).toBe(rich.success);
	});

	it("gives a move with no results three empty rows", () => {
		expect(moveResultFields({}).map(f => f.raw)).toEqual(["", "", ""]);
	});

	// The placeholder key is built from the tier, so the sweep over literal {{localize}} keys in the
	// templates cannot see it. This is what notices if one of the three is renamed away.
	it("names a placeholder every row can resolve", async () => {
		const en = JSON.parse(await fs.readFile(path.join(process.cwd(), "languages/en.json"), "utf8"));
		for (const field of moveResultFields({})) {
			const value = field.placeholderKey.split(".").reduce((node, part) => node?.[part], en);
			expect(typeof value).toBe("string");
		}
	});
});

// A stored rollStat with no matching <option> doesn't just display wrong: the select falls back to
// its first entry ("— No Roll —") and the next submit writes that over the move's real roll. So the
// choice list has to cover every key resolveBonus can answer.
describe("ROLL_STAT_CHOICES", () => {
	it("offers the character's six stats", () => {
		for (const stat of ["str", "dex", "con", "int", "wis", "cha"]) {
			expect(ROLL_STAT_CHOICES).toHaveProperty(stat);
		}
	});

	// Requisition rolls +Fortunes: a character move resolved through its home steading.
	it("offers the steading ratings a character move can roll", () => {
		for (const rating of ["fortunes", "prosperity", "population", "defenses"]) {
			expect(ROLL_STAT_CHOICES).toHaveProperty(rating);
		}
	});

	it("covers the rollStat of every move the system ships", async () => {
		const files = await packMoveFiles();
		const missing = (await Promise.all(files.map(async f => {
			const stat = JSON.parse(await fs.readFile(f, "utf8")).system?.rollStat;
			return stat && !(stat in ROLL_STAT_CHOICES) ? `${path.basename(f)}: ${stat}` : null;
		}))).filter(Boolean);
		expect(missing).toEqual([]);
	});

	it("every label resolves to a string in en.json", () => {
		const i18n = fakeI18n();
		expect(Object.values(ROLL_STAT_CHOICES).filter(key => !i18n.has(key))).toEqual([]);
	});

	// The six stats point at the SAME abbreviation the stat tiles draw. One translation of "STR",
	// rather than two families a translator has to keep in step — the dropdown's "+" is a fact about
	// the dropdown, so it is composed here rather than written into six more strings.
	it("names the six stats from the same key the stat tiles use", () => {
		for (const stat of ["str", "dex", "con", "int", "wis", "cha"]) {
			expect(ROLL_STAT_CHOICES[stat]).toBe(`stonetop.character.stats.abbr.${stat}`);
		}
	});
});

describe("rollStatChoiceLabels", () => {
	// The harness's localize returns the key, which makes the composition visible: what the label
	// builder adds is exactly the plus, and exactly on the six.
	const labels = () => rollStatChoiceLabels(k => k);

	it("puts a plus on every one of the character's stats", () => {
		for (const stat of STAT_KEYS) {
			expect(labels()[stat], `${stat} lost its plus`)
				.toBe(`+stonetop.character.stats.abbr.${stat}`);
		}
	});

	// A steading rating is named outright ("Fortunes (steading)"), and ask/prompt are not rolls at
	// all — a plus on either would be claiming a bonus that does not exist.
	it("leaves everything that is not a character stat alone", () => {
		const built = labels();
		for (const key of Object.keys(ROLL_STAT_CHOICES)) {
			if (STAT_KEYS.includes(key)) continue;
			expect(built[key], `${key} was given a plus`).toBe(ROLL_STAT_CHOICES[key]);
		}
	});

	it("offers a label for every choice, losing none", () => {
		expect(Object.keys(labels()).sort()).toEqual(Object.keys(ROLL_STAT_CHOICES).sort());
	});

	// The real thing a player sees, against the real strings.
	it("reads as the book writes a roll", () => {
		const i18n = fakeI18n();
		const built = rollStatChoiceLabels(k => (i18n.has(k) ? i18n.format(k) : k));
		expect(built.str).toBe("+STR");
		expect(built.fortunes).toBe("Fortunes (steading)");
	});
});

async function packMoveFiles(dir = path.join(process.cwd(), "packs/src/moves")) {
	const out = [];
	for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
		if (entry.name.startsWith("_")) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...await packMoveFiles(full));
		else if (entry.name.endsWith(".json")) out.push(full);
	}
	return out;
}
