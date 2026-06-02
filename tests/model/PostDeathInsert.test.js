import { describe, it, expect } from "vitest";
import { PostDeathInsert } from "../../src/model/data/character/PostDeathInsert.js";

// -- Helpers ------------------------------------------------------------------

const INSTINCT_DATA = {
	slug: "instinct",
	list: [{ type: "pick", pickCount: 1, options: [{ slug: "denial", label: "Denial", description: "To refuse to accept that you are dead." }] }],
};

const LORE_DATA = [{ slug: "terrible-purpose", list: [] }];

function makeDoc(overrides = {}) {
	return {
		name:   "Revenant",
		img:    "icons/svg/skull.png",
		system: {
			slug:        "revenant",
			description: "<p>When you die...</p>",
			instinct:    INSTINCT_DATA,
			choices:     LORE_DATA,
		},
		flags: {},
		...overrides,
	};
}

// -- Tests --------------------------------------------------------------------

describe("PostDeathInsert", () => {
	it("reads slug from system.slug", () => {
		expect(new PostDeathInsert(makeDoc()).slug).toBe("revenant");
	});

	it("reads name from doc.name", () => {
		expect(new PostDeathInsert(makeDoc()).name).toBe("Revenant");
	});

	it("reads img from doc.img", () => {
		expect(new PostDeathInsert(makeDoc()).img).toBe("icons/svg/skull.png");
	});

	it("reads description from system.description", () => {
		expect(new PostDeathInsert(makeDoc()).description).toBe("<p>When you die...</p>");
	});

	it("reads instinct from system.instinct", () => {
		expect(new PostDeathInsert(makeDoc()).instinct).toBe(INSTINCT_DATA);
	});

	it("reads lore from system.choices", () => {
		const data = new PostDeathInsert(makeDoc());
		expect(data.lore).toHaveLength(1);
		expect(data.lore[0].slug).toBe("terrible-purpose");
	});

	it("defaults slug to empty string when missing", () => {
		expect(new PostDeathInsert({ name: "X", system: {}, flags: {} }).slug).toBe("");
	});

	it("defaults name to empty string when missing", () => {
		expect(new PostDeathInsert({ system: {}, flags: {} }).name).toBe("");
	});

	it("defaults img to null when missing", () => {
		expect(new PostDeathInsert({ system: {}, flags: {} }).img).toBeNull();
	});

	it("defaults description to null when missing", () => {
		expect(new PostDeathInsert({ system: {}, flags: {} }).description).toBeNull();
	});

	it("defaults instinct to null when missing", () => {
		expect(new PostDeathInsert({ system: {}, flags: {} }).instinct).toBeNull();
	});

	it("defaults lore to [] when missing", () => {
		expect(new PostDeathInsert({ system: {}, flags: {} }).lore).toEqual([]);
	});

	it("defaults instinct and lore when system is absent", () => {
		const data = new PostDeathInsert({ flags: {} });
		expect(data.instinct).toBeNull();
		expect(data.lore).toEqual([]);
	});
});
