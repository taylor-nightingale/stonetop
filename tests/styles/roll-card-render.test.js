import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";
import { renderTemplate } from "../fakes/renderTemplate.js";
import { RollDisplay } from "../../src/utils/rollDisplay.js";
import { AppliedStepRoll } from "../../src/model/data/steading/AppliedStepRoll.js";
import { FakeDiceTerm } from "../fakes/foundry/FakeDiceTerm.js";

// Game text reaches the card as RichText, which the async enrich pass fills in; a probe renders
// synchronously, so the raw text stands in for the enriched html.
const staticRich = text => ({ raw: text, render: () => text });

const CARD = "systems/stonetop/templates/chat/move-roll.hbs";

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

// The card as move-roll.hbs emits it, inside core's exact chat nesting — rendered from the REAL
// template and view model, not hand-written: a fixture that describes markup drifts from it. A long
// move name is used on purpose: "the title wraps instead of the outcome getting lost at the end of
// it" is the change.
const display = new RollDisplay(k => k);

const tieredCard = tier => renderTemplate("systems/stonetop/templates/chat/move-roll.hbs", {
	name: "Amulets & Talismans",
	dice: display.build(
		{ dice: [FakeDiceTerm.kept([6, 3])], total: 9 },
		{ rollMode: "normal", statKey: "int" }),
	outcome: { key: tier.key, label: tier.label },
	resultText: staticRich("They suffer only half the damage or effect."),
	description: staticRich("When you craft a protective charm for someone, spend 1 Stock."),
});

const card = tier => `
	<li class="chat-message message flexcol" id="p-${tier.key}-msg">
	  <div class="message-content" id="p-${tier.key}-content">
${tieredCard(tier)}
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
	const within = sel => `#p-${key}-msg ${sel}`;
	PROBES[`${key}Msg`]     = { selector: `#p-${key}-msg`,                 properties: ["background-color"] };
	PROBES[`${key}Outcome`] = { selector: within(".stonetop-roll-outcome"), properties: ["color", "font-size", "font-weight"] };
	PROBES[`${key}Total`]   = { selector: within(".stonetop-roll-total"),   properties: ["color", "border-top-color", "border-top-width", "background-color", "font-size"] };
	PROBES[`${key}Result`]  = { selector: within(".stonetop-move-result"),  properties: ["color", "border-left-color"] };
	PROBES[`${key}Dice`]    = { selector: within(".stonetop-roll-dice"),    properties: ["font-size"] };
	PROBES[`${key}Desc`]    = { selector: within(".stonetop-move-description"), properties: ["color", "font-size"] };
	PROBES[`${key}Die`]     = { selector: within(".dice-rolls .roll"),      properties: ["background-image", "min-width", "color"] };
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

		});
	}
});


// One look for every roll in the log. Three controls post dice — a move, a season step, and an
// inline [[/r 1d6]] in a move's text — and they used to arrive as three different cards: an outlined
// tier plate, a dark filled chip that read as an oversized die, and core's grey bars. All three are
// rendered together here, from the REAL template and view model, and measured against each other.
const KINDS = [
	{
		id: "move",
		card: () => renderTemplate(CARD, {
			name: "Amulets & Talismans",
			dice: display.build({ dice: [FakeDiceTerm.kept([6, 3])], total: 11 }, { statKey: "int" }),
			outcome: { key: "partial", label: "Weak Hit" },
		}),
	},
	{
		// The card in the bug report: one d4 came up 1 against a Population of 0.
		id: "season",
		card: () => renderTemplate(CARD, {
			name: "Winter — Consumption",
			dice: display.build({ dice: [FakeDiceTerm.kept([1], 4)], total: 1 },
				{ formula: "1d4 + Population" }),
			applied: new AppliedStepRoll({ total: 6, due: 5, from: 8, to: 3 }),
		}),
	},
	{
		// What the hook redraws core's own roll message into.
		id: "inline",
		card: () => renderTemplate(CARD, {
			name: "1d6",
			dice: display.build({ dice: [FakeDiceTerm.kept([6])], total: 6 }, {}),
		}),
	},
];

const KIND_FIXTURE = `
<section class="chat-sidebar sidebar-tab">
  <div class="chat-scroll">
    <ol class="chat-log plain themed theme-light">
${KINDS.map(k => `
      <li class="chat-message message flexcol" id="p-${k.id}-msg">
        <div class="message-content">${k.card()}</div>
      </li>`).join("\n")}
    </ol>
  </div>
</section>`;

const KIND_PROBES = {};
for (const { id } of KINDS) {
	const within = sel => `#p-${id}-msg ${sel}`;
	KIND_PROBES[`${id}Msg`]     = { selector: `#p-${id}-msg`,               properties: ["background-color"] };
	KIND_PROBES[`${id}Total`]   = { selector: within(".stonetop-roll-total"), properties: ["color", "background-color", "background-image", "border-top-width", "font-size", "border-top-style"] };
	KIND_PROBES[`${id}Die`]     = { selector: within(".dice-rolls .roll"),    properties: ["background-image", "min-width", "color", "font-size"] };
}
KIND_PROBES.formula = { selector: "#p-season-msg .stonetop-roll-formula", properties: ["color", "font-size"] };
KIND_PROBES.title   = { selector: "#p-season-msg .stonetop-roll-title",   properties: ["font-size"] };
KIND_PROBES.mod     = { selector: "#p-season-msg .stonetop-roll-mod",     properties: ["font-weight"] };
KIND_PROBES.applied = { selector: "#p-season-msg .stonetop-applied-what", properties: ["color", "font-size"] };
KIND_PROBES.rolled  = { selector: "#p-season-msg .stonetop-applied-rolled", properties: ["color"] };
KIND_PROBES.discarded = { selector: "#p-move-msg .dice-rolls .roll", properties: ["filter"] };

describe.skipIf(!canProbe())("every kind of roll card, side by side", () => {
	const rendered = new Map();

	beforeAll(() => {
		for (const theme of THEMES) {
			rendered.set(theme.name,
				probe.render({ bodyHtml: KIND_FIXTURE, bodyClass: theme.bodyClass, probes: KIND_PROBES }));
		}
	}, 60000);

	// The modifier the whole change is for: a die beside a total it does not add up to, with nothing
	// to account for the difference, is not a receipt but a puzzle. A named formula states it at 0.
	it("states what the dice did not account for", () => {
		expect(KIND_FIXTURE).toContain(">+0<");
		expect(KIND_FIXTURE).toContain(">+2 (INT)<");
	});

	it("names the formula the sheet offered", () => {
		expect(KIND_FIXTURE).toContain("1d4 + Population");
	});

	// The one thing the season card never said: the roll moved Surplus, and by how much.
	it("says what the roll did to Surplus, in the sheet's own words", () => {
		expect(KIND_FIXTURE).toContain("Consumed 5 Surplus (8 → 3)");
		expect(KIND_FIXTURE).toContain("6 was rolled");
	});

	// Foundry's own dice, by their size — the card used to draw flat chips that named nothing.
	it("draws each die on Foundry's face for its size", () => {
		expect(KIND_FIXTURE).toContain("roll die d4");
		expect(KIND_FIXTURE).toContain("roll die d6");
	});

	for (const theme of THEMES) {
		describe(`${theme.name} theme`, () => {
			const results = () => rendered.get(theme.name);
			const totals  = () => KINDS.map(k => results().get(`${k.id}Total`));

			// The ask, measured: a move, a season step and an inline roll differ in what they MEAN,
			// not in how a total looks.
			it("states every total on the same plate", () => {
				expect(new Set(totals().map(t => t.get("font-size"))).size).toBe(1);
				expect(new Set(totals().map(t => t.get("border-top-width"))).size).toBe(1);
				expect(new Set(totals().map(t => t.get("border-top-style"))).size).toBe(1);
			});

			it("draws every die the same size", () => {
				const dice = KINDS.map(k => results().get(`${k.id}Die`));
				expect(new Set(dice.map(d => d.get("min-width"))).size).toBe(1);
			});

			// The confusion the filled chip caused: a total and a die that read as one object at two
			// sizes. The dice sit on Foundry's die faces; the total sits on a plate and never does.
			it("never draws a total as another, bigger die", () => {
				for (const total of totals()) expect(total.get("background-image")).toBe("none");
				expect(results().get("seasonDie").get("background-image")).toContain("d4-grey.svg");
				expect(results().get("moveDie").get("background-image")).toContain("d6-grey.svg");
			});

			// Stated in ink, not the soft grey that made an untiered plate read as disabled.
			for (const { id } of KINDS) {
				it(`keeps the ${id} card's total legible on its message`, () => {
					const ink   = CssColor.parse(results().get(`${id}Total`).get("color"));
					const paper = CssColor.parse(results().get(`${id}Msg`).get("background-color"));
					expect(ink.contrastWith(paper)).toBeGreaterThanOrEqual(4.5);
				});
			}

			// Total loudest, then the formula in the slot a tiered card gives its outcome.
			it("sizes the total above the formula line", () => {
				expect(px(results().get("seasonTotal").get("font-size")))
					.toBeGreaterThan(px(results().get("formula").get("font-size")));
			});

			// Core's chat h3 set a seven-word title at display size, across two lines.
			it("sets the title below the total in the hierarchy", () => {
				expect(px(results().get("title").get("font-size")))
					.toBeLessThan(px(results().get("seasonTotal").get("font-size")));
			});

			// The applied line is a shared partial: styled on the steading sheet, and the rules have
			// to reach it here too, in a chat log force-lit whatever the client's theme.
			it("keeps what the roll did legible on the message", () => {
				const ink   = CssColor.parse(results().get("applied").get("color"));
				const paper = CssColor.parse(results().get("seasonMsg").get("background-color"));
				expect(ink.contrastWith(paper)).toBeGreaterThanOrEqual(4.5);
			});

			// "6 was rolled" against 5 paid — set below the statement it qualifies, not level with it.
			it("sets what was rolled quieter than what was paid", () => {
				expect(results().get("rolled").get("color"))
					.not.toBe(results().get("applied").get("color"));
			});
		});
	}
});
