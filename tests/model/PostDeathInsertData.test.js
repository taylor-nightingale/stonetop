import { describe, it, expect } from "vitest";
import { PostDeathInsertData } from "../../module/model/PostDeathInsertData.js";

// -- Helpers ------------------------------------------------------------------

function makeDoc(overrides = {}) {
	return {
		name:   "Revenant",
		img:    "icons/svg/skull.svg",
		system: {
			slug:        "revenant",
			description: "<p>When you die...</p>",
		},
		flags: {
			stonetop: {
				instincts: [{ word: "Denial", description: "To refuse to accept that you are dead." }],
				lore:      [{ slug: "terrible-purpose", title: "Terrible Purpose", description: "", options: [] }],
			},
		},
		...overrides,
	};
}

// -- Tests --------------------------------------------------------------------

describe("PostDeathInsertData", () => {
	it("reads slug from system.slug", () => {
		expect(new PostDeathInsertData(makeDoc()).slug).toBe("revenant");
	});

	it("reads name from doc.name", () => {
		expect(new PostDeathInsertData(makeDoc()).name).toBe("Revenant");
	});

	it("reads img from doc.img", () => {
		expect(new PostDeathInsertData(makeDoc()).img).toBe("icons/svg/skull.svg");
	});

	it("reads description from system.description", () => {
		expect(new PostDeathInsertData(makeDoc()).description).toBe("<p>When you die...</p>");
	});

	it("reads instincts from flags.stonetop.instincts", () => {
		const data = new PostDeathInsertData(makeDoc());
		expect(data.instincts).toHaveLength(1);
		expect(data.instincts[0].word).toBe("Denial");
	});

	it("reads lore from flags.stonetop.lore", () => {
		const data = new PostDeathInsertData(makeDoc());
		expect(data.lore).toHaveLength(1);
		expect(data.lore[0].slug).toBe("terrible-purpose");
	});

	it("defaults slug to empty string when missing", () => {
		expect(new PostDeathInsertData({ name: "X", system: {}, flags: {} }).slug).toBe("");
	});

	it("defaults name to empty string when missing", () => {
		expect(new PostDeathInsertData({ system: {}, flags: {} }).name).toBe("");
	});

	it("defaults img to null when missing", () => {
		expect(new PostDeathInsertData({ system: {}, flags: {} }).img).toBeNull();
	});

	it("defaults description to null when missing", () => {
		expect(new PostDeathInsertData({ system: {}, flags: {} }).description).toBeNull();
	});

	it("defaults instincts to [] when missing", () => {
		expect(new PostDeathInsertData({ system: {}, flags: { stonetop: {} } }).instincts).toEqual([]);
	});

	it("defaults lore to [] when missing", () => {
		expect(new PostDeathInsertData({ system: {}, flags: { stonetop: {} } }).lore).toEqual([]);
	});

	it("defaults instincts and lore to [] when flags.stonetop is absent", () => {
		const data = new PostDeathInsertData({ system: {}, flags: {} });
		expect(data.instincts).toEqual([]);
		expect(data.lore).toEqual([]);
	});
});
