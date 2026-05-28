import { describe, it, expect } from "vitest";
import { SteadingDebilities } from "../../../module/actors/steading/SteadingDebilities.js";
import { DebilitySnapshot } from "../../../module/model/snapshot/steading/SteadingSnapshot.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function make() {
	return new SteadingDebilities(new FakeActorBuilder().build());
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
