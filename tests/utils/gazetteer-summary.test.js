import { describe, expect, it } from "vitest";
import { summaryFor } from "../../scripts/local/shared/gazetteer.mjs";

// summaryFor builds the one-line hover-tooltip description from a place's own
// prose. It must read as flavor, not numbers: a settlement leads its Overview with
// the steading stat block (a stat <p> + trade/resource <li>s) and only then the
// descriptive prose, so the summary has to skip past the clutter.

describe("summaryFor", () => {
	it("skips a settlement's steading stat block and returns the whole opening paragraph", () => {
		const overview = {
			name: "Overview",
			html: "<p>Size town (~800 souls) Population +0 Prosperity +2</p>"
				+ "<ul><li>Trade with… …</li><li>Lygos (fine goods, spices, etc.) …</li></ul>"
				+ "<ul><li>Farming (wheat, hemp) …</li><li>Marketplace</li></ul>"
				+ "<p>The town of Marshedge lies along the Highway, on a rise overlooking the fen. "
				+ "Many consider Marshedgers insane to live so close to such a dangerous place.</p>",
		};
		expect(summaryFor([overview], "Marshedge"))
			.toBe("The town of Marshedge lies along the Highway, on a rise overlooking the fen. "
				+ "Many consider Marshedgers insane to live so close to such a dangerous place.");
	});

	it("falls back to list items when there is no descriptive paragraph", () => {
		const impressions = {
			name: "Impressions",
			html: "<ul><li>An unnatural quiet, the forest holding its breath</li></ul>"
				+ "<p>Tip: speak softly, hold very still.</p>",
		};
		expect(summaryFor([impressions], "The Maw"))
			.toBe("An unnatural quiet, the forest holding its breath");
	});

	it("never summarizes the generated Steading / creature appendix pages", () => {
		const pages = [
			{ name: "Steading", html: "<p>Size village (~200 souls) Population +0.</p>" },
			{ name: "Creatures of this Area", html: "<p>Creatures the bestiary catalogues here.</p>" },
			{ name: "Themes", html: "<p>A frontier outpost clinging to the mountainside.</p>" },
		];
		expect(summaryFor(pages, "Barrier Pass"))
			.toBe("A frontier outpost clinging to the mountainside.");
	});

	it("strips a link wrapper cleanly, leaving no space before the period", () => {
		const overview = {
			name: "Overview",
			html: "<p>The road runs from here to <strong>@UUID[Compendium.x.JournalEntry.D]{Gordin’s Delve}</strong>.</p>",
		};
		expect(summaryFor([overview], "x"))
			.toBe("The road runs from here to Gordin’s Delve.");
	});

	it("falls back to the name when nothing descriptive is found", () => {
		const pages = [{ name: "Steading", html: "<p>Size town.</p>" }];
		expect(summaryFor(pages, "Nowhere")).toBe("Nowhere");
	});

	it("caps an over-long opener with an ellipsis on a word boundary", () => {
		const long = "word ".repeat(140).trim() + ".";
		const out = summaryFor([{ name: "Overview", html: `<p>${long}</p>` }], "x");
		expect(out.length).toBeLessThanOrEqual(500);
		expect(out.endsWith("…")).toBe(true);
		expect(out.endsWith(" …")).toBe(false); // truncated on a word boundary, no dangling space
	});
});
