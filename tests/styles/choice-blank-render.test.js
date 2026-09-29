import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// A choice row's write-in blank — a lore question, an introduction, a Thrall's master — is written as
// "single-line to start, but grows downward as the answer wraps" (`choice-row.hbs`): `rows="1"` and
// `.stonetop-grow-field`, whose `field-sizing: content` sizes the box to what is in it.
//
// Core does not let it. `foundry2.css` gives every textarea `min-height: 60px` (layer
// `elements.forms`), and `field-sizing` only ever grows a box from its minimum — so every blank opened
// two lines tall, and the Seeker's five arcana questions were five 60px boxes. The steading's fields
// and the pencil's editor already carry the fix; the choice blank did not.
//
// Nothing about this shows in a stylesheet read as text: the floor is core's, on an element we only
// add classes to. So it is rendered against core's real sheet, and the claims are relative — shorter
// than a textarea core is left to size, and still growing with a long answer — rather than a number
// that would pass for a box held at any fixed height.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

const LONG = Array.from({ length: 6 }, (_, i) =>
	`Sentence ${i + 1} of an answer long enough to wrap across several lines of the blank.`).join(" ");

const blank = (id, value, kind = "inline") => kind === "inline"
	? `<textarea id="${id}" rows="1" class="stonetop-cg-text stonetop-choice-input stonetop-choice-input--inline stonetop-grow-field">${value}</textarea>`
	: `<textarea id="${id}" class="stonetop-cg-text stonetop-choice-input stonetop-choice-input--rich">${value}</textarea>`;

const fixture = `
<div class="application stonetop sheet actor character themed theme-light"><div class="window-content">
	<div class="tab playbook active" style="width: 480px">
		<div class="stonetop-choice-entry">
			<div class="stonetop-choice-description">Where did you acquire it?</div>
			<div class="stonetop-choice-option stonetop-choice-option--text">${blank("empty", "")}</div>
			<div class="stonetop-choice-option stonetop-choice-option--text">${blank("long", LONG)}</div>
			<div class="stonetop-choice-option stonetop-choice-option--text">${blank("rich", "", "rich")}</div>
			<textarea id="plain"></textarea>
		</div>
	</div>
</div></div>`;

describe.skipIf(!canProbe())("a choice row's write-in blank", () => {
	// In a hook, not the suite body: skipIf still runs the body, and the probe throws with no Foundry.
	let m;
	beforeAll(() => {
		m = Object.fromEntries(probe.measure({
			bodyHtml: fixture,
			bodyClass: "vtt game theme-light",
			targets: { empty: "#empty", long: "#long", rich: "#rich", plain: "#plain" },
		}));
	});

	it("starts shorter than a textarea core sizes — one line, not core's two", () => {
		expect(m.empty.values.boxHeight).toBeLessThan(m.plain.values.boxHeight);
	});

	it("is no taller empty than a single line of its own text and padding", () => {
		expect(m.empty.values.boxHeight).toBeLessThan(40);
	});

	it("still grows downward with a long answer", () => {
		expect(m.long.values.boxHeight).toBeGreaterThan(m.empty.values.boxHeight * 2);
	});

	// The rich variant is meant to open tall: `min-height: 4.5em` is its own floor, not core's.
	it("leaves the rich blank its own taller floor", () => {
		expect(m.rich.values.boxHeight).toBeGreaterThan(m.empty.values.boxHeight);
	});
});
