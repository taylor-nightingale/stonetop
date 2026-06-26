import { describe, expect, it } from "vitest";
import { sectionHtml, dangersToGroups } from "../../scripts/local/shared/gazetteer.mjs";

// Within a "Dangers" section, sectionHtml(..., true) promotes danger sub-headers
// that the PDF extraction stranded as bullets ("Lightning", "Drought",
// "Nine-fingered stranger") back to the bold <p><strong> lead-in their siblings
// ("Harsh weather") already get. These guard that promotion and its precision.
const danger = (...lines) => sectionHtml(lines, [], true);
const plain = (...lines) => sectionHtml(lines, [], false);

describe("sectionHtml Dangers sub-headers", () => {
	it("promotes a stranded label + long descriptor to a header and intro prose", () => {
		const out = danger(
			"- Lightning",
			"- When you get struck by lightning, it’s not necessarily a sign of Tor’s displeasure.",
			"",
			"- Flash in the distance; rumble ominously",
			"- A bolt strikes nearby",
		);
		expect(out).toContain("<p><strong>Lightning</strong></p>");
		expect(out).toContain("<p>When you get struck by lightning, it’s not necessarily a sign of Tor’s displeasure.</p>");
		// The remaining bullets stay a list.
		expect(out).toContain("<li>Flash in the distance; rumble ominously</li>");
		// The label and descriptor are no longer list items.
		expect(out).not.toContain("<li>Lightning</li>");
	});

	it("promotes a lone label bullet left behind once its stat block was stripped", () => {
		const out = danger(
			"- Nine-fingered stranger",
			"- Solitary, spirit, magical, enigmatic,",
			"- moody, curious HP 22; Armor 4",
			"- Manifest as a nine-fingered man",
			"",
			"Many tales tell of a stranger met in an unlikely place.",
		);
		expect(out).toContain("<p><strong>Nine-fingered stranger</strong></p>");
		expect(out).toContain("<p>Many tales tell of a stranger met in an unlikely place.</p>");
		expect(out).not.toContain("<li>Nine-fingered stranger</li>");
	});

	it("does not promote an ordinary short list item whose next item merely ends in punctuation", () => {
		// "Lashing wind and rain" leads its list, but "Thunder and lightning (see below)"
		// is a short sibling, not a long descriptor — both must stay bullets.
		const out = danger(
			"Harsh weather",
			"",
			"- Lashing wind and rain",
			"- Thunder and lightning (see below)",
			"- Poor visibility",
		);
		expect(out).toContain("<li>Lashing wind and rain</li>");
		expect(out).toContain("<li>Poor visibility</li>");
		expect(out).not.toContain("<strong>Lashing wind and rain</strong>");
	});

	it("does not skip a danger-reference bullet carrying a page ref or comma", () => {
		const out = danger(
			"Associated entities",
			"",
			"- Elemental spirits (page 360), especially those of rain, snow, storm, and wind",
			"- Andalau (page 368), who love to dance before a storm",
		);
		expect(out).toContain("<li>Elemental spirits, especially those of rain, snow, storm, and wind</li>");
		expect(out).not.toContain("<strong>Elemental spirits");
	});

	it("leaves non-danger sections untouched", () => {
		const out = plain(
			"- Lightning",
			"- When you get struck by lightning, it’s not necessarily a sign of Tor’s displeasure.",
		);
		expect(out).not.toContain("<strong>Lightning</strong>");
		expect(out).toContain("<li>Lightning</li>");
	});
});

describe("dangersToGroups", () => {
	it("splits each sub-header into its own {heading, body} entry", () => {
		const html = "<p><strong>Hazards</strong></p><ul><li>Getting lost</li></ul>"
			+ "<p><strong>Monsters</strong></p><ul><li>Crinwin</li></ul>";
		const groups = dangersToGroups(html);
		expect(groups.map(g => g.heading)).toEqual(["Hazards", "Monsters"]);
		expect(groups[0].body).toBe("<ul><li>Getting lost</li></ul>");
		expect(groups[1].body).toBe("<ul><li>Crinwin</li></ul>");
	});

	it("keeps a dice-table caption and its table inside the current entry, not as a new one", () => {
		const html = "<p><strong>Mouth of Daagon</strong></p><p>It hungers.</p>"
			+ "<p><strong>1d6 reward</strong></p><table><thead><tr><th>Roll</th></tr></thead></table>"
			+ "<p><strong>Monsters</strong></p><ul><li>Daagon</li></ul>";
		const groups = dangersToGroups(html);
		expect(groups.map(g => g.heading)).toEqual(["Mouth of Daagon", "Monsters"]);
		expect(groups[0].body).toContain("<p><strong>1d6 reward</strong></p>");
		expect(groups[0].body).toContain("<table>");
	});

	it("decodes entities in the heading and keeps a headless intro entry", () => {
		const html = "<p>General threats abound.</p>"
			+ "<p><strong>Hypothermia &amp; frostbite</strong></p><p>Cold kills.</p>";
		const groups = dangersToGroups(html);
		expect(groups[0]).toEqual({ heading: "", body: "<p>General threats abound.</p>" });
		expect(groups[1].heading).toBe("Hypothermia & frostbite");
	});
});
