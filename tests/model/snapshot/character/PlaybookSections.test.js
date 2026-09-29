import { describe, it, expect } from "vitest";
import { PlaybookSections, PlaybookSection, LoreSection }
	from "../../../../src/model/snapshot/character/PlaybookSections.js";
import { PlaybookSnapshotBuilder, BackgroundSection, BackgroundOptionSnapshotBuilder, OriginSection, OriginOptionSnapshot, IntroductionsSnapshot }
	from "../../../../src/model/snapshot/character/PlaybookSnapshot.js";
import { buildChoiceGroup } from "../../../../src/model/snapshot/character/buildChoiceGroup.js";
import { ChoiceValues } from "../../../../src/model/snapshot/character/ChoiceGroup.js";

// D11: every section of the Playbook tab rests on what was chosen and has one door on its bar —
// Change once something is chosen, Choose before, Open for the introductions, which are opened
// rather than chosen, and none where there is nothing to choose.

const group = (def, values = {}) => buildChoiceGroup(def, new ChoiceValues(values));
const prose = (slug, title) => ({ slug, list: [{ type: "entry", content: { title, text: `${title}, in the book's words.` } }] });
const picks = (slug, title, options = ["a", "b"]) => ({ slug, list: [
	...(title ? [{ type: "entry", content: { title, text: "Answer." } }] : []),
	{ type: "pick", pickCount: 1, options: options.map(o => ({ slug: o, text: o })) },
] });

const background = selected => new BackgroundSection(selected, ["a", "b"].map(slug =>
	new BackgroundOptionSnapshotBuilder().withSlug(slug).withLabel(slug).withSelected(slug === selected).build()));
const origin = selected => new OriginSection(selected, [new OriginOptionSnapshot("Stonetop", ["Anwen"], selected === "Stonetop")]);

const playbook = ({ bg = null, instinct = null, appearance = {}, from = null, lore = [], intro = null } = {}) => new PlaybookSnapshotBuilder()
	.withSlug("the-seeker").withName("The Seeker")
	.withBackground(background(bg)).withInstinctSelected(instinct)
	.withAppearanceGroup(group(picks("appearance", null, ["grim", "kind"]), { appearance }))
	.withOrigin(origin(from)).withLoreGroups(lore).withIntroductions(intro)
	.build();

describe("PlaybookSection", () => {
	it("offers Choose before anything is chosen and Change after", () => {
		expect(PlaybookSection.choice("instinct", false).door).toBe("choose");
		expect(PlaybookSection.choice("instinct", true).door).toBe("change");
	});

	it("offers Open for what is read rather than chosen, until something is answered", () => {
		expect(PlaybookSection.reading("introductions", false).door).toBe("open");
		expect(PlaybookSection.reading("introductions", true).door).toBe("change");
	});

	it("offers no door where there is nothing to choose", () => {
		expect(PlaybookSection.prose("collection").hasDoor).toBe(false);
	});

	// A section nobody has answered is its bar: there is nothing to rest on.
	it("rests on something only once something is chosen or answered, or when it is only words", () => {
		expect([PlaybookSection.choice("x", false).rests, PlaybookSection.choice("x", true).rests]).toEqual([false, true]);
		expect([PlaybookSection.reading("x", false).rests, PlaybookSection.reading("x", true).rests]).toEqual([false, true]);
		expect(PlaybookSection.prose("x").rests).toBe(true);
	});
});

describe("PlaybookSections.from", () => {
	it("keys the four fixed sections and says which have been chosen", () => {
		const s = PlaybookSections.from(playbook({ bg: "a", instinct: "Duty", appearance: { grim: 1 }, from: "Stonetop" }));
		expect([s.background, s.instinct, s.appearance, s.origin].map(x => [x.key, x.door])).toEqual([
			["background", "change"], ["instinct", "change"], ["appearance", "change"], ["origin", "change"],
		]);
	});

	it("offers Choose on each while nothing is", () => {
		const s = PlaybookSections.from(playbook());
		expect([s.background, s.instinct, s.appearance, s.origin].map(x => x.door)).toEqual(["choose", "choose", "choose", "choose"]);
	});

	it("reads the introductions, and has none to read without them", () => {
		const intro = new IntroductionsSnapshot("Step three.", group(picks("intro-npc", null)), group(picks("intro-pc", null)));
		expect(PlaybookSections.from(playbook({ intro })).introductions.door).toBe("open");
		expect(PlaybookSections.from(playbook()).introductions).toBeNull();
	});

	it("lists every key, for opening them all at once", () => {
		const lore = [group(picks("violence", "What Keeps You Up at Night?"))];
		expect(PlaybookSections.from(playbook({ lore })).keys)
			.toEqual(["background", "instinct", "appearance", "origin", "lore-violence"]);
	});

	it("has nothing to say without a playbook", () => {
		expect(PlaybookSections.from(null)).toBeNull();
	});
});

describe("LoreSection.fromGroups", () => {
	// The Seeker's Collection is a heading and a paragraph; Major and Minor Arcana are its.
	it("puts the groups after a group with nothing to choose under it", () => {
		const [collection] = LoreSection.fromGroups([
			group(prose("collection", "Collection")), group(picks("arcana-major", "Major Arcanum")), group(picks("arcana-minor", "Minor Arcana")),
		]);
		expect(collection.title).toBe("Collection");
		expect(collection.groups.map(g => g.slug)).toEqual(["arcana-major", "arcana-minor"]);
		expect(collection.heading.slug).toBe("collection");
	});

	// The Lightbearer's "Praise the day" carries on across four untitled groups.
	it("keeps an untitled group with the section before it, and starts one at each title", () => {
		const sections = LoreSection.fromGroups([
			group(picks("worship", "Praise the day")), group(picks("practice", null)), group(picks("shrine", null)),
			group(picks("threat", "Something Wicked")),
		]);
		expect(sections.map(s => [s.title, s.groups.map(g => g.slug)])).toEqual([
			["Praise the day", ["worship", "practice", "shrine"]], ["Something Wicked", ["threat"]],
		]);
	});

	it("keys a section by its first group, and knows when its title is its lead group's own heading", () => {
		const [titled] = LoreSection.fromGroups([group(picks("worship", "Praise the day"))]);
		expect([titled.key, titled.section.key, titled.titleIsLeadRow]).toEqual(["lore-worship", "lore-worship", true]);
		const [headed] = LoreSection.fromGroups([group(prose("collection", "Collection")), group(picks("major", "Major Arcanum"))]);
		expect(headed.titleIsLeadRow).toBe(false);
	});

	// The Fox's "And You Ended Up…" says "(choose 1 or 2 per tale)" beside its title; the title goes to
	// the bar, so the note goes with it.
	it("carries its heading's note to the bar with its title", () => {
		const def = picks("ending", "And You Ended Up…");
		def.list[0].content.titleNote = "(choose 1 or 2 per tale)";
		const [s] = LoreSection.fromGroups([group(def)]);
		expect(s.note).toBe("(choose 1 or 2 per tale)");
		expect(LoreSection.fromGroups([group(picks("x", "X"))])[0].note).toBeNull();
	});

	it("offers Change once any of its groups has a choice made", () => {
		const [open] = LoreSection.fromGroups([group(picks("worship", "Praise the day"))]);
		const [made] = LoreSection.fromGroups([group(picks("worship", "Praise the day"), { worship: { a: 1 } })]);
		expect([open.section.door, made.section.door]).toEqual(["choose", "change"]);
	});

	it("gives a heading with nothing under it no door", () => {
		const [alone] = LoreSection.fromGroups([group(prose("collection", "Collection"))]);
		expect(alone.section.hasDoor).toBe(false);
	});

	it("keeps its fields own, since partials flatten getters away", () => {
		const [s] = LoreSection.fromGroups([group(picks("worship", "Praise the day"))]);
		expect(Object.keys(s)).toEqual(expect.arrayContaining(["key", "title", "note", "heading", "groups", "section", "titleIsLeadRow"]));
	});
});

describe("CharacterSnapshot.playbookSections", () => {
	it("is derived from the playbook, and null without one", async () => {
		const { CharacterSnapshotBuilder } = await import("../../../../src/model/snapshot/character/CharacterSnapshot.js");
		const built = pb => new CharacterSnapshotBuilder().withPlaybook(pb).withDebilities([]).withStats({}).build();
		expect(built(playbook()).playbookSections).toBeInstanceOf(PlaybookSections);
		expect(built(null).playbookSections).toBeNull();
	});
});
