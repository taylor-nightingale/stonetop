import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// Two ways a focus ring stops telling a keyboard user where they are, both of which look like an
// ordinary field until you put the caret in one.
//
// 1. THE RING IS SMALLER THAN THE BOX. Core's `.editor-content` IS the contenteditable; the
//    <prose-mirror> around it is only the frame. `.stonetop-grow-editor` puts that content back in
//    flow so the element sizes to its text — so a height floor on the FRAME leaves the writable
//    element one line tall inside a 10em box. Everything below the first line is dead: a click there
//    puts no caret in, and the ring wraps the line rather than the box.
//
// 2. THE RING IS CLIPPED. An `overflow` of anything but `visible` clips at the padding box, and
//    every tab on these sheets lays its first column flush against that edge. The ring is drawn
//    OUTSIDE the box it surrounds, so the whole of its left side was cut off — the one edge a reader
//    tracks a column down.
//
// Neither is visible to a text-parsing test: both are about where boxes ended up once core's layout,
// our layer and the scroll container had all had their say. Hence the browser.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// The DOM Foundry builds once a <prose-mirror> activates: the toolbar band, then the container core
// wraps round the contenteditable. One short paragraph, which is the case that used to leave a dead
// strip — a full editor's text fills the floor and hides the defect.
const editor = (className, id) => `
<prose-mirror class="${className} stonetop-grow-editor" id="${id}">
	<div class="menu-container"><menu class="editor-menu"><li><button type="button" data-action="bold"><i class="fa-solid fa-bold"></i></button></li></menu></div>
	<div class="editor-container" id="${id}-container">
		<div class="editor-content" id="${id}-content" contenteditable="true"><p>One line.</p></div>
	</div>
</prose-mirror>`;

// The three surfaces that floor an editor. Each is [label, id, wrapper markup].
const EDITORS = [
	["the character sheet's Notes tab", "notes",
		`<section class="sheet-tab stonetop-notes-tab">${editor("stonetop-notes-editor", "notes")}</section>`],
	["a choice group's rich text field", "choice",
		`<div class="choices-field choices-field--rich">${editor("choices-rich-text", "choice")}</div>`],
	["an insert sheet's description", "insert",
		`<div class="stonetop-insert-sheet-section">${editor("stonetop-item-description-editor", "insert")}</div>`],
];

const EDITOR_FIXTURE = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
	${EDITORS.map(([, , markup]) => markup).join("\n")}
</div></div>`;

describe.skipIf(!canProbe())("what a focus ring actually surrounds", () => {
	describe("an always-active ProseMirror", () => {
		let measured;
		let inset;
		beforeAll(() => {
			const common = { bodyHtml: EDITOR_FIXTURE, bodyClass: "vtt game theme-light", rootAttrs: 'style="font-size: 16px"' };
			measured = probe.measure({
				...common,
				targets: Object.fromEntries(EDITORS.flatMap(([, id]) => [
					[`${id}-frame`, `#${id}`],
					[`${id}-container`, `#${id}-container`],
					[`${id}-content`, `#${id}-content`],
				])),
			});
			// The frame's own border and padding are not dead space — they are the frame. Read them so
			// the claim below is about the box the editor was given rather than about the line drawn
			// round it, which differs per surface.
			const seen = probe.render({
				...common,
				probes: Object.fromEntries(EDITORS.map(([, id]) => [
					id, { selector: `#${id}`, properties: ["border-bottom-width", "padding-bottom"] },
				])),
			});
			inset = id => parseFloat(seen.get(id).get("border-bottom-width")) + parseFloat(seen.get(id).get("padding-bottom"));
		});

		for (const [label, id] of EDITORS) {
			// The claim is the whole point: the element that TAKES focus fills the frame that was
			// floored, so there is nowhere inside the box that is not the editor. A floor on the frame
			// instead of the content fails this by exactly the dead strip it leaves.
			it(`fills ${label} with its own writable surface`, () => {
				const frame     = measured.get(`${id}-frame`).values;
				const container = measured.get(`${id}-container`).values;
				const content   = measured.get(`${id}-content`).values;
				expect(measured.get(`${id}-content`).missing, "the editor did not render").toBe(false);

				const frameInnerBottom = frame.boxTop + frame.boxHeight - inset(id);
				const contentBottom = content.boxTop + content.boxHeight;
				expect(frameInnerBottom - contentBottom,
					"there is dead space under the editor: a click there puts no caret in, and the focus ring stops short of the frame")
					.toBeLessThan(1);
				// And the growth the floor used to be spelled for still works: the frame is the
				// container's height, not a number of its own.
				expect(container.boxTop + container.boxHeight).toBeCloseTo(frameInnerBottom, 0);
			});
		}
	});

	// ── The clipped ring ──
	//
	// Measured rather than asserted as a padding value: what matters is that the field's border box
	// starts far enough inside the scroller's own box for the ring to be drawn, and only geometry
	// answers that. The reach is read from the tokens rather than hard-coded, so redrawing the ring
	// moves the test with it.
	describe("a field flush against a scrolling column", () => {
		const SCROLLERS = [
			["the tab scroller both sheets use", "body",
				`<div class="stonetop-rail-layout" data-side="left"><div class="stonetop-rail"></div>
					<div class="sheet-body" id="scroll-body"><div class="tab active" data-tab="play">
						<textarea id="field-body" class="stonetop-notes stonetop-grow-field"></textarea>
					</div></div>
				</div>`],
			["the Places tab's neighbours column", "neighbors",
				`<section class="steading-neighbor-places" id="scroll-neighbors">
					<section class="steading-neighbor-place steading-block"><label class="steading-neighbor-text-field">
						<span>Notes</span>
						<textarea id="field-neighbors" rows="2" class="stonetop-neighbor-place-note stonetop-grow-field"></textarea>
					</label></section>
				</section>`],
			["the Folk tab's reference column", "folk",
				`<div class="steading-folk-ref" id="scroll-folk">
					<button type="button" id="field-folk" class="steading-folk-entry">Aelfa</button>
				</div>`],
		];

		let reach;
		let measured;
		beforeAll(() => {
			const html = `<div class="application stonetop sheet steading themed theme-light"><div class="window-content">
				${SCROLLERS.map(([, , markup]) => markup).join("\n")}
			</div></div>`;
			const seen = probe.render({
				bodyHtml: html, bodyClass: "vtt game theme-light", rootAttrs: 'style="font-size: 16px"',
				probes: { ring: { selector: ":root", properties: ["--focus-ring-width", "--focus-ring-offset"] } },
			});
			// Declared in rem; the fixture pins the root at 16px, so this is the px the ring reaches.
			const px = v => parseFloat(seen.get("ring").get(v)) * 16;
			reach = px("--focus-ring-width") + px("--focus-ring-offset");

			measured = probe.measure({
				bodyHtml: html, bodyClass: "vtt game theme-light", rootAttrs: 'style="font-size: 16px"',
				targets: Object.fromEntries(SCROLLERS.flatMap(([, id]) => [
					[`scroll-${id}`, `#scroll-${id}`],
					[`field-${id}`, `#field-${id}`],
				])),
			});
		});

		it("reaches somewhere at all", () => {
			expect(reach).toBeGreaterThan(0);
		});

		for (const [label, id] of SCROLLERS) {
			it(`leaves the ring room inside ${label}`, () => {
				const scroller = measured.get(`scroll-${id}`).values;
				const field    = measured.get(`field-${id}`).values;
				expect(measured.get(`field-${id}`).missing, "the field did not render").toBe(false);
				expect(field.boxLeft - scroller.boxLeft,
					"the field sits hard against the scroller's clip edge, so the left side of its focus ring is cut off")
					.toBeGreaterThanOrEqual(reach);
			});
		}
	});
});
