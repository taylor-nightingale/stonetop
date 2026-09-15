import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

/**
 * The steading writes notes in two places — the scratchpad on Play and a note on each neighbouring
 * place — and they are meant to be ONE field seen at two sizes.
 *
 * They drifted apart without anything noticing: the neighbour note kept the frame core gives a
 * textarea while the scratchpad stripped it down to a single rule, and for a while the stylesheet's
 * own comments described both as the stripped one. Nothing could catch that by reading the CSS,
 * because the frame is not declared anywhere — it is core's, and the difference was one class in a
 * template removing it. Only a browser resolving core's sheet under ours can see the two boxes side
 * by side, which is what this does.
 *
 * Size is deliberately NOT asserted equal: the floor and the stretch are each column's to decide
 * (2lh under a place, the leftover height of the Resources column on Play). Everything a reader uses
 * to tell one box from another is.
 */
const STYLES = path.resolve(process.cwd(), "styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// The two notes as their templates write them: steading.hbs for the scratchpad,
// partials/steading-neighbor-places.hbs for the place's note.
const FIXTURE = `
<div class="application stonetop sheet steading themed theme-light"><div class="window-content">
	<section class="steading-neighbor-places">
		<section class="steading-neighbor-place steading-block">
			<label class="steading-neighbor-text-field" id="place-field">
				<span>Notes</span>
				<textarea id="place-note" rows="2" class="stonetop-neighbor-place-note stonetop-grow-field"
				          placeholder="Notes">Owes us a boat.</textarea>
			</label>
		</section>
	</section>
	<div class="steading-play-grid">
		<div class="steading-notes-field steading-block">
			<textarea id="play-note" class="stonetop-notes stonetop-grow-field"
			          placeholder="Notes">Tegwen is still angry.</textarea>
		</div>
	</div>
</div></div>`;

// What a reader tells two boxes apart by. Not size — see the note above.
const SHARED = [
	"border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
	"border-top-style", "border-top-color", "border-bottom-color",
	"border-radius", "box-shadow", "background-color",
	"padding-top", "padding-right", "padding-bottom", "padding-left",
	"font-size", "font-family", "color", "resize", "overflow-wrap",
];

describe.skipIf(!canProbe())("the steading's two notes boxes", () => {
	let seen;
	beforeAll(() => {
		seen = probe.render({
			bodyHtml: FIXTURE,
			bodyClass: "vtt game theme-light",
			probes: {
				place: { selector: "#place-note", properties: [...SHARED, "min-height"] },
				play: { selector: "#play-note", properties: [...SHARED, "min-height"] },
			},
		});
	});

	it.each(SHARED)("draws the same %s on both", property => {
		expect(seen.get("play").get(property)).toBe(seen.get("place").get(property));
	});

	// Stated outright rather than only as an equality, so a change that strips BOTH boxes still
	// fails here: the frame is the thing that was lost, and two identically frameless boxes would
	// satisfy every assertion above.
	it("keeps the frame core gives a textarea, on both", () => {
		for (const name of ["place", "play"]) {
			const box = seen.get(name);
			expect(parseFloat(box.get("border-bottom-width")), name).toBeGreaterThan(0);
			expect(parseFloat(box.get("border-top-width")), name).toBeGreaterThan(0);
			expect(parseFloat(box.get("border-radius")), name).toBeGreaterThan(0);
			expect(box.get("box-shadow"), name).not.toBe("none");
			expect(box.get("background-color"), name).not.toBe("rgba(0, 0, 0, 0)");
		}
	});

	// The part that is each column's own, asserted so the shared rule above cannot quietly flatten
	// the scratchpad to a two-line box.
	it("lets each box keep the floor its own column gives it", () => {
		expect(seen.get("play").get("min-height")).not.toBe(seen.get("place").get("min-height"));
	});
});
