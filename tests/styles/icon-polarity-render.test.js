import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// Monochrome art has to be flipped per theme, and the flip is decided by an `img[src*=…]` rule that
// only fires on surfaces the stylesheet names. That list was stated once per rule and drifted: the
// compendium and journal copies named stonetop-art/ but not assets/content/, where 220 pack
// documents keep their art — so a popped-out pack in dark mode drew black markers on dark parchment.
//
// A text test cannot see this. It can prove the tokens exist and that the selectors parse, which
// they did throughout. What matters is whether a thumbnail on THIS surface ends up with a filter, so
// every surface that paints parchment is probed with both populations of art on it.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
]);

// src values are real paths from the packs, not stand-ins: the rules match on substrings of the
// path, so a plausible-looking fake would test the fixture rather than the stylesheet.
const OUR_ART = {
	sidebar: "systems/stonetop/assets/content/icons/npc.png",
	pack: "systems/stonetop/assets/content/wonders/markers/marker-beast.png",
	journal: "stonetop-art/arcana/the-cauldron.png",
	journalContent: "systems/stonetop/assets/content/seasons/season-spring.png",
	sheet: "systems/stonetop/assets/content/playbooks/the-fox.png"
};

const CORE_ART = "icons/svg/mystery-man.svg";

// Markup mirrors what core emits. The sidebar row and the compendium row are the same partial
// (templates/sidebar/partials/document-partial.hbs and apps/compendium/index-partial.hbs), and the
// pack window is a framed application carrying `compendium-directory sidebar-popout`.
const FIXTURE = `
<div id="interface" class="themed">
  <section class="sidebar-tab items-sidebar directory" id="p-sidebar">
    <ol class="directory-list">
      <li class="directory-item entry document flexrow">
        <img class="thumbnail" id="p-sidebar-art" src="${OUR_ART.sidebar}" alt="Halfling">
        <img class="thumbnail" id="p-sidebar-core" src="${CORE_ART}" alt="Unnamed">
        <a class="entry-name ellipsis">Blodwen</a>
      </li>
    </ol>
  </section>
</div>
<div class="application compendium-directory sidebar-popout themed" id="p-pack">
  <section class="window-content">
    <ol class="directory-list">
      <li class="directory-item entry document flexrow">
        <img class="thumbnail" id="p-pack-art" src="${OUR_ART.pack}" alt="Beast">
        <img class="thumbnail" id="p-pack-core" src="${CORE_ART}" alt="Unnamed">
        <a class="entry-name ellipsis">A Wondrous Beast</a>
      </li>
    </ol>
  </section>
</div>
<div class="application journal-entry themed" id="p-journal">
  <section class="window-content">
    <img id="p-journal-art" src="${OUR_ART.journal}" alt="The Cauldron">
    <img id="p-journal-content-art" src="${OUR_ART.journalContent}" alt="Spring">
    <img id="p-journal-core" src="${CORE_ART}" alt="Unnamed">
  </section>
</div>
<div class="application stonetop sheet actor themed" id="p-sheet">
  <section class="window-content">
    <img id="p-sheet-art" src="${OUR_ART.sheet}" alt="The Fox">
    <img id="p-sheet-core" src="${CORE_ART}" alt="Unnamed">
  </section>
</div>
`;

// Every image the fixture carries, labelled by which population it belongs to. Naming the surface in
// the key is what makes a failure say "the compendium popout" rather than "an image somewhere".
const OURS = [
	"sidebar-art", "pack-art", "journal-art", "journal-content-art", "sheet-art"
];
const CORE = [
	"sidebar-core", "pack-core", "journal-core", "sheet-core"
];

const PROBES = Object.fromEntries(
	[...OURS, ...CORE].map(name => [name, { selector: `#p-${name}`, properties: ["filter"] }])
);

/** A filter that actually repaints, as opposed to `none` or an identity `brightness(1)`. */
const repaints = value => Boolean(value) && value !== "none";

const renderIn = theme => probe.render({
	bodyHtml: FIXTURE,
	bodyClass: `game vtt themed theme-${theme}`,
	probes: PROBES
});

describe.runIf(canProbe())("rendered icon polarity", () => {
	describe("dark", () => {
		let results;
		beforeAll(() => { results = renderIn("dark"); });

		// The bug as the user met it: our art is black on transparency, so on dark parchment it has to
		// be inverted or it is not there at all.
		it.each(OURS)("inverts %s so black art is visible on dark parchment", name => {
			const element = results.get(name);
			expect(element.missing).toBe(false);
			expect(`${name}: ${element.get("filter")}`).toMatch(/invert\(/);
		});

		// Core's own icons are already white; they are dimmed to parchment rather than left as glare.
		it.each(CORE)("tones %s down rather than leaving it stark white", name => {
			const element = results.get(name);
			expect(element.missing).toBe(false);
			expect(`${name} repainted: ${repaints(element.get("filter"))}`).toBe(`${name} repainted: true`);
			expect(element.get("filter")).not.toMatch(/invert\(/);
		});
	});

	describe("light", () => {
		let results;
		beforeAll(() => { results = renderIn("light"); });

		// The other half of the same invariant, and the reason two tokens exist: on light parchment the
		// populations swap which one needs flipping.
		it.each(OURS)("leaves %s alone — black ink on light parchment is already right", name => {
			const element = results.get(name);
			expect(element.missing).toBe(false);
			expect(`${name}: ${element.get("filter")}`).toBe(`${name}: none`);
		});

		it.each(CORE)("inverts %s so white icons do not vanish on light parchment", name => {
			const element = results.get(name);
			expect(element.missing).toBe(false);
			expect(`${name}: ${element.get("filter")}`).toMatch(/invert\(/);
		});
	});
});

describe("render probe availability", () => {
	// A silent skip everywhere would let this rot unnoticed, the same way the drift itself did.
	it("reports whether this machine can run the probe", () => {
		expect(typeof canProbe()).toBe("boolean");
	});
});
