import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { SteadingDefaults } from "../../src/model/data/steading/SteadingDefaults.js";

/**
 * The arch is drawn twice over: an <img> the template points at `badge`, and a mask the stylesheet
 * paints the season's tint through. They HAVE to be the same file, and they cannot be the same
 * declaration — a relative url() inside a custom property resolves against the stylesheet that uses
 * the variable, so a path handed in on the element resolves inside styles/ and 404s. (That is not a
 * degraded tint: a mask image that fails to load renders the element fully transparent, and the
 * arches vanish.)
 *
 * So the paths are stated in two places by necessity, and this is what holds them together. A
 * comment cannot: the two sides fail apart silently, one of them invisibly.
 */
const CSS = readFileSync(path.resolve("styles/stonetop.css"), "utf8");

// Where the stylesheet's own relative urls resolve from.
const STYLES_DIR = path.resolve("styles");
// What a document path in the pack data is relative to.
const SYSTEM_ROOT = process.cwd();

/** The url declared for one rating's arch, as an absolute path on disk. */
function maskPath(ratingClass) {
	const rule = new RegExp(`\\.${ratingClass}\\s*\\{[^}]*--steading-arch-art:\\s*url\\((['"]?)(.*?)\\1\\)`, "s");
	const match = CSS.match(rule);
	return match ? path.resolve(STYLES_DIR, match[2].trim()) : null;
}

/** The path the <img> loads, as an absolute path on disk. */
const badgePath = badge => path.resolve(SYSTEM_ROOT, badge.replace(/^systems\/stonetop\//, ""));

describe("the steading arches", () => {
	for (const [rating, ratingClass] of [["fortunes", "steading-fortunes"], ["surplus", "steading-surplus"]]) {
		it(`masks ${rating} with the same file its badge loads`, () => {
			expect(maskPath(ratingClass), `no --steading-arch-art declared for .${ratingClass}`).not.toBeNull();
			expect(maskPath(ratingClass)).toBe(badgePath(SteadingDefaults[rating].badge));
		});
	}

	// The trap this whole arrangement exists to avoid, stated so a future pass cannot reintroduce it
	// by "removing the duplication".
	it("does not take the arch's path from the element", () => {
		const template = readFileSync(path.resolve("templates/actor/partials/steading-stat-panel.hbs"), "utf8");
		expect(template).not.toMatch(/--steading-arch-art/);
	});
});
