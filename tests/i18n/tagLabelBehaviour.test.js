import { describe, expect, it } from "vitest";
import { TagLabels } from "../../src/model/data/TagLabels.js";
import { hasGroupTag, isGroupTag, normalizeGroupTags } from "../../src/model/data/groupTag.js";
import { TagGlossary } from "../../src/model/data/TagGlossary.js";
import { TEXT_PATHS, UNTRANSLATED_PATHS } from "../../src/i18n/translatablePaths.js";
import { translatableEntries } from "../../src/i18n/translatablePaths.js";

// A tag token is its own identity and its own label at once. Translating it in place would break
// every behaviour keyed off it, so the token stays English and only the rendered text is localized.
// These tests pin that split down, because getting it wrong is silent: the sheet looks translated
// and the group mechanics simply stop firing.

const german = () => TagLabels.fromTranslations({ group: "Gruppe", horde: "Horde", close: "Nah" });

describe("a translated tag still behaves like a tag", () => {
	it("keeps group detection working while the chip reads German", () => {
		const stored = ["group", "close"];

		expect(german().labelFor(stored[0])).toBe("Gruppe");
		expect(hasGroupTag(stored)).toBe(true);
	});

	it("keeps the counted form working", () => {
		expect(hasGroupTag(["Group (3)"])).toBe(true);
		expect(normalizeGroupTags(["Group (3)"]).tags).toEqual(["group"]);
	});

	// The failure this whole design exists to prevent.
	it("would break if the stored token were translated instead", () => {
		expect(hasGroupTag(["Gruppe"])).toBe(false);
		expect(isGroupTag("Gruppe")).toBe(false);
	});

	it("keeps the glossary lookup working, which is keyed by the token", () => {
		const glossary = TagGlossary.fromTranslations({ range: { close: "melee range, 1-2 steps away." } });
		expect(glossary.lookup("close")?.definition).toBe("melee range, 1-2 steps away.");
		expect(glossary.lookup(german().labelFor("close"))).toBeNull();
	});
});

describe("no tag field is translatable in place", () => {
	const TAG_FIELDS = [
		"system.tagList[]",
		"system.tagOptions[]",
		"system.front.item.tagList[]",
		"system.back.item.tagList[]",
		"system.outfitItems[].tagList[]",
		"system.companion.catalog[].options[]",
		"system.companion.catalog[].defaults[]",
	];

	it("keeps every tag-bearing path out of every allowlist", () => {
		for (const [type, paths] of Object.entries(TEXT_PATHS)) {
			for (const field of TAG_FIELDS) expect(paths, `${type} ${field}`).not.toContain(field);
		}
	});

	it("records why the follower's tag fields are excluded", () => {
		const excluded = UNTRANSLATED_PATHS.follower ?? {};
		expect(Object.keys(excluded)).toContain("system.tagOptions[]");
		expect(Object.keys(excluded)).toContain("system.companion.catalog[].options[]");
	});

	// CharacterFollowers resolves the chosen companion by `x.name === wanted` and stores that name,
	// so translating it silently loses the type's pickCount and pre-checked defaults.
	it("keeps the companion type name out, since it is matched by name", () => {
		expect(TEXT_PATHS.follower).not.toContain("system.companion.catalog[].name");
		expect(Object.keys(UNTRANSLATED_PATHS.follower)).toContain("system.companion.catalog[].name");
	});

	it("never extracts a tag from a real follower shape", () => {
		const follower = {
			type: "follower",
			name: "Wee folk",
			system: {
				slug: "wee-folk",
				tagList: ["group", "tiny"],
				tagOptions: ["horde"],
				description: "Small and many.",
				companion: { catalog: [{ slug: "bird", name: "Bird", options: ["tiny"], defaults: ["tiny"] }] },
			},
		};
		const sources = translatableEntries(follower, TEXT_PATHS.follower).map(e => e.text);
		for (const tag of ["group", "tiny", "horde", "Bird"]) expect(sources).not.toContain(tag);
		expect(sources).toContain("Small and many.");
	});
});

describe("a tag typed in the display language still behaves", () => {
	const german = () => TagLabels.fromTranslations({ group: "Gruppe", horde: "Horde" });

	it("is detected as a group once read back to its token", () => {
		const typed = "Gruppe";
		expect(hasGroupTag([typed])).toBe(false);                       // stored raw: broken
		expect(hasGroupTag([german().tokenFor(typed)])).toBe(true);     // read back: works
	});

	it("keeps the member count a person typed", () => {
		const stored = german().tokenFor("Gruppe (4)");
		expect(hasGroupTag([stored])).toBe(true);
		expect(normalizeGroupTags([stored])).toMatchObject({ tags: ["group"], count: 4 });
	});
});
