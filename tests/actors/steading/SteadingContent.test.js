import { describe, it, expect } from "vitest";
import { SteadingContent } from "../../../src/actors/steading/SteadingContent.js";
import { ContentSection } from "../../../src/model/snapshot/steading/SteadingSnapshot.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

function make() {
	return new SteadingContent(new FakeSteadingBuilder().build());
}

describe("SteadingContent.buildSnapshot", () => {
	it("returns three ContentSection instances", () => {
		const snap = make().buildSnapshot();
		expect(snap).toHaveLength(3);
		expect(snap[0]).toBeInstanceOf(ContentSection);
	});

	it("sections have correct slugs in order", () => {
		expect(make().buildSnapshot().map(s => s.slug)).toEqual(["excluded", "veiled", "specialHandling"]);
	});

	it("each section defaults to empty items", () => {
		make().buildSnapshot().forEach(s => expect(s.items).toEqual([]));
	});

	// The English lived in SteadingContent.js until 1.7.0, which made three headings on a shipped tab
	// untranslatable. It is localized from the slug now, the way a debility is.
	it("localizes each section's heading from its slug", () => {
		expect(make().buildSnapshot().map(s => s.label.raw)).toEqual([
			"stonetop.steading.content.sections.excluded.label",
			"stonetop.steading.content.sections.veiled.label",
			"stonetop.steading.content.sections.specialHandling.label",
		]);
	});

	it("localizes the gloss under the headings that have one", () => {
		const notes = Object.fromEntries(make().buildSnapshot().map(s => [s.slug, s.note.raw]));
		expect(notes.excluded).toBe("stonetop.steading.content.sections.excluded.note");
		expect(notes.veiled).toBe("stonetop.steading.content.sections.veiled.note");
	});

	// The book prints no gloss under Special Handling, so there is no key for one — and an absent key
	// has to come back as nothing rather than as the key itself, which is what a bare localize()
	// would render into the heading.
	it("leaves the note empty where the book prints none", () => {
		expect(make().buildSnapshot().find(s => s.slug === "specialHandling").note.raw).toBe("");
	});
});

describe("SteadingContent.addItem", () => {
	it("appends an empty string to the section", async () => {
		const c = make();
		await c.addItem("excluded");
		expect(c.buildSnapshot().find(s => s.slug === "excluded").items).toEqual([""]);
	});

	it("does not affect other sections", async () => {
		const c = make();
		await c.addItem("excluded");
		expect(c.buildSnapshot().find(s => s.slug === "veiled").items).toEqual([]);
	});

	it("appends to existing items", async () => {
		const c = make();
		await c.addItem("excluded");
		await c.addItem("excluded");
		expect(c.buildSnapshot().find(s => s.slug === "excluded").items).toHaveLength(2);
	});
});

describe("SteadingContent.removeItem", () => {
	it("removes item at the given index", async () => {
		const c = make();
		await c.addItem("excluded");
		await c.addItem("excluded");
		await c.updateItem("excluded", 0, "violence");
		await c.updateItem("excluded", 1, "torture");
		await c.removeItem("excluded", 0);
		expect(c.buildSnapshot().find(s => s.slug === "excluded").items).toEqual(["torture"]);
	});

	it("does not affect other sections", async () => {
		const c = make();
		await c.addItem("excluded");
		await c.addItem("veiled");
		await c.updateItem("veiled", 0, "drugs");
		await c.removeItem("excluded", 0);
		expect(c.buildSnapshot().find(s => s.slug === "veiled").items).toEqual(["drugs"]);
	});
});

describe("SteadingContent.updateItem", () => {
	it("updates the value at the given index", async () => {
		const c = make();
		await c.addItem("excluded");
		await c.updateItem("excluded", 0, "graphic violence");
		expect(c.buildSnapshot().find(s => s.slug === "excluded").items[0]).toBe("graphic violence");
	});

	it("does not affect other items in the section", async () => {
		const c = make();
		await c.addItem("excluded");
		await c.addItem("excluded");
		await c.updateItem("excluded", 0, "violence");
		await c.updateItem("excluded", 1, "torture");
		await c.updateItem("excluded", 0, "graphic violence");
		expect(c.buildSnapshot().find(s => s.slug === "excluded").items[1]).toBe("torture");
	});
});
