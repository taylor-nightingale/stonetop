import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";

// The move-roll card is the one Stonetop surface that renders OUTSIDE a .stonetop root: core drops
// the content into a chat message, which hard-codes `themed theme-light` on the log whatever the
// client's theme is. So every rule the card relies on has to reach it from a selector that names
// the chat context, and the only way to know it did is to render it. A text scan of the stylesheet
// cannot tell a rule that applies from one scoped to a root the card never has.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
]);

const TIERS = [
	{ key: "success", label: "Strong Hit!" },
	{ key: "partial", label: "Weak Hit" },
	{ key: "failure", label: "Miss" }
];

// The card as move-roll.hbs emits it, inside core's exact chat nesting. A long move name is used on
// purpose: "the title wraps instead of the outcome getting lost at the end of it" is the change.
const card = tier => `
	<li class="chat-message message flexcol" id="p-${tier.key}-msg">
	  <div class="message-content">
	    <h3 class="stonetop-roll-title" id="p-${tier.key}-title">
	      <img class="stonetop-move-icon" id="p-${tier.key}-icon" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">
	      Amulets &amp; Talismans
	    </h3>
	    <div class="stonetop-roll-line stonetop-roll-line--${tier.key}" id="p-${tier.key}-line">
	      <span class="stonetop-roll-total" id="p-${tier.key}-total">9</span>
	      <div class="stonetop-roll-readout">
	        <span class="stonetop-roll-outcome" id="p-${tier.key}-outcome">${tier.label}</span>
	        <div class="stonetop-roll-dice" id="p-${tier.key}-dice">
	          <span class="stonetop-dice-group"><span class="stonetop-die" id="p-${tier.key}-die">6</span><span class="stonetop-die">3</span></span>
	          <span class="stonetop-roll-mod">+0 (INT)</span>
	        </div>
	      </div>
	    </div>
	    <div class="stonetop-move-result stonetop-move-result--${tier.key}" id="p-${tier.key}-result">They suffer only half the damage or effect.</div>
	    <div class="stonetop-move-description stonetop-move-description--secondary" id="p-${tier.key}-desc">When you craft a protective charm for someone, spend 1 Stock.</div>
	  </div>
	</li>`;

const FIXTURE = `
<section class="chat-sidebar sidebar-tab">
  <div class="chat-scroll">
    <ol class="chat-log plain themed theme-light" id="p-chat-log">
${TIERS.map(card).join("\n")}
    </ol>
  </div>
</section>`;

const PROBES = {};
for (const { key } of TIERS) {
	PROBES[`${key}Msg`]     = { selector: `#p-${key}-msg`,     properties: ["background-color"] };
	PROBES[`${key}Outcome`] = { selector: `#p-${key}-outcome`, properties: ["color", "font-size", "font-weight"] };
	PROBES[`${key}Total`]   = { selector: `#p-${key}-total`,   properties: ["color", "border-top-color", "font-size"] };
	PROBES[`${key}Result`]  = { selector: `#p-${key}-result`,  properties: ["color", "border-left-color"] };
	PROBES[`${key}Dice`]    = { selector: `#p-${key}-dice`,    properties: ["font-size"] };
	PROBES[`${key}Desc`]    = { selector: `#p-${key}-desc`,    properties: ["color", "font-size"] };
	PROBES[`${key}Icon`]    = { selector: `#p-${key}-icon`,    properties: ["width", "height"] };
}

const THEMES = [
	{ name: "light", bodyClass: "game vtt theme-light" },
	{ name: "dark",  bodyClass: "game vtt theme-dark" }
];

const px = value => parseFloat(value);

describe.skipIf(!canProbe())("move-roll card, rendered", () => {
	const rendered = new Map();

	beforeAll(() => {
		for (const theme of THEMES) {
			rendered.set(theme.name, probe.render({ bodyHtml: FIXTURE, bodyClass: theme.bodyClass, probes: PROBES }));
		}
	}, 60000);

	for (const theme of THEMES) {
		describe(`${theme.name} theme`, () => {
			const results = () => rendered.get(theme.name);

			// The whole point of the badge: three outcomes have to be told apart at a glance.
			it("gives each tier its own outcome colour", () => {
				const colours = TIERS.map(t => results().get(`${t.key}Outcome`).get("color"));
				expect(new Set(colours).size).toBe(TIERS.length);
			});

			for (const { key, label } of TIERS) {
				// One --tier-color drives all three. If the relay fails to reach any of them, that
				// element falls back to inherited ink and the tier stops reading as a tier.
				it(`paints total, badge and result rule from one tier colour (${label})`, () => {
					const r = results();
					const outcome = r.get(`${key}Outcome`).get("color");
					expect(r.get(`${key}Total`).get("color")).toBe(outcome);
					expect(r.get(`${key}Total`).get("border-top-color")).toBe(outcome);
					expect(r.get(`${key}Result`).get("color")).toBe(outcome);
					expect(r.get(`${key}Result`).get("border-left-color")).toBe(outcome);
				});

				it(`keeps the ${label} badge legible on the message background`, () => {
					const r = results();
					const ink = CssColor.parse(r.get(`${key}Outcome`).get("color"));
					const paper = CssColor.parse(r.get(`${key}Msg`).get("background-color"));
					expect(ink).not.toBeNull();
					expect(paper).not.toBeNull();
					expect(ink.contrastWith(paper)).toBeGreaterThanOrEqual(3);
				});
			}

			// The reading order the redesign is for: total loudest, then the outcome, then the dice
			// that produced it, then the move's text as reference under the answer.
			it("sizes total > outcome > dice", () => {
				const r = results();
				expect(px(r.get("partialTotal").get("font-size")))
					.toBeGreaterThan(px(r.get("partialOutcome").get("font-size")));
				expect(px(r.get("partialOutcome").get("font-size")))
					.toBeGreaterThan(px(r.get("partialDice").get("font-size")));
			});

			it("sets the move's full text below the outcome in the hierarchy", () => {
				const r = results();
				expect(px(r.get("partialDesc").get("font-size")))
					.toBeLessThan(px(r.get("partialOutcome").get("font-size")));
				expect(r.get("partialDesc").get("color"))
					.not.toBe(r.get("partialOutcome").get("color"));
			});

			// `.stonetop .stonetop-move-icon` never matched here — a chat message has no .stonetop
			// ancestor — so the card's icon rendered at the image's natural size.
			it("constrains the move icon, which sits outside any .stonetop root", () => {
				const icon = results().get("partialIcon");
				expect(px(icon.get("width"))).toBe(20);
				expect(px(icon.get("height"))).toBe(20);
			});
		});
	}
});
