import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";

// The "Gear terms & tags" glossary is the system's only <dl>, and core styles <dt> for its dark UI —
// `text-shadow: 1px 1px #000` under a light term colour. On parchment the shadow smears the term
// rather than lifting it, and under v13's `--color-light-2` the term itself goes cream on cream.
//
// Only a browser can answer whether our override actually reaches the element through core's cascade
// layers, so the glossary is rendered in real Chrome, in both themes, and read back. The probe uses
// the newest local Foundry install, so whichever of the two core rules that version ships is the one
// under test.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// The glossary as packs/src/reference/gear-and-possessions.json carries it, inside the journal
// nesting core gives it.
const FIXTURE = `
<div class="application journal-entry" id="p-journal" style="width: 900px">
  <div class="window-content" id="p-paper">
    <div class="journal-entry-page">
      <div class="stonetop-wonder" id="p-root">
        <p id="p-prose">Some items have tags, which say what they do.</p>
        <dl class="gear-terms">
          <dt id="p-term"><em>cumbersome</em></dt>
          <dd id="p-def">you’re noisy, slow, hot, and quick to tire while carrying it.</dd>
          <dt id="p-term2"><em>crude</em></dt>
          <dd>prone to break, wear out, stop working, etc.</dd>
        </dl>
      </div>
    </div>
  </div>
</div>`;

const PROBES = {
	paper: { selector: "#p-paper", properties: ["background-color"] },
	prose: { selector: "#p-prose", properties: ["color"] },
	term:  { selector: "#p-term",  properties: ["color", "text-shadow", "font-weight"] },
	def:   { selector: "#p-def",   properties: ["color"] },
};

const THEMES = [
	{ name: "light", bodyClass: "game vtt theme-light" },
	{ name: "dark",  bodyClass: "game vtt theme-dark" },
];

describe.skipIf(!canProbe())("Gear terms glossary, rendered", () => {
	const rendered = new Map();

	beforeAll(() => {
		for (const theme of THEMES) {
			rendered.set(theme.name, probe.render({ bodyHtml: FIXTURE, bodyClass: theme.bodyClass, probes: PROBES }));
		}
	}, 120000);

	for (const theme of THEMES) {
		describe(`${theme.name} theme`, () => {
			const probed = (name) => rendered.get(theme.name).get(name);

			it("renders every element the glossary relies on", () => {
				for (const name of Object.keys(PROBES)) expect(probed(name).missing, name).toBe(false);
			});

			// The failure this file exists for.
			it("leaves no shadow under the term", () => {
				expect(probed("term").get("text-shadow")).toBe("none");
			});

			it("sets the term in the surrounding ink, not core's dark-UI cream", () => {
				expect(probed("term").get("color")).toBe(probed("prose").get("color"));
			});

			it("keeps the term readable against the parchment on its own, shadow or not", () => {
				const ink = CssColor.parse(probed("term").get("color"));
				const paper = CssColor.parse(probed("paper").get("background-color"));
				expect(ink.over(paper).contrastWith(paper)).toBeGreaterThan(4.5);
			});

			it("still sets the term apart from its definition by weight", () => {
				expect(Number(probed("term").get("font-weight")))
					.toBeGreaterThan(Number(probed("def").get("font-weight")));
			});
		});
	}
});
