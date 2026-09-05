import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// The harvest plate is a copyrighted illustration the art installer provides, absent in most worlds.
//
// It used to share a grid row with the Seasonal gains, which cost two rules to make safe: an art
// column reserved whether or not anything filled it (so the gains sat in two thirds of the row with
// dead space beside them), and a `:has()` collapse to take it back. The Season tab is now the
// turnover beside the gains, with the plate closing the tab underneath — so the plate shares a row
// with nothing, reserves nothing, and needs neither rule. What survives is the obligation those
// rules rested on: the plate is absent from the DOM in a world without the art, not merely empty.

const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const css = read("styles/stonetop.css");
// The plate lives in the turn panel now, at its bottom right — not at the foot of the tab.
const partial = read("templates/actor/partials/steading-season-turn.hbs");

const PLATE = "steading-seasons-plate";

const ruleBlock = selector => {
	const at = css.indexOf(`${selector} {`);
	return at < 0 ? null : css.slice(at, css.indexOf("}", at));
};

describe("seasons plate layout", () => {
	// The tab is a column of stages, in the order the ritual runs. Nothing in it is sized against
	// the plate, so an absent plate costs the panels above it nothing.
	it("stacks the tab rather than reserving a column for the art", () => {
		const block = ruleBlock(".stonetop.sheet.steading .steading-seasons");
		expect(block).toContain("flex-direction: column");
		expect(block).not.toContain("32%");
	});

	// The turnover and the gains are the row — two columns, and no named areas, which is what the
	// plate used to be placed into.
	it("puts the turnover beside the gains, and gives the plate no area to sit in", () => {
		const block = ruleBlock(".stonetop.sheet.steading .steading-seasons-grid");
		expect(block).toContain("grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr)");
		expect(block).not.toContain("grid-template-areas");
	});

	// Decoration, capped — at full width it is the heaviest thing on the page.
	it("caps the plate rather than letting it take the panel's full width", () => {
		expect(ruleBlock(`.stonetop.sheet.steading .${PLATE}`)).toContain("max-width");
	});

	// Bottom RIGHT of the turn panel, and in flow. Positioned absolutely it would sit on top of a
	// long turnover checklist; `margin-left: auto` puts it in the corner the numbered steps leave
	// empty without ever overlapping them.
	it("sits at the panel's bottom right, in flow", () => {
		const block = ruleBlock(`.stonetop.sheet.steading .${PLATE}`);
		expect(block).toContain("margin: 6px 0 0 auto");
		expect(block).not.toContain("position: absolute");
	});

	it("is the last thing in the turn panel", () => {
		expect(partial.indexOf(PLATE)).toBeGreaterThan(partial.indexOf("steading-turn-steps"));
	});

	// A plate div rendered unconditionally — empty, or with a hidden img inside — would put a gap
	// under every tab in every world with no art installed.
	it("emits the plate only when the world has the art", () => {
		const plateAt = partial.indexOf(PLATE);
		expect(plateAt).toBeGreaterThan(-1);

		const guard = partial.lastIndexOf("{{#if seasons.plate}}", plateAt);
		expect(guard).toBeGreaterThan(-1);
		expect(partial.slice(guard, plateAt)).not.toContain("{{/if}}");
	});

	// The container query that hides the plate on a narrow sheet had NEVER fired: the container was
	// declared on `.tab[data-tab="seasons"]` and the tab is `season`, so it matched nothing.
	it("declares the query container on the tab that actually exists", () => {
		expect(css).toContain('.stonetop.sheet.steading .tab[data-tab="season"] {');
		expect(css).not.toContain('.tab[data-tab="seasons"]');
	});
});
