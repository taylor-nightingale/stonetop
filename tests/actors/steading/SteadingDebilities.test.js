import { describe, it, expect } from "vitest";
import { SteadingDebilities } from "../../../src/actors/steading/SteadingDebilities.js";
import { DebilitySnapshot } from "../../../src/model/snapshot/steading/SteadingSnapshot.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

function make() {
	return new SteadingDebilities(new FakeSteadingBuilder().build());
}

describe("SteadingDebilities.buildSnapshot", () => {
	it("defaults all debilities to inactive", () => {
		expect(make().buildSnapshot().every(s => !s.active)).toBe(true);
	});

	it("returns all three slugs in order", () => {
		expect(make().buildSnapshot().map(s => s.slug)).toEqual(["diminished", "lacking", "malcontent"]);
	});

	it("returns DebilitySnapshot instances", () => {
		expect(make().buildSnapshot()[0]).toBeInstanceOf(DebilitySnapshot);
	});
});

describe("SteadingDebilities.isActive", () => {
	it("is false for a debility that was never marked", () => {
		expect(make().isActive("lacking")).toBe(false);
	});

	it("is true once the debility is marked", async () => {
		const d = make();
		await d.setDebility("lacking", true);
		expect(d.isActive("lacking")).toBe(true);
	});

	it("is false again once the debility is cleared", async () => {
		const d = make();
		await d.setDebility("lacking", true);
		await d.setDebility("lacking", false);
		expect(d.isActive("lacking")).toBe(false);
	});

	it("is false for a slug the steading has no state for", () => {
		expect(make().isActive("bankrupt")).toBe(false);
	});

	// Legacy worlds stored debilities as {value: bool}; a truthy object must not read as marked.
	it("does not treat a non-boolean stored value as active", () => {
		const d = new SteadingDebilities({ system: { debilities: { lacking: { value: true } } } });
		expect(d.isActive("lacking")).toBe(false);
	});
});

describe("SteadingDebilities.setDebility", () => {
	it("marks a debility active", async () => {
		const d = make();
		await d.setDebility("diminished", true);
		expect(d.buildSnapshot().find(s => s.slug === "diminished").active).toBe(true);
	});

	it("marks a previously active debility inactive", async () => {
		const d = make();
		await d.setDebility("diminished", true);
		await d.setDebility("diminished", false);
		expect(d.buildSnapshot().find(s => s.slug === "diminished").active).toBe(false);
	});

	it("preserves other debility states when setting one", async () => {
		const d = make();
		await d.setDebility("lacking", true);
		await d.setDebility("diminished", true);
		const snap = d.buildSnapshot();
		expect(snap.find(s => s.slug === "lacking").active).toBe(true);
		expect(snap.find(s => s.slug === "diminished").active).toBe(true);
		expect(snap.find(s => s.slug === "malcontent").active).toBe(false);
	});
});
