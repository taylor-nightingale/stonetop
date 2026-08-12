import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
	ArcanaSnapshot, ArcanaSectionSnapshot, ArcanumSnapshotBuilder,
} from "../../../../src/model/snapshot/character/ArcanaSnapshot.js";

// The arcana tab's "drag arcana here" note is gated on ownership. It used to ask the minor section
// alone, so a character whose only arcanum was a major one kept the note underneath a populated
// Major Arcana section. The whole snapshot answers it now — both sections in one question.

const arcanum = (slug, owned) => new ArcanumSnapshotBuilder().withSlug(slug).withOwned(owned).build();

/** Sections list every arcanum available, owned or not — ownership is what the getters read. */
const section = (title, ...owned) =>
	new ArcanaSectionSnapshot(title, owned.map((o, i) => arcanum(`${title}-${i}`, o)));

describe("ArcanaSectionSnapshot.hasOwned", () => {
	it("is false with no items at all", () => {
		expect(section("minor").hasOwned).toBe(false);
	});

	it("is false when the section's arcana are merely available", () => {
		expect(section("minor", false, false).hasOwned).toBe(false);
	});

	it("is true as soon as one is owned", () => {
		expect(section("minor", false, true).hasOwned).toBe(true);
	});
});

describe("ArcanaSnapshot.hasOwned", () => {
	it("is false when neither section owns one", () => {
		expect(new ArcanaSnapshot(section("minor", false), section("major", false)).hasOwned).toBe(false);
	});

	it("is true on a minor arcanum", () => {
		expect(new ArcanaSnapshot(section("minor", true), section("major", false)).hasOwned).toBe(true);
	});

	// The regression: a major on its own used to leave the note showing.
	it("is true on a major arcanum", () => {
		expect(new ArcanaSnapshot(section("minor", false), section("major", true)).hasOwned).toBe(true);
	});

	it("is true when both sections own one", () => {
		expect(new ArcanaSnapshot(section("minor", true), section("major", true)).hasOwned).toBe(true);
	});

	it("is false when both sections are empty", () => {
		expect(new ArcanaSnapshot(section("minor"), section("major")).hasOwned).toBe(false);
	});
});

describe("the arcana tab's empty note", () => {
	// The template can only read what the snapshot exposes; gating on a section again would
	// reintroduce the bug, so pin which question it asks.
	it("is gated on the whole snapshot, not one section", () => {
		const template = readFileSync(
			path.resolve(process.cwd(), "templates/actor/partials/tab-arcana.hbs"), "utf8");

		expect(template).toContain("{{#unless stonetop.arcana.hasOwned}}");
	});
});
