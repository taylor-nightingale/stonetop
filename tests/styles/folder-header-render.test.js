import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";

// A directory folder's header is drawn for a dark UI in both of core's themes — `--color-light-2`
// text over `--sidebar-folder-color` — so repainting the ramps leaves the light theme with cream on
// a tan band, 1.5:1. The same header appears in the sidebar tabs and inside a compendium window, so
// both are rendered here, in both themes, and read back through core's real cascade layers: our
// override lives in `@layer system`, and only a browser can say whether it reaches the element.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

// The ink token is authored in hex and computed back as rgb(), so the two are compared as channels.
const rgb = (value) => {
	const color = CssColor.parse(value);
	return [color.r, color.g, color.b];
};

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css"),
]);

// templates/sidebar/partials/folder-partial.hbs, with the second folder given a colour the way the
// partial does it — inline on the header.
const directory = (wrapper) => `
<div class="${wrapper}">
  <section class="window-content">
    <div class="directory flexcol">
      <ol class="directory-list">
        <li class="directory-item folder flexcol expanded" data-folder-id="a">
          <header class="folder-header" data-action="toggleFolder">
            <i class="fa-solid fa-folder-open fa-fw" inert></i>
            <span class="folder-name ellipsis">Playbook Moves</span>
            <button type="button" class="create-button create-folder icon icon-plus"></button>
          </header>
          <ol class="subdirectory plain">
            <li class="directory-item document" data-entry-id="b">
              <span class="entry-name">Defy Danger</span>
            </li>
          </ol>
        </li>
        <li class="directory-item folder flexcol expanded" data-folder-id="c">
          <header class="folder-header" style="background-color: rgb(120, 40, 40);" data-action="toggleFolder">
            <span class="folder-name ellipsis">Somebody's Colour</span>
          </header>
        </li>
      </ol>
    </div>
  </section>
</div>`;

const PROBES = {
	header:   { selector: ".folder-header:not([style])", properties: ["color", "background-color", "text-shadow", "--st-ink"] },
	name:     { selector: ".folder-header:not([style]) .folder-name", properties: ["color"] },
	button:   { selector: ".folder-header:not([style]) .create-button", properties: ["color"] },
	coloured: { selector: ".folder-header[style]", properties: ["color", "background-color"] },
};

// The sidebar tab and the popped-out compendium window carry different chrome around the same rows.
const SURFACES = [
	{ name: "compendium window", wrapper: "application compendium-directory sidebar-popout" },
	{ name: "sidebar tab", wrapper: "application sidebar-tab directory" },
];

const THEMES = [
	{ name: "light", bodyClass: "game vtt theme-light" },
	{ name: "dark", bodyClass: "game vtt theme-dark" },
];

describe.skipIf(!canProbe())("Directory folder headers, rendered", () => {
	const rendered = new Map();
	const key = (surface, theme) => `${surface}/${theme}`;

	beforeAll(() => {
		for (const surface of SURFACES) {
			for (const theme of THEMES) {
				rendered.set(key(surface.name, theme.name), probe.render({
					bodyHtml: directory(surface.wrapper), bodyClass: theme.bodyClass, probes: PROBES,
				}));
			}
		}
	}, 120000);

	for (const surface of SURFACES) {
		for (const theme of THEMES) {
			describe(`${surface.name}, ${theme.name} theme`, () => {
				const probed = (name) => rendered.get(key(surface.name, theme.name)).get(name);

				it("renders every row the folder relies on", () => {
					for (const name of Object.keys(PROBES)) expect(probed(name).missing, name).toBe(false);
				});

				// The failure this file exists for.
				it("reads the folder name in the theme's ink, not core's dark-UI cream", () => {
					expect(rgb(probed("name").get("color"))).toEqual(rgb(probed("header").get("--st-ink")));
				});

				it("keeps the name readable on the folder band", () => {
					const ink = CssColor.parse(probed("name").get("color"));
					const band = CssColor.parse(probed("header").get("background-color"));
					expect(ink.over(band).contrastWith(band)).toBeGreaterThan(4.5);
				});

				it("drops the shadow core lifts light text off a dark band with", () => {
					expect(probed("header").get("text-shadow")).toBe("none");
				});

				// The button declares --button-text-color on itself, so it does not follow by inheritance.
				it("carries the create button along with the header", () => {
					expect(probed("button").get("color")).toBe(probed("name").get("color"));
				});

				it("leaves a coloured folder painted in its own colour", () => {
					expect(probed("coloured").get("background-color")).toBe("rgb(120, 40, 40)");
				});
			});
		}
	}

	// An arbitrary saturated band is what core's cream is for, and the colour is the user's choice —
	// so unlike the themed band, this text must NOT follow the theme. Asserted across the two rather
	// than against a literal: in the dark theme the ink IS that cream, and a per-theme check there
	// would pass whether the override reached the coloured header or not.
	for (const surface of SURFACES) {
		it(`leaves a folder given its own colour to core (${surface.name})`, () => {
			const textIn = (theme) => rendered.get(key(surface.name, theme)).get("coloured").get("color");
			expect(textIn("light")).toBe(textIn("dark"));

			const themed = (theme) => rendered.get(key(surface.name, theme)).get("name").get("color");
			expect(themed("light")).not.toBe(themed("dark"));
		});
	}
});
