import { describe, expect, it } from "vitest";
import { TagLabels } from "../../../src/model/data/TagLabels.js";
import { toSlug } from "../../../src/utils/slug.js";

const german = () => TagLabels.fromTranslations({ group: "Gruppe", close: "Nah", "keen-nosed": "Feine Nase" });

describe("TagLabels", () => {
	it("translates a known tag", () => {
		expect(german().labelFor("group")).toBe("Gruppe");
		expect(german().labelFor("keen-nosed")).toBe("Feine Nase");
	});

	// The book prints tags capitalized and the packs carry both forms; the glossary is keyed the same
	// slugified way, so the label must be too.
	it("matches however the token is cased or spaced", () => {
		expect(german().labelFor("Group")).toBe("Gruppe");
		expect(german().labelFor("Keen-Nosed")).toBe("Feine Nase");
	});

	it("falls back to the token itself when nothing translates it", () => {
		expect(german().labelFor("terrifying")).toBe("terrifying");
		expect(new TagLabels().labelFor("group")).toBe("group");
	});

	// "Group (3)" carries a member count. It is a different token from "group", so it is not
	// translated unless a translator supplies that exact form — never silently mangled.
	it("leaves a counted group tag alone unless it is translated explicitly", () => {
		expect(german().labelFor("Group (3)")).toBe("Group (3)");
		expect(TagLabels.fromTranslations({ "Group (3)": "Gruppe (3)" }).labelFor("Group (3)")).toBe("Gruppe (3)");
	});

	it("passes blank and nullish tokens straight through", () => {
		expect(german().labelFor("")).toBe("");
		expect(german().labelFor(null)).toBe("");
		expect(german().labelFor(undefined)).toBe("");
	});

	it("ignores blank and non-string labels", () => {
		const labels = TagLabels.fromTranslations({ group: "   ", close: 7, fae: "Fee" });
		expect(labels.labelFor("group")).toBe("group");
		expect(labels.labelFor("close")).toBe("close");
		expect(labels.labelFor("fae")).toBe("Fee");
	});

	it("is empty for absent input, so English shows the token", () => {
		expect(TagLabels.fromTranslations().isEmpty).toBe(true);
		expect(TagLabels.fromTranslations({}).isEmpty).toBe(true);
		expect(TagLabels.current.isEmpty).toBe(true);
	});
});

describe("tokenFor — reading back what a person typed", () => {
	// The chip shows a translated label, so people type the label. Stored as-is it is not a group and
	// has no glossary definition, because both are keyed by the token.
	it("maps a translated label back to its token", () => {
		expect(german().tokenFor("Gruppe")).toBe("group");
		expect(german().tokenFor("Feine Nase")).toBe("keen-nosed");
	});

	it("accepts however a person cased or spaced it", () => {
		expect(german().tokenFor("gruppe")).toBe("group");
		expect(german().tokenFor("  GRUPPE  ")).toBe("group");
	});

	// Input that already IS the token is returned as typed rather than re-cased: the packs ship NPC
	// tags capitalized ("Solitary"), and everything downstream slugifies anyway.
	it("leaves a token that is already canonical alone, casing included", () => {
		expect(german().tokenFor("group")).toBe("group");
		expect(german().tokenFor("Group")).toBe("Group");
		expect(german().tokenFor("close")).toBe("close");
	});

	it("keeps a count with its tag", () => {
		expect(german().tokenFor("Gruppe (3)")).toBe("group (3)");
		expect(german().tokenFor("Group (12)")).toBe("Group (12)");
	});

	it("passes an unknown tag through untouched, in any language", () => {
		expect(german().tokenFor("unheimlich")).toBe("unheimlich");
		expect(german().tokenFor("wolf pack")).toBe("wolf pack");
		expect(new TagLabels().tokenFor("Gruppe")).toBe("Gruppe");
	});

	it("passes blank and nullish input through", () => {
		expect(german().tokenFor("")).toBe("");
		expect(german().tokenFor(null)).toBe("");
	});

	// The property that keeps this generic: it holds for every token in the catalog, with no tag
	// named anywhere in the implementation. Stated up to the slugging every consumer applies, since
	// a label that already reads as its own token ("Horde") comes back as typed.
	it("round-trips every translated tag, whichever tag it is", () => {
		const labels = TagLabels.fromTranslations({
			group: "Gruppe", horde: "Horde", close: "Nah", forceful: "Wuchtig", "keen-nosed": "Feine Nase",
		});
		for (const token of ["group", "horde", "close", "forceful", "keen-nosed"]) {
			expect(toSlug(labels.tokenFor(labels.labelFor(token))), token).toBe(token);
		}
	});

	it("stays deterministic when two tags share a label", () => {
		const labels = TagLabels.fromTranslations({ alpha: "Gleich", beta: "Gleich" });
		expect(labels.tokenFor("Gleich")).toBe("alpha");
	});
});
