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

// The tab lists what the character holds beside the one card being read. Majors come first, as the
// book orders them, and a section with nothing owned in it has no place in the list.
describe("ArcanaSnapshot.sections", () => {
	it("puts the major section before the minor", () => {
		const minor = section("minor", true), major = section("major", true);
		expect(new ArcanaSnapshot(minor, major).sections).toEqual([major, minor]);
	});

	it("leaves out a section that owns nothing", () => {
		const minor = section("minor", true), major = section("major", false);
		expect(new ArcanaSnapshot(minor, major).sections).toEqual([minor]);
	});

	it("is empty when nothing is owned", () => {
		expect(new ArcanaSnapshot(section("minor"), section("major")).sections).toEqual([]);
	});
});

describe("ArcanaSectionSnapshot.owned", () => {
	it("is the owned arcana only, in their order", () => {
		const s = section("minor", true, false, true);
		expect(s.owned.map(a => a.slug)).toEqual(["minor-0", "minor-2"]);
	});
});

// One arcanum is the card and nothing else: a list of one chooses nothing.
describe("ArcanaSnapshot.showList", () => {
	it("is false with one arcanum", () => {
		expect(new ArcanaSnapshot(section("minor", true), section("major")).showList).toBe(false);
	});

	it("is true with two, across both sections", () => {
		expect(new ArcanaSnapshot(section("minor", true), section("major", true)).showList).toBe(true);
	});

	it("counts owned arcana, not those merely available", () => {
		expect(new ArcanaSnapshot(section("minor", true, false), section("major", false)).showList).toBe(false);
	});
});

describe("ArcanumSnapshot.face", () => {
	const front = { title: "A beaded satchel" }, back = { title: "Satchel of Plenty" };
	const card = flipped => new ArcanumSnapshotBuilder().withFront(front).withBack(back).withFlipped(flipped).build();

	it("is the front while unflipped", () => {
		expect(card(false).face).toBe(front);
	});

	it("is the back once flipped", () => {
		expect(card(true).face).toBe(back);
	});
});

// The list line names the arcanum and then what lies face up. A major's ◇ item is usually the arcanum
// itself ("Mindgem" carried as "Mindgem"), and repeating the name under the name says nothing.
describe("ArcanumSnapshot.listedItem", () => {
	const card = (name, itemName, flipped = false) => new ArcanumSnapshotBuilder().withName(name)
		.withFront({ item: itemName ? { name: itemName } : null }).withBack({ item: { name: "A back item" } })
		.withFlipped(flipped).build();

	it("is the face-up side's item when it names something else", () => {
		expect(card("A redwood basin", "A beaded basin").listedItem).toEqual({ name: "A beaded basin" });
	});

	it("is null when the item only repeats the arcanum's name", () => {
		expect(card("Mindgem", "Mindgem").listedItem).toBeNull();
	});

	it("is null when the face-up side carries no item", () => {
		expect(card("A... key?", null).listedItem).toBeNull();
	});

	it("reads the back once flipped", () => {
		expect(card("Mindgem", "Mindgem", true).listedItem).toEqual({ name: "A back item" });
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
