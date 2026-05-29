import { describe, it, expect } from "vitest";
import { SteadingContent } from "../../../module/actors/steading/SteadingContent.js";
import { ContentSection } from "../../../module/model/snapshot/steading/SteadingSnapshot.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function make() {
	return new SteadingContent(new FakeActorBuilder().build());
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

	it("excluded section has correct note", () => {
		const excluded = make().buildSnapshot().find(s => s.slug === "excluded");
		expect(excluded.note).toBe("(Not part of the game, on-camera or off)");
	});

	it("veiled section has correct note", () => {
		const veiled = make().buildSnapshot().find(s => s.slug === "veiled");
		expect(veiled.note).toBe("(Part of the fiction, but only off-camera)");
	});

	it("specialHandling section has null note", () => {
		expect(make().buildSnapshot().find(s => s.slug === "specialHandling").note).toBeNull();
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
