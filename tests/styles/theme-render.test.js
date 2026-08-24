import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";

// What the text-parsing tests cannot ask: given core's stylesheet, its cascade layers and ours on
// top, what colour does this element ACTUALLY end up? Every theming bug that reached the user was
// invisible to the other tests in this directory and obvious here.
//
// The invariant is deliberately about the rendered result rather than about which variable we set.
// "--sidebar-folder-color resolves to our accent" was true while folders rendered as bright orange
// bars; "the folder row's text is legible against the folder row's background" was not.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
]);

// A cut-down stand-in for the parts of Foundry's DOM that broke. Class names and nesting mirror what
// core actually emits, because the bugs lived in which element a declaration landed on.
const FIXTURE = `
<div id="interface" class="themed">
  <section class="sidebar-tab directory" id="p-sidebar">
    <ol class="directory-list">
      <li class="folder" id="p-folder"><h3 id="p-folder-name">Armor</h3></li>
      <li class="directory-item entry" id="p-entry">Blodwen</li>
    </ol>
    <input id="p-search" placeholder="Search Items">
  </section>
</div>
<div class="application" id="p-app">
  <section class="window-content">
    <h2 id="p-heading">Settings</h2>
    <p id="p-text">Body text on a sheet.</p>
    <button id="p-button">Save Changes</button>
    <input id="p-input" value="Blodwen">
    <a class="content-link" id="p-link">A linked document</a>
  </section>
</div>
<section class="chat-sidebar sidebar-tab" id="p-chat">
    <ol id="chat-log"><li class="chat-message" id="p-message"><p>A chat message.</p></li></ol>
  </section>
`;

const COLOUR_PROPS = ["color", "background-color"];

const PROBES = {
	body:      { selector: "body",          properties: COLOUR_PROPS },
	sidebar:   { selector: "#p-sidebar",    properties: COLOUR_PROPS },
	folder:    { selector: "#p-folder-name", properties: COLOUR_PROPS },
	entry:     { selector: "#p-entry",      properties: COLOUR_PROPS },
	search:    { selector: "#p-search",     properties: COLOUR_PROPS },
	app:       { selector: "#p-app",        properties: COLOUR_PROPS },
	heading:   { selector: "#p-heading",    properties: COLOUR_PROPS },
	text:      { selector: "#p-text",       properties: COLOUR_PROPS },
	button:    { selector: "#p-button",     properties: COLOUR_PROPS },
	input:     { selector: "#p-input",      properties: COLOUR_PROPS },
	link:      { selector: "#p-link",       properties: COLOUR_PROPS },
	chat:      { selector: "#p-chat",       properties: COLOUR_PROPS },
	message:   { selector: "#p-message",    properties: [...COLOUR_PROPS, "--chat-message-background"] }
};

const THEMES = [
	{ name: "light", bodyClass: "game vtt theme-light", rootAttrs: "" },
	{ name: "dark", bodyClass: "game vtt theme-dark", rootAttrs: "" }
];

// The rendered background of an element, walking up through transparent ancestors the way a reader's
// eye does — a transparent row shows whatever surface is behind it.
function effectiveBackground(results, name, chain) {
	let backdrop = null;
	// Furthest ancestor first, compositing inward, so a translucent surface is measured as seen.
	for (const step of [name, ...chain].reverse()) {
		const layer = CssColor.parse(results.get(step)?.get("background-color") ?? "");
		if (!layer) continue;
		if ((layer.alpha ?? 1) >= 1) backdrop = layer;
		else if (backdrop) backdrop = layer.over(backdrop);
	}
	return backdrop;
}

const BEHIND = {
	folder: ["sidebar", "body"], entry: ["sidebar", "body"], search: ["sidebar", "body"],
	sidebar: ["body"], heading: ["app", "body"], text: ["app", "body"], button: ["app", "body"],
	input: ["app", "body"], link: ["app", "body"], message: ["chat", "body"], chat: ["body"], app: ["body"], body: []
};

describe.runIf(canProbe())("rendered theme", () => {
	for (const theme of THEMES) {
		describe(theme.name, () => {
			// In a hook, not the suite body: runIf still runs the body, and the probe throws with no Foundry.
			let results;
			beforeAll(() => {
				results = probe.render({ bodyHtml: FIXTURE, bodyClass: theme.bodyClass, rootAttrs: theme.rootAttrs, probes: PROBES });
			});

			it.each(Object.keys(PROBES).filter(n => !["app", "chat"].includes(n)))("%s is legible against what is behind it", name => {
				const element = results.get(name);
				expect(element.missing).toBe(false);

				const fg = CssColor.parse(element.get("color"));
				const bg = effectiveBackground(results, name, BEHIND[name] ?? []);
				expect(`${name} foreground parsed: ${Boolean(fg)}`).toBe(`${name} foreground parsed: true`);
				expect(`${name} background found: ${Boolean(bg)}`).toBe(`${name} background found: true`);

				const ratio = fg.over(bg).contrastWith(bg);
				expect(`${name}: ${ratio >= 4.5 ? "legible" : ratio.toFixed(2)}`).toBe(`${name}: legible`);
			});

			// Core backs chat messages with its own parchment image. Ours must win, or every message
			// carries Foundry's paper into a Stonetop theme.
			it("does not leave core's parchment behind chat messages", () => {
				expect(results.get("message").get("--chat-message-background")).not.toMatch(/parchment\.jpg/);
			});

			// `body { color: var(--color-light-3) }` — core reaches straight past the semantic layer
			// into the base ramp. Semantic bridging cannot reach this; repainting the ramp can.
			it("paints body text from the theme, not core's palette default", () => {
				const bodyColour = CssColor.parse(results.get("body").get("color"));
				expect(bodyColour).toBeTruthy();
				expect([bodyColour.r, bodyColour.g, bodyColour.b]).not.toEqual([231, 209, 177]);
			});
		});
	}
});

describe("render probe availability", () => {
	// A silent skip everywhere would let the whole safety net rot unnoticed.
	it("reports whether this machine can run the probe", () => {
		expect(typeof canProbe()).toBe("boolean");
	});
});
