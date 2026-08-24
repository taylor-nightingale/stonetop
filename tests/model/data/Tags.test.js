import { describe, it, expect } from "vitest";
import { Tags, ResolvedTag } from "../../../src/model/data/Tags.js";
import { TagGlossary } from "../../../src/model/data/TagGlossary.js";
import { Selection } from "../../../src/model/data/Selection.js";

const glossary = TagGlossary.fromTranslations({
	general:  { thrown: "you can Let Fly with it." },
	range:    { close: "melee range, 1-2 steps away." },
	artifact: { magical: "imbued with unnatural power" },
});

describe("Tags — parsing every stored form", () => {
	// The legacy free string, the Selection object, and an array all have to land on the same value:
	// that is what makes one model out of what used to be three shapes.
	it("reads the legacy comma string", () => {
		expect(Tags.gear("close, thrown", glossary).values).toEqual(["close", "thrown"]);
	});

	it("reads the legacy Selection blob a pre-conversion world still holds", () => {
		const raw = { selected: ["close", "thrown"], options: [], multi: true, allowCustom: true };
		expect(Tags.gear(raw, glossary).values).toEqual(["close", "thrown"]);
	});

	it("reads the stored token list", () => {
		expect(Tags.gear(["close", "thrown"], glossary).values).toEqual(["close", "thrown"]);
	});

	it("reads an array of tokens", () => {
		expect(Tags.member(["big", "old"], [], glossary).values).toEqual(["big", "old"]);
	});

	it("treats empty and missing values as no tags", () => {
		expect(Tags.gear("", glossary).isEmpty).toBe(true);
		expect(Tags.gear(null, glossary).isEmpty).toBe(true);
		expect(Tags.gear(undefined, glossary).values).toEqual([]);
	});

	it("trims the whitespace around authored tokens", () => {
		expect(Tags.gear(" close ,  thrown ", glossary).values).toEqual(["close", "thrown"]);
	});
});

describe("Tags — the stored shape", () => {
	// The stored value is the token list and nothing else: `multi` and `allowCustom` are constants
	// of the field, and options belong to the context.
	it("stores the token list, whatever it was parsed from", () => {
		const fromString = Tags.gear("close, thrown", glossary).toRaw();
		const fromArray  = Tags.gear(fromString, glossary).toRaw();
		expect(fromString).toEqual(["close", "thrown"]);
		expect(fromArray).toEqual(fromString);
	});

	// Suggestions are what the context offers, not what the document said. Writing them back would
	// bake 25 glossary entries into every spear.
	it("never writes the context's suggestions into the document", () => {
		const tags = Tags.gear("close", glossary);
		expect(tags.options).toContain("magical");
		expect(tags.toRaw()).toEqual(["close"]);
	});
});

describe("Tags — suggestions by context", () => {
	it("suggests the glossary for gear", () => {
		expect(Tags.gear("close", glossary).options).toEqual(["thrown", "close", "magical"]);
	});

	// A creature's printed choices live in the sibling `tagOptions`, passed in by the caller.
	it("suggests a creature's own printed choices", () => {
		expect(Tags.creature(["group"], ["group", "exceptional"], glossary).options)
			.toEqual(["group", "exceptional"]);
	});

	it("suggests nothing for a creature whose stat block printed no choices", () => {
		expect(Tags.creature(["group"], [], glossary).options).toEqual([]);
	});

	it("suggests the follower's pool for a member", () => {
		expect(Tags.member("big", ["big", "old", "bully"], glossary).options).toEqual(["big", "old", "bully"]);
	});

	it("does not repeat a duplicated suggestion", () => {
		expect(Tags.member("big", ["big", "big", "old"], glossary).options).toEqual(["big", "old"]);
	});

	it("renders a picker whose chips cover stored value and suggestions alike", () => {
		const chips = Tags.gear("close", glossary).picker.chips;
		expect(chips.find((c) => c.value === "close").selected).toBe(true);
		expect(chips.find((c) => c.value === "magical").selected).toBe(false);
	});
});

describe("Tags — resolving definitions", () => {
	it("carries each tag's definition, in the order they were authored", () => {
		const resolved = Tags.gear("thrown, close", glossary).resolved;
		expect(resolved.map((t) => t.label)).toEqual(["thrown", "close"]);
		expect(resolved[1].definition).toBe("melee range, 1-2 steps away.");
		expect(resolved[1].category).toBe("range");
	});

	// A creature's `magical` is the same magical as a spear's — one glossary, every context.
	it("resolves the same tag the same way on a creature as on gear", () => {
		const onGear = Tags.gear("magical", glossary).resolved[0];
		const onNpc  = Tags.creature(["magical"], [], glossary).resolved[0];
		expect(onNpc).toEqual(onGear);
	});

	it("keeps an undefined tag as a plain one rather than dropping it", () => {
		const resolved = Tags.member("sharp-eyed", [], glossary).resolved;
		expect(resolved).toHaveLength(1);
		expect(resolved[0].label).toBe("sharp-eyed");
		expect(resolved[0].hasDefinition).toBe(false);
		expect(resolved[0].definition).toBeNull();
	});

	it("lists only the defined tags when asked for those", () => {
		const tags = Tags.gear("close, sharp-eyed, magical", glossary);
		expect(tags.defined.map((t) => t.label)).toEqual(["close", "magical"]);
	});

	it("resolves a tag whose casing differs from the book", () => {
		expect(ResolvedTag.of("Magical", glossary).definition).toBe("imbued with unnatural power");
	});
});

describe("Tags — editing", () => {
	it("toggles a tag without mutating the original", () => {
		const before = Tags.gear("close", glossary);
		const after = before.toggle("thrown");
		expect(before.values).toEqual(["close"]);
		expect(after.values).toEqual(["close", "thrown"]);
	});

	it("toggles a tag off again", () => {
		expect(Tags.gear("close, thrown", glossary).toggle("close").values).toEqual(["thrown"]);
	});

	it("keeps its suggestions and glossary across a toggle", () => {
		const after = Tags.gear("close", glossary).toggle("thrown");
		expect(after.options).toContain("magical");
		expect(after.resolved[1].definition).toBe("you can Let Fly with it.");
	});

	it("reports its tags as the comma text the sheets display", () => {
		expect(Tags.gear("close, thrown", glossary).text).toBe("close, thrown");
		expect(Tags.gear("close", glossary).has("close")).toBe(true);
	});
});

describe("Tags — defaults", () => {
	it("falls back to the ambient glossary when none is passed", () => {
		const previous = TagGlossary.current;
		TagGlossary.current = glossary;
		try {
			expect(Tags.gear("close").resolved[0].definition).toBe("melee range, 1-2 steps away.");
		} finally {
			TagGlossary.current = previous;
		}
	});

	it("accepts a Selection that was built directly", () => {
		const tags = new Tags(Selection.multi(["close"]), glossary);
		expect(tags.values).toEqual(["close"]);
	});
});

describe("Tags — idempotence", () => {
	// toOutfitItemSnapshot is handed entities (whose `tags` is already a Tags) and plain objects
	// alike; wrapping has to be safe either way, exactly as `rich()` is for text.
	it("passes an existing Tags through untouched", () => {
		const tags = Tags.gear("close", glossary);
		expect(Tags.gear(tags)).toBe(tags);
		expect(Tags.fromStored(tags)).toBe(tags);
	});

	it("keeps the original's glossary rather than the ambient one", () => {
		const tags = Tags.gear("close", glossary);
		expect(Tags.gear(tags).resolved[0].definition).toBe("melee range, 1-2 steps away.");
	});
});

describe("Tags — select", () => {
	// `addMember` stamps the group tag on a follower that may or may not already carry it.
	it("adds a tag that is absent", () => {
		expect(Tags.creature(["brave"], [], glossary).select("group").values).toEqual(["brave", "group"]);
	});

	it("leaves a tag that is already present exactly once", () => {
		expect(Tags.creature(["group"], [], glossary).select("group").values).toEqual(["group"]);
	});

	it("does not mutate the original", () => {
		const before = Tags.creature(["brave"], [], glossary);
		before.select("group");
		expect(before.values).toEqual(["brave"]);
	});
});
