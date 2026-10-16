import { describe, it, expect } from "vitest";
import { MoveMark } from "../../../../src/model/data/character/MoveMark.js";
import { ChoiceValues } from "../../../../src/model/snapshot/character/ChoiceGroup.js";

const TOPICS = {
	slug: "topics",
	list: [
		{ type: "entry", slug: "fae",          track: { max: 1 }, content: { title: null, text: "The Fae and their strange ways" } },
		{ type: "entry", slug: "things-below", track: { max: 1 }, content: { title: null, text: "The Things Below" } },
		{ type: "entry", slug: "last-door",    track: { max: 1 }, content: { title: null, text: "The Last Door, death, and the undead" } },
		{ type: "entry", content: { title: null, text: "When you Know Things…" } },
	],
};

const FIXED  = { move: "well-versed", group: "topics", options: ["things-below"] };
const PICKED = { move: "well-versed", group: "topics", options: ["fae", "things-below", "last-door"] };

describe("MoveMark.listFrom", () => {
	it("wraps every mark", () => {
		expect(MoveMark.listFrom([FIXED, PICKED]).map(m => m.options)).toEqual([FIXED.options, PICKED.options]);
	});

	it("skips a mark that names no move, group or option", () => {
		const marks = MoveMark.listFrom([
			{ group: "topics", options: ["fae"] },
			{ move: "well-versed", options: ["fae"] },
			{ move: "well-versed", group: "topics", options: [] },
			null,
		]);
		expect(marks).toEqual([]);
	});

	it("is empty for anything that is not a list", () => {
		expect(MoveMark.listFrom(undefined)).toEqual([]);
		expect(MoveMark.listFrom({})).toEqual([]);
	});
});

describe("MoveMark", () => {
	it("names the move and the group it marks", () => {
		const mark = new MoveMark(FIXED);
		expect(mark.moveSlug).toBe("well-versed");
		expect(mark.groupSlug).toBe("topics");
	});

	it("is fixed when there is one option to mark", () => {
		expect(new MoveMark(FIXED).isFixed).toBe(true);
		expect(new MoveMark(PICKED).isFixed).toBe(false);
	});

	it("keeps a background's pick apart from its other choices and from other backgrounds'", () => {
		expect(new MoveMark(PICKED).namespaceFor("witch-hunter")).toBe("witch-hunter-well-versed");
	});

	it("offers an option it lists, and no other", () => {
		const mark = new MoveMark(PICKED);
		expect(mark.offers("fae")).toBe(true);
		expect(mark.offers("makers")).toBe(false);
	});
});

describe("MoveMark#markedOption", () => {
	it("is the one option of a fixed mark, whatever was picked", () => {
		expect(new MoveMark(FIXED).markedOption(new ChoiceValues({}), "patriot")).toBe("things-below");
	});

	it("is the option picked for this background", () => {
		const values = new ChoiceValues({ "witch-hunter-well-versed": { "fae": 0, "last-door": 1 } });
		expect(new MoveMark(PICKED).markedOption(values, "witch-hunter")).toBe("last-door");
	});

	it("is null while nothing has been picked", () => {
		expect(new MoveMark(PICKED).markedOption(new ChoiceValues({}), "witch-hunter")).toBeNull();
	});

	it("ignores a pick stored for another background", () => {
		const values = new ChoiceValues({ "patriot-well-versed": { "fae": 1 } });
		expect(new MoveMark(PICKED).markedOption(values, "witch-hunter")).toBeNull();
	});
});

describe("MoveMark#pickGroup", () => {
	it("is a pick-one over the move's own rows, in the order the mark lists them", () => {
		const group = new MoveMark(PICKED).pickGroup("witch-hunter", TOPICS);
		expect(group).toEqual({
			slug: "witch-hunter-well-versed",
			list: [{ type: "pick", pickCount: 1, options: [
				{ slug: "fae",          text: "The Fae and their strange ways" },
				{ slug: "things-below", text: "The Things Below" },
				{ slug: "last-door",    text: "The Last Door, death, and the undead" },
			] }],
		});
	});

	it("is null for a fixed mark: there is nothing to pick", () => {
		expect(new MoveMark(FIXED).pickGroup("patriot", TOPICS)).toBeNull();
	});

	it("drops an option the move does not carry", () => {
		const mark  = new MoveMark({ ...PICKED, options: ["fae", "gone"] });
		const group = mark.pickGroup("witch-hunter", TOPICS);
		expect(group.list[0].options.map(o => o.slug)).toEqual(["fae"]);
	});

	it("is null when the move carries none of its options", () => {
		expect(new MoveMark(PICKED).pickGroup("witch-hunter", null)).toBeNull();
	});
});
