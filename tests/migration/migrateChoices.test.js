import { describe, it, expect } from "vitest";
import { migrateChoices, migrateChoiceRow, migrateChoicesField, migrateFollowerLink } from "../../src/migration/migrateChoices.js";

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

	it("moves a legacy follower row's slug into the grouped followers object", () => {
		const row = migrateChoiceRow({ type: "follower", slug: "enfys", title: "Enfys" });
		expect(row.type).toBe("entry");
		expect(row.followers).toEqual({ slugs: ["enfys"], inlineDisplay: false, hideFromFollowersTab: false });
		expect(row.content.text).toBe("Enfys");
	});

	it("moves a legacy top-level title into content.text", () => {
		const row = migrateChoiceRow({ type: "heading", title: "Weapon" });
		expect(row.content.text).toBe("Weapon");
		expect(row.title).toBeUndefined();
	});
});

describe("migrateFollowerLink — grouped follower shape", () => {
	it("groups a legacy slug array + sibling inlineDisplay into one followers object", () => {
		const row = migrateFollowerLink({ followers: ["bronze-protector"], inlineDisplay: true });
		expect(row.followers).toEqual({ slugs: ["bronze-protector"], inlineDisplay: true, hideFromFollowersTab: false });
		expect(row.inlineDisplay).toBeUndefined();
	});

	it("collapses an empty legacy array to null and drops the stray flag", () => {
		const row = migrateFollowerLink({ followers: [], inlineDisplay: false });
		expect(row.followers).toBeNull();
		expect(row.inlineDisplay).toBeUndefined();
	});

	it("is idempotent on the new object shape", () => {
		const followers = { slugs: ["enfys"], inlineDisplay: false, hideFromFollowersTab: true };
		const row = migrateFollowerLink({ followers });
		expect(row.followers).toBe(followers);
	});

	it("normalizes pick options through migrateChoiceRow", () => {
		const row = migrateChoiceRow({ type: "pick", options: [{ slug: "a", followers: ["enfys"], inlineDisplay: true }] });
		expect(row.options[0].followers).toEqual({ slugs: ["enfys"], inlineDisplay: true, hideFromFollowersTab: false });
		expect(row.options[0].inlineDisplay).toBeUndefined();
	});

	it("migrateChoiceRow groups an entry's legacy follower wiring", () => {
		const row = migrateChoiceRow({ type: "entry", slug: "e", followers: ["afon"], inlineDisplay: true });
		expect(row.followers).toEqual({ slugs: ["afon"], inlineDisplay: true, hideFromFollowersTab: false });
		expect(row.inlineDisplay).toBeUndefined();
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
		expect(choices.list[0].followers).toEqual({ slugs: ["enfys"], inlineDisplay: false, hideFromFollowersTab: false });
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
