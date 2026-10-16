import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";

// The track beside an arcanum's name in the list, wrapped onto a second line. Its pips and their words
// were sibling flex items spaced by a margin on each pip after a word, so a wrapped line started
// indented by that margin, and the line could break between a pip and its own word.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const line = resource => renderLocalized("stonetop.arcana-line", {
	slug: "prospectors-tale", name: "A prospector's tale", flipped: true,
	face: { title: "Sublime Words", resource },
}, "en");

const measure = (resource, targets) => probe.measure({
	bodyHtml: `<div class="application stonetop sheet actor character themed theme-light"><div class="window-content">
		<ul class="stonetop-arcana-lines" style="width: 14rem">${line(resource)}</ul></div></div>`,
	bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
	targets, chromeFlags: ["--window-size=600,400"],
});

const right = v => v.boxLeft + v.boxWidth;

describe.skipIf(!canProbe())("an arcanum's labelled track, wrapped in the list", () => {
	let m;
	beforeAll(() => {
		m = measure({ max: 3, current: 0, labels: ["raspy voice", "coughing fits", "mute"] }, {
			track: ".stonetop-arcana-line-track",
			first: ".stonetop-resource-pair:nth-child(1)",
			second: ".stonetop-resource-pair:nth-child(2)",
			third: ".stonetop-resource-pair:nth-child(3)",
			thirdPip: ".stonetop-resource-pair:nth-child(3) > button",
			thirdLabel: ".stonetop-resource-pair:nth-child(3) > .stonetop-resource-label",
		});
	});
	const el = name => m.get(name).values;

	it("wraps in this fixture", () => {
		expect(el("third").boxTop).toBeGreaterThan(el("first").boxTop);
	});

	it("starts the wrapped line flush with the first", () => {
		expect(el("third").boxLeft).toBeCloseTo(el("track").boxLeft, 0);
	});

	it("keeps a pip on the line its word is on", () => {
		expect(el("thirdLabel").boxTop).toBeLessThan(el("thirdPip").boxTop + el("thirdPip").boxHeight);
		expect(el("thirdPip").boxTop).toBeLessThan(el("thirdLabel").boxTop + el("thirdLabel").boxHeight);
	});

	it("spaces one pair from the next", () => {
		expect(el("second").boxLeft - right(el("first"))).toBeGreaterThanOrEqual(6);
	});
});

describe.skipIf(!canProbe())("an arcanum's unlabelled track in the list", () => {
	let m;
	beforeAll(() => {
		m = measure({ max: 3, current: 1 }, {
			first: ".stonetop-arcana-line-track > button:nth-child(1)",
			second: ".stonetop-arcana-line-track > button:nth-child(2)",
		});
	});
	const el = name => m.get(name).values;

	it("keeps its pips close together", () => {
		expect(el("second").boxLeft - right(el("first"))).toBeCloseTo(2, 0);
	});
});
