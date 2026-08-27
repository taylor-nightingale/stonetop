import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The Notes tab's bio and notes editors are always-active <prose-mirror> elements, so their toolbar
// — bold, italic, save — is on screen the whole time. Core lays that toolbar out as a flex item of
// a fixed `--menu-height` band inside a flex-column <prose-mirror>, and pins .editor-content
// absolutely over the rest. Give the element any other `display` and the band computes to zero: its
// 26px buttons spill out of it and the editor content lies on top of them, eating every click.
//
// Text-parsing the stylesheet cannot see that. The band's height never appears in our CSS at all —
// it is core's, and whether it survives depends on what our `display` does to core's flex layout.
// Only a browser knows, so this renders the editor against core's real stylesheet and measures.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// The DOM ProseMirrorMenu builds once the editor activates: a .menu-container band holding the
// <menu>, then the .editor-container core wraps around the content.
const EDITOR = `
<div class="application stonetop sheet character themed theme-light"><div class="window-content">
	<section class="sheet-tab stonetop-notes-tab">
		<prose-mirror class="stonetop-notes-editor" id="probe-editor">
			<div class="menu-container" id="probe-band">
				<menu class="editor-menu" id="probe-menu">
					<li class="pm-dropdown format"><span><span class="label">Format</span><i class="fa-solid fa-chevron-down"></i></span></li>
					<li><button type="button" data-action="bold"><i class="fa-solid fa-bold"></i></button></li>
					<li><button type="button" id="probe-save" data-action="save"><i class="fa-solid fa-floppy-disk"></i></button></li>
				</menu>
			</div>
			<div class="editor-container" id="probe-container">
				<div class="editor-content" contenteditable="true"><p>Notes.</p></div>
			</div>
		</prose-mirror>
	</section>
</div></div>`;

const measure = (rootPx) => probe.measure({
	bodyHtml: EDITOR,
	bodyClass: "vtt game theme-light",
	// Core sets the root font size from the Font Size setting; the toolbar band is fixed px, so the
	// buttons have to keep fitting it at every step.
	rootAttrs: `style="font-size: ${rootPx}px"`,
	targets: {
		band: "#probe-band",
		save: "#probe-save",
		container: "#probe-container",
	},
});

describe.skipIf(!canProbe())("the Notes tab editor toolbar", () => {
	// In a hook, not the suite body: skipIf still runs the body, and the probe throws with no Foundry.
	const measured = new Map();
	beforeAll(() => {
		for (const px of [16, 24]) measured.set(px, measure(px));
	});

	for (const px of [16, 24]) {
		describe(`at a ${px}px root font`, () => {
			it("gives the toolbar a band at least as tall as its buttons", () => {
				const { band, save } = Object.fromEntries(measured.get(px));
				expect(band.values.boxHeight).toBeGreaterThanOrEqual(save.values.boxHeight);
			});

			it("keeps the save button inside that band", () => {
				const { band, save } = Object.fromEntries(measured.get(px));
				const bandBottom = band.values.boxTop + band.values.boxHeight;
				const saveBottom = save.values.boxTop + save.values.boxHeight;
				expect(save.values.boxTop).toBeGreaterThanOrEqual(band.values.boxTop);
				expect(saveBottom).toBeLessThanOrEqual(bandBottom);
			});

			it("starts the editing surface below the toolbar, not over it", () => {
				const { band, container } = Object.fromEntries(measured.get(px));
				expect(container.values.boxTop).toBeGreaterThanOrEqual(band.values.boxTop + band.values.boxHeight);
			});
		});
	}
});
