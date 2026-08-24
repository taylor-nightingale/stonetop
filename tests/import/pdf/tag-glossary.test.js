import { describe, it, expect } from "vitest";
import { parseGearTerms, parseArtifactTags } from "../../../scripts/import/pdf/tag-glossary.js";

// Lines as parseStext yields them. The font of the FIRST span is what separates a tag from a
// mechanical modifier, and bbox[0] is what separates a term from its wrapped definition lines, so
// both are spelled out per line here.
const mk = (text, x, y, font = "ACaslonPro-Regular") =>
	({ bbox: [x, y, x + 160, y + 9], text, font, size: 9, spans: [{ font, size: 9, text }] });

const TAG = "ACaslonPro-BoldItalic";
const MOD = "ACaslonPro-Bold";
const HEAD = "Avara-Bold";

// The gear-terms sidebar as Book I sets it: term lines flush at the column edge, wrapped definition
// lines indented, tags and modifiers interleaved alphabetically.
const gearTermsPage = () => [
	mk("Gear terms & tags", 36, 86, HEAD),
	mk("Terms in italic typeface are tags. They have", 36, 131),
	mk("no specific mechanical effect, but they are", 36, 141),
	mk("area: affects everything in an area.", 36, 293, TAG),
	mk("[n] armor: when you take damage,", 36, 306, MOD),
	mk("subtract n; doesn’t stack.", 49.5, 317),
	mk("cumbersome: you’re noisy, slow, hot, and", 36, 392, TAG),
	mk("quick to tire while carrying it, even", 49.5, 403),
	mk("without a heavy load.", 49.5, 414),
	mk("+[n] damage: increase the damage you deal", 36, 435, MOD),
	mk("with that weapon by n.", 49.5, 446),
	mk("fragile: easy to break/ruin; pack it carefully.", 36, 511, TAG),
	mk("requires ___: if you don’t meet the require-", 204, 172, MOD),
	mk("ments, it works poorly or not at all.", 217.5, 182),
	mk("thrown: you can Let Fly with it (at", 204, 215, TAG),
	mk("near range).", 217.5, 225, "ACaslonPro-Italic"),
	mk("Range Tags", 204, 300, HEAD),
	mk("These indicate the distance within which a", 204, 309),
	mk("hand: tight quarters; up close and personal.", 204, 344, TAG),
	mk("far: quite the distance; up to 100 steps,", 204, 388, TAG),
	mk("maybe more.", 217.5, 398),
	mk("Ammo", 204, 419, HEAD),
	mk("Many ranged weapons have one or more of", 204, 431),
];

describe("parseGearTerms", () => {
	const entries = parseGearTerms(gearTermsPage());
	const bySlug = Object.fromEntries(entries.map((e) => [e.slug, e]));

	it("keeps the bold-italic tags and drops the bold-roman modifiers", () => {
		expect(entries.map((e) => e.slug))
			.toEqual(["area", "cumbersome", "fragile", "thrown", "hand", "far"]);
	});

	it("does not let a dropped modifier's wrapped lines leak into the tag above it", () => {
		expect(bySlug.area.definition).toBe("affects everything in an area.");
	});

	it("joins a tag's own wrapped definition lines", () => {
		expect(bySlug.cumbersome.definition)
			.toBe("you’re noisy, slow, hot, and quick to tire while carrying it, even without a heavy load.");
	});

	it("joins a wrapped line whose italic run continues the sentence", () => {
		expect(bySlug.thrown.definition).toBe("you can Let Fly with it (at near range).");
	});

	it("switches category at the Range Tags heading", () => {
		expect(bySlug.area.category).toBe("general");
		expect(bySlug.hand.category).toBe("range");
		expect(bySlug.far.category).toBe("range");
	});

	it("stops at the Ammo heading rather than reading on into the next section", () => {
		expect(entries.some((e) => /ranged weapons/.test(e.definition))).toBe(false);
	});

	it("ignores the intro prose above the first term", () => {
		expect(entries.some((e) => /typeface/.test(e.definition))).toBe(false);
	});
});

describe("parseArtifactTags", () => {
	// The artifact sidebar sits mid-page: prose above it must be ignored, and the next Avara heading
	// ends it.
	const page = [
		mk("Regardless of how you’re writing up", 610, 127),
		mk("gear terms & tags (page 94), such", 610, 148, MOD),
		mk("Artifacts might have additional tags", 610, 321),
		mk("not found on mundane items, such as:", 610, 332),
		mk("beautiful: draws attention, makes", 610, 354, TAG),
		mk("some people want it", 623.5, 365),
		mk("magical: imbued with unnatural power", 610, 440, TAG),
		mk("terrifying: people and beasts freak", 610, 451, TAG),
		mk("out in its presence", 623.5, 462),
		mk("As an arcanum", 432, 341, HEAD),
		mk("If you envision the artifact providing a", 432, 353),
	];
	const entries = parseArtifactTags(page);

	it("reads the artifact tags and categorises them", () => {
		expect(entries.map((e) => e.slug)).toEqual(["beautiful", "magical", "terrifying"]);
		expect(entries.every((e) => e.category === "artifact")).toBe(true);
	});

	it("ignores the prose above the anchor, including its bold run", () => {
		expect(entries.some((e) => /page 94/.test(e.definition))).toBe(false);
	});

	it("joins wrapped lines and stops at the next heading", () => {
		expect(entries[0].definition).toBe("draws attention, makes some people want it");
		expect(entries[2].definition).toBe("people and beasts freak out in its presence");
	});
});
