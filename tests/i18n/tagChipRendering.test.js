import { afterEach, describe, expect, it } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { TagLabels } from "../../src/model/data/TagLabels.js";
import { Selection } from "../../src/model/data/Selection.js";

// The real partial, through the real helpers: what a tag chip SHOWS is localized, what it CARRIES
// is not. Everything downstream — toggling, hasGroupTag, the glossary — reads the carried token.

const chips = (selected, options = []) => renderPartial("stonetop.selection-chips", {
	sel:  Selection.multi(selected, { options }),
	slug: "wee-folk",
	field: "tagList",
});

afterEach(() => { TagLabels.current = new TagLabels(); });

describe("tag chip rendering", () => {
	it("shows the token itself when nothing translates it", () => {
		const html = chips(["group"]);
		expect(html).toContain('data-tag="group"');
		expect(html).toContain(">group</button>");
	});

	it("shows the translated label while carrying the English token", () => {
		TagLabels.current = TagLabels.fromTranslations({ group: "Gruppe" });
		const html = chips(["group"]);

		expect(html).toContain('data-tag="group"');   // what the code acts on
		expect(html).toContain(">Gruppe</button>");   // what the player reads
		expect(html).not.toContain('data-tag="Gruppe"');
	});

	it("localizes the add-list options too, without changing their values", () => {
		TagLabels.current = TagLabels.fromTranslations({ horde: "Horde", close: "Nah" });
		const html = chips([], ["close", "horde"]);

		expect(html).toContain('data-value="close"');
		expect(html).toContain(">Nah</li>");
		expect(html).not.toContain('data-value="Nah"');
	});

	it("keeps the group tooltip on a chip whose label is translated", () => {
		TagLabels.current = TagLabels.fromTranslations({ group: "Gruppe" });
		const html = chips(["group"]);
		expect(html).toContain("stonetop.followers.groupTagTooltip");
	});

	it("leaves an untranslated tag beside a translated one alone", () => {
		TagLabels.current = TagLabels.fromTranslations({ group: "Gruppe" });
		const html = chips(["group", "tiny"]);
		expect(html).toContain(">Gruppe</button>");
		expect(html).toContain(">tiny</button>");
		expect(html).toContain('data-tag="tiny"');
	});
});
