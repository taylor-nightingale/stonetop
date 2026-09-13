import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// A description editor has to be as tall as what is written in it, so that writing more pushes the
// sections under it down the sheet. Both of the shapes this system edits descriptions in defaulted
// to the opposite, and for different reasons:
//
//   <prose-mirror> — core pins .editor-content `position: absolute; inset: 0` inside a `flex: 1`
//   .editor-container, so the text being typed is out of flow and contributes NO height. The box was
//   whatever fixed number a rule named (core's own `--min-height: 150px`, our `height: 220px`), and
//   a longer description just scrolled inside it while nothing below moved.
//
//   the pencil-toggled <textarea> — no height rule at all, so it opened at the user agent's `rows`
//   default of two lines however long the description was.
//
// Neither is visible to a stylesheet read as text: the first depends on what core's cascade does to
// an element we only add a class to, and the second on a default that appears in no stylesheet at
// all. So this renders both against core's real sheet and measures whether the box grew.
//
// The assertions compare a SHORT description against a LONG one rather than checking heights against
// numbers. That is the actual claim — more text, more box, and the next section further down — and
// it cannot be satisfied by a fixed height the way any single measurement can.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

const SHORT = "A description.";
const LONG = Array.from({ length: 12 }, (_, i) =>
	`Paragraph ${i + 1} of a description long enough that no fixed-height box could hold it.`);

const bottomOf = (el) => el.values.boxTop + el.values.boxHeight;

/**
 * The item sheet's description editor, as core builds it once ProseMirror activates: a
 * .menu-container toolbar band, then the .editor-container it wraps the content in.
 */
const editorFixture = (paragraphs) => `
<div class="application stonetop sheet item themed theme-light"><div class="window-content">
	<div class="stonetop-item-sheet-part">
		<div class="stonetop-insert-sheet-body">
			<section class="stonetop-insert-sheet-section editor">
				<label class="stonetop-insert-sheet-label">Description</label>
				<prose-mirror class="stonetop-item-description-editor stonetop-grow-editor" id="probe-editor">
					<div class="menu-container">
						<menu class="editor-menu">
							<li><button type="button" data-action="bold"><i class="fa-solid fa-bold"></i></button></li>
						</menu>
					</div>
					<div class="editor-container" id="probe-container">
						<div class="editor-content" contenteditable="true">${paragraphs.map(p => `<p>${p}</p>`).join("")}</div>
					</div>
				</prose-mirror>
			</section>
			<section class="stonetop-insert-sheet-section" id="probe-next">
				<label class="stonetop-insert-sheet-label">Instinct</label>
			</section>
		</div>
	</div>
</div></div>`;

/** A follower card's Description block with the pencil open, and its Notes block underneath. */
const textareaFixture = (paragraphs) => `
<div class="application stonetop sheet actor themed theme-light"><div class="window-content">
	<div class="stonetop-follower-card">
		<div class="stonetop-creature-moves stonetop-editable is-editing">
			<div class="stonetop-creature-moves-head">
				<span class="stonetop-follower-label">Description</span>
			</div>
			<div class="stonetop-editable__display"></div>
			<textarea id="probe-textarea" class="stonetop-editable__edit stonetop-grow-field stonetop-follower-description">${paragraphs.join("\n\n")}</textarea>
		</div>
		<div class="stonetop-creature-moves stonetop-editable stonetop-follower-notes-block" id="probe-notes">
			<div class="stonetop-creature-moves-head">
				<span class="stonetop-follower-label">Notes</span>
			</div>
			<div class="stonetop-editable__display"><p>Notes.</p></div>
		</div>
	</div>
</div></div>`;

const measure = (bodyHtml, targets) => Object.fromEntries(probe.measure({
	bodyHtml,
	bodyClass: "vtt game theme-light",
	targets,
}));

describe.skipIf(!canProbe())("a description editor grows with what is written in it", () => {
	// In a hook, not the suite body: skipIf still runs the body, and the probe throws with no Foundry.
	let shortPm, longPm, shortTa, longTa;
	beforeAll(() => {
		const pmTargets = { editor: "#probe-editor", content: "#probe-container", next: "#probe-next" };
		shortPm = measure(editorFixture([SHORT]), pmTargets);
		longPm = measure(editorFixture(LONG), pmTargets);

		const taTargets = { field: "#probe-textarea", notes: "#probe-notes" };
		shortTa = measure(textareaFixture([SHORT]), taTargets);
		longTa = measure(textareaFixture(LONG), taTargets);
	});

	describe("the <prose-mirror> on an item sheet", () => {
		it("is taller for a long description than for a short one", () => {
			expect(longPm.editor.values.boxHeight).toBeGreaterThan(shortPm.editor.values.boxHeight);
		});

		it("holds the whole description without scrolling it", () => {
			expect(longPm.content.overflowsY).toBe(false);
		});

		it("starts the section below it under the editor, not over it", () => {
			expect(longPm.next.values.boxTop).toBeGreaterThanOrEqual(bottomOf(longPm.editor));
		});

		it("pushes that section further down as the description grows", () => {
			expect(longPm.next.values.boxTop).toBeGreaterThan(shortPm.next.values.boxTop);
		});

		it("keeps a floor under an empty editor, so it is not a sliver", () => {
			expect(shortPm.editor.values.boxHeight).toBeGreaterThanOrEqual(120);
		});
	});

	// No overflow assertion here, unlike the editor above: a <textarea> scrolls its value inside a
	// shadow tree, and the probe's Range sees only the raw text node — it reports zero overflow for a
	// two-row box with twelve paragraphs in it just as readily as for one that fits. Height is the
	// only honest measure of this element, so height is what these assert.
	describe("the pencil-toggled <textarea> on a follower card", () => {
		it("opens at the height of the text, not at the two-row default", () => {
			expect(longTa.field.values.boxHeight).toBeGreaterThan(shortTa.field.values.boxHeight);
		});

		it("pushes the Notes block below it down", () => {
			expect(longTa.notes.values.boxTop).toBeGreaterThanOrEqual(bottomOf(longTa.field));
			expect(longTa.notes.values.boxTop).toBeGreaterThan(shortTa.notes.values.boxTop);
		});
	});
});
