import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// The harvest plate is a copyrighted illustration the art installer provides, absent in most worlds.
//
// It rides BEHIND the numbered steps now, as a watermark in the bottom-right corner. It got there by
// elimination. Every arrangement that put it in the flow had to reconcile two content heights — the
// art's and the steps' — and CSS cannot bottom-align a float, so each one ended up measuring: a
// strut sized in JavaScript, a ResizeObserver, and the shared result rows rebuilt out of grid so
// their text could wrap to the art's silhouette. The measured position was also a discontinuous
// function of the sheet's width, so the plate visibly crawled and then jumped 55px as you dragged.
//
// A background participates in no layout. Nothing is measured, so nothing can drift.
//
// What survives every layout this has had: the plate is absent in a world without the art, not
// merely empty.

const read = rel => readFileSync(path.resolve(process.cwd(), rel), "utf8");
const css = read("styles/stonetop.css");
const partial = read("templates/actor/partials/steading-season-box.hbs");

const ruleBlock = selector => {
	const at = css.indexOf(`\n${selector} {`);
	return at < 0 ? null : css.slice(at, css.indexOf("}", at));
};

const MARK = ".stonetop.sheet.steading .steading-turn-steps::after";

describe("the seasons plate watermark", () => {
	// The tab is a column of stages, in the order the ritual runs. Nothing in it is sized against
	// the plate, so an absent plate costs the panels above it nothing.
	it("stacks the tab rather than reserving a column for the art", () => {
		const block = ruleBlock(".stonetop.sheet.steading .steading-seasons");
		expect(block).toContain("flex-direction: column");
		expect(block).not.toContain("32%");
	});

	// Out of flow entirely. This is the claim the whole design rests on: with the art taking no part
	// in layout there is no height to reconcile, so nothing has to be measured and nothing can drift.
	it("puts the art out of flow, behind the steps", () => {
		const block = ruleBlock(MARK);
		expect(block).toContain("position: absolute");
		expect(block).toContain("pointer-events: none");
		expect(block).toContain("z-index: 0");
	});

	// The corner is what keeps it off the words. Spread across the section at any strength you can
	// see, the foliage sits behind the result rows; pulled into the corner only the last row has
	// anything behind it at all.
	it("masks the mark into the bottom-right corner", () => {
		const block = ruleBlock(MARK);
		expect(block).toContain("right: 0");
		expect(block).toContain("bottom: 0");
		expect(block).toMatch(/mask-image: radial-gradient\(.*100% 100%/);
	});

	// Sized by the plate's own proportions, so the corner it hugs is the corner of the art rather
	// than of some box the art happens to sit in.
	it("gives the mark the plate's aspect ratio", () => {
		expect(ruleBlock(MARK)).toContain("aspect-ratio: 2499 / 1170");
	});

	// Nothing about the art is a float any more, anywhere.
	it("leaves no float or shape behind", () => {
		expect(css).not.toContain("shape-outside");
		expect(css).not.toContain("steading-seasons-plate");
		expect(partial).not.toContain("steading-seasons-plate");
	});

	// The steps must own a stacking context above the mark, or a result row's coloured band and a
	// lit tier both get painted underneath the art.
	it("lifts the steps above the mark", () => {
		const block = ruleBlock(".stonetop.sheet.steading .steading-turn-step");
		expect(block).toContain("z-index: 1");
		expect(block).toContain("position: relative");
	});

	// A url() the stylesheet cannot know: the installer produces the path at runtime. With no
	// property set the fallback draws nothing, which is every world without Book I art.
	it("takes the path from the element, and draws nothing without one", () => {
		expect(ruleBlock(MARK)).toContain("var(--seasons-plate, none)");
		expect(partial).toContain("--seasons-plate: url('{{seasons.plate}}')");

		// the ATTRIBUTE, not the prose: the comment above it names the property too
		const at = partial.indexOf(`style="--seasons-plate`);
		const guard = partial.lastIndexOf("{{#if seasons.plate}}", at);
		expect(guard).toBeGreaterThan(-1);
		expect(partial.slice(guard, at)).not.toContain("{{/if}}");
	});

	// The container query that hides it on a narrow sheet had once been declared on
	// `.tab[data-tab="seasons"]`, and the tab is `season` — so it matched nothing at all.
	it("declares the query container on the tab that actually exists", () => {
		expect(css).toContain('.stonetop.sheet.steading .tab[data-tab="season"] {');
		expect(css).not.toContain('.tab[data-tab="seasons"]');
	});

	// `content: none`, not `display: none`: a generated box with no content is never generated, and
	// there is no element here to hide.
	it("drops the mark on a narrow sheet", () => {
		const query = css.slice(css.indexOf("@container steading-seasons (max-width: 620px)"));
		const body = query.slice(0, query.indexOf("\n}\n"));
		expect(body).toContain("steading-turn-steps::after");
		expect(body).toContain("content: none");
	});
});
