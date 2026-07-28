import { describe, it, expect } from "vitest";
import { migrateChoices, migrateChoiceRow, migrateChoicesField, migrateGrants } from "../../src/migration/migrateChoices.js";

describe("migrateChoiceRow — row type", () => {
	it("collapses a heading row into an entry", () => {
		const row = migrateChoiceRow({ type: "heading", content: { title: "Pick 1" } });
		expect(row.type).toBe("entry");
		expect(row.content.title).toBe("Pick 1");
	});

	it("collapses a follower row into an entry", () => {
		expect(migrateChoiceRow({ type: "follower", slug: "enfys" }).type).toBe("entry");
	});

	it("leaves a pick row as pick", () => {
		expect(migrateChoiceRow({ type: "pick", options: [] }).type).toBe("pick");
	});

	it("moves a legacy follower row's slug into a follower grant", () => {
		const row = migrateChoiceRow({ type: "follower", slug: "enfys", title: "Enfys" });
		expect(row.type).toBe("entry");
		expect(row.grants).toEqual([{ type: "follower", slug: "enfys", locations: ["tab"] }]);
		expect(row.followers).toBeUndefined();
		expect(row.content.text).toBe("Enfys");
	});

	it("moves a legacy top-level title into content.text", () => {
		const row = migrateChoiceRow({ type: "heading", title: "Weapon" });
		expect(row.content.text).toBe("Weapon");
		expect(row.title).toBeUndefined();
	});
});

describe("migrateGrants — followers → grants array", () => {
	it("converts a legacy slug array + sibling inlineDisplay into follower grants", () => {
		const row = migrateGrants({ followers: ["bronze-protector"], inlineDisplay: true });
		expect(row.grants).toEqual([{ type: "follower", slug: "bronze-protector", locations: ["inline", "tab"] }]);
		expect(row.followers).toBeUndefined();
		expect(row.inlineDisplay).toBeUndefined();
	});

	it("converts the grouped follower object, mapping hideFromFollowersTab → no tab location", () => {
		const row = migrateGrants({ followers: { slugs: ["the-ring"], inlineDisplay: true, hideFromFollowersTab: true } });
		expect(row.grants).toEqual([{ type: "follower", slug: "the-ring", locations: ["inline"] }]);
	});

	it("drops the stray flags and adds no grants for an empty legacy array", () => {
		const row = migrateGrants({ followers: [], inlineDisplay: false });
		expect(row.grants).toBeUndefined();
		expect(row.followers).toBeUndefined();
		expect(row.inlineDisplay).toBeUndefined();
	});

	it("is idempotent on the new grants shape", () => {
		const grants = [{ type: "follower", slug: "enfys", locations: ["inline"] }];
		const row = migrateGrants({ grants });
		expect(row.grants).toBe(grants);
	});

	it("normalizes pick options through migrateChoiceRow", () => {
		const row = migrateChoiceRow({ type: "pick", options: [{ slug: "a", followers: ["enfys"], inlineDisplay: true }] });
		expect(row.options[0].grants).toEqual([{ type: "follower", slug: "enfys", locations: ["inline", "tab"] }]);
		expect(row.options[0].followers).toBeUndefined();
	});

	it("migrateChoiceRow converts an entry's legacy follower wiring", () => {
		const row = migrateChoiceRow({ type: "entry", slug: "e", followers: ["afon"], inlineDisplay: true });
		expect(row.grants).toEqual([{ type: "follower", slug: "afon", locations: ["inline", "tab"] }]);
		expect(row.followers).toBeUndefined();
	});
});

describe("migrateChoiceRow — content renames", () => {
	it("renames content.subHeading -> content.subtitle", () => {
		const row = migrateChoiceRow({ type: "entry", content: { subHeading: "Lash out" } });
		expect(row.content.subtitle).toBe("Lash out");
		expect(row.content.subHeading).toBeUndefined();
	});

	it("renames content.subNote -> content.subtitleNote", () => {
		const row = migrateChoiceRow({ type: "entry", content: { subNote: "(page 412)" } });
		expect(row.content.subtitleNote).toBe("(page 412)");
		expect(row.content.subNote).toBeUndefined();
	});

	it("folds the entry-level note into content.titleNote", () => {
		const row = migrateChoiceRow({ type: "entry", note: "(reload)", content: { title: "Breath" } });
		expect(row.content.titleNote).toBe("(reload)");
		expect(row.note).toBeUndefined();
	});

	it("creates content when missing", () => {
		const row = migrateChoiceRow({ type: "entry", note: "x" });
		expect(row.content.titleNote).toBe("x");
	});
});

describe("migrateChoiceRow — input type", () => {
	it("stamps input.type 'inline' when an input has no type", () => {
		const row = migrateChoiceRow({ type: "entry", input: { slug: "cost", default: "" } });
		expect(row.input.type).toBe("inline");
	});

	it("preserves an explicit input.type", () => {
		const row = migrateChoiceRow({ type: "entry", input: { type: "rich" } });
		expect(row.input.type).toBe("rich");
	});

	it("does not add an input when there is none", () => {
		expect(migrateChoiceRow({ type: "entry" }).input).toBeUndefined();
	});
});

describe("migrateChoices — groups + idempotency", () => {
	it("migrates every row across groups", () => {
		const choices = [{ slug: "choices", list: [
			{ type: "heading", content: { subHeading: "H" }, note: "n" },
			{ type: "pick", options: [] },
		]}];
		migrateChoices(choices);
		expect(choices[0].list[0].type).toBe("entry");
		expect(choices[0].list[0].content.subtitle).toBe("H");
		expect(choices[0].list[0].content.titleNote).toBe("n");
		expect(choices[0].list[1].type).toBe("pick");
	});

	it("is idempotent", () => {
		const choices = [{ slug: "choices", list: [{ type: "heading", content: { subNote: "x" }, input: {} }] }];
		migrateChoices(choices);
		const once = JSON.stringify(choices);
		migrateChoices(choices);
		expect(JSON.stringify(choices)).toBe(once);
	});

	it("returns non-array input unchanged", () => {
		expect(migrateChoices(null)).toBeNull();
		expect(migrateChoices(undefined)).toBeUndefined();
	});
});

describe("migrateChoicesField — single-group or array shapes", () => {
	it("migrates a single-group object (with its own list)", () => {
		const choices = { slug: "choices", list: [{ type: "follower", slug: "enfys", title: "Enfys" }] };
		migrateChoicesField(choices);
		expect(choices.list[0].type).toBe("entry");
		expect(choices.list[0].grants).toEqual([{ type: "follower", slug: "enfys", locations: ["tab"] }]);
	});

	it("migrates an array of groups", () => {
		const choices = [{ slug: "g", list: [{ type: "heading", content: { subHeading: "H" } }] }];
		migrateChoicesField(choices);
		expect(choices[0].list[0].content.subtitle).toBe("H");
	});

	it("returns null/undefined unchanged", () => {
		expect(migrateChoicesField(null)).toBeNull();
		expect(migrateChoicesField(undefined)).toBeUndefined();
	});
});
