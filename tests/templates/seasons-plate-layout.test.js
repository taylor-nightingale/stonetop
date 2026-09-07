import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// The harvest plate is a copyrighted illustration the art installer provides, absent in most worlds.
//
// It has been three layouts. A grid row shared with the Seasonal gains, which needed a reserved art
// column and a `:has()` collapse to take it back. Then in flow at the turn panel's bottom right,
// where nothing sat beside it — capped at 45%, so more than half of its own line was empty. It is
// FLOATED now, inside the turn control, with the season's move running beside it and wrapping to the
// art's own silhouette rather than to its box.
//
// What survives every one of those: the plate is absent from the DOM in a world without the art,
// not merely empty.

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

	// Decoration, capped — at full width it is the heaviest thing on the page.
	it("caps the plate rather than letting it take the panel's full width", () => {
		expect(ruleBlock(`.stonetop.sheet.steading .${PLATE}`)).toContain("max-width");
	});

	// Floated, so the move's text runs beside it and it costs no height of its own. Never absolute:
	// positioned out of flow it would sit on top of whatever the turn control holds.
	it("floats, and stays in flow", () => {
		const block = ruleBlock(`.stonetop.sheet.steading .${PLATE}`);
		expect(block).toContain("float: right");
		expect(block).not.toContain("position: absolute");
	});

	// The point of floating it: text follows the ART, not its bounding box. The silhouette slants up
	// and to the right, so the lower-left of the box is transparent — wrapping to the box would break
	// every line against an invisible straight edge with a blank wedge behind it.
	it("wraps text to the art's own silhouette", () => {
		expect(ruleBlock(`.stonetop.sheet.steading .${PLATE}`)).toContain("shape-outside: var(--plate)");
	});

	// The path is produced at runtime by the art installer, so it arrives on the ELEMENT: a url() in
	// the stylesheet would resolve against the stylesheet, and shape-outside needs the real image.
	it("takes its shape url from the element, not the stylesheet", () => {
		expect(partial).toContain("--plate: url('{{seasons.plate}}')");
		expect(css).not.toContain("shape-outside: url(");
	});

	// A float must not escape the control that holds it into the section below.
	it("is contained by the body it floats inside", () => {
		expect(ruleBlock(".stonetop.sheet.steading .steading-turn-body")).toContain("display: flow-root");
	});

	// Before the text it makes room for: a float only affects the line boxes that come after it.
	it("is emitted ahead of the move it wraps", () => {
		expect(partial.indexOf(PLATE)).toBeLessThan(partial.indexOf("steading-turn-steps"));
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
