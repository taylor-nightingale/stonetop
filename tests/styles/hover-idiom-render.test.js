import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { RenderProbe, canProbe, pseudoAsClass } from "./RenderProbe.js";
import { CssColor } from "./cssColor.js";

// Core paints `button:hover { color: var(--button-hover-text-color) }`, and both of its theme blocks
// resolve that token to `--color-light-1`. Our palette repaints that ramp to the book's paper and
// parchment-light hands the same value to `--st-paper` — so every button whose background we had
// taken away wrote its label in exactly the colour behind it. Damage, the Outfit tab's add button
// and the collapse caret each disappeared under the pointer, while the buttons that happened to
// declare a colour of their own were spared, which is what made the bug read as arbitrary.
//
// Two claims are worth locking, and only one of them is about the rules we wrote:
//
//   1. No button anywhere can hover into its own background. That is swept from the TEMPLATES, not
//      from a list kept here, so a control added next year is covered without anybody remembering
//      to add it. A text scan of the stylesheet cannot make this claim at all — the failure lives
//      in a token core resolves, with nothing wrong on either side of the cascade on its own.
//
//   2. The controls that carry the house idiom all carry the SAME one. That is what the bug report
//      actually asked for: a rating name that rolls and a stat name that rolls behaved differently,
//      and a steading rating went slate grey on parchment while its character-sheet twin did not.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"),
	sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"),
	sheet("tokens.css"),
	sheet("stonetop.css")
], { transformCss: pseudoAsClass("hover") });

/** Headless Chrome has no cursor, so `:hover` is rewritten to a class the fixture can carry. */
const HOVER = "is-hover";

/** The two themes, by the body class core stamps and the sheet-root class our theme files key on. */
const THEMES = [
	{ name: "light", bodyClass: "theme-light", rootClass: "themed theme-light" },
	{ name: "dark", bodyClass: "theme-dark", rootClass: "themed theme-dark" }
];

/**
 * Sheet roots a control can appear under. A partial is shared between sheets, so a button is swept
 * under each: in a root whose rules do not reach it, it simply keeps core's own chrome, which is a
 * correct pairing and passes. The failure this catches is a rule that strips the background without
 * saying what the text should then be, and that rule is always keyed on one of these.
 */
const ROOTS = ["character", "steading", "item", "steadfast"];

/** Class lists the templates put on a `<button>`, minus the ones a helper fills in at render time. */
function buttonClassLists() {
	const found = new Set();
	const walk = dir => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.endsWith(".hbs")) {
				const text = fs.readFileSync(full, "utf8");
				for (const m of text.matchAll(/<button\b[^>]*?\bclass="([^"]*)"/g)) {
					const classes = m[1].split(/\s+/).filter(c => c && !c.includes("{{") && !c.includes("}}"));
					if (classes.length) found.add(classes.join(" "));
				}
			}
		}
	};
	walk(path.resolve("templates"));
	return [...found].sort();
}

/** A CSS id for a class list, so a probe can address one button among a hundred. */
const idFor = classList => "b-" + classList.replace(/[^a-z0-9]+/gi, "-");

/**
 * What the reader actually sees behind the label: the button's own background composited over the
 * paper, since `background: transparent` is how most of these controls give up their chrome.
 */
function effectiveBackdrop(own, paper) {
	const behind = CssColor.parse(paper);
	const front = CssColor.parse(own);
	if (!behind) return null;
	if (!front || front.alpha === 0) return behind;
	return front.alpha < 1 ? front.over(behind) : front;
}

describe.skipIf(!canProbe())("the hover idiom", () => {
	describe("no control hovers into its own background", () => {
		const classLists = buttonClassLists();
		const results = new Map();

		beforeAll(() => {
			for (const theme of THEMES) {
				for (const root of ROOTS) {
					const body = `
<div class="application stonetop sheet ${root} ${theme.rootClass}"><div class="window-content">
  ${classLists.map(c => `<div><button type="button" id="${idFor(c)}" class="${c} ${HOVER}">Label</button></div>`).join("\n  ")}
</div></div>`;
					const probes = Object.fromEntries(classLists.map(c => [c, {
						selector: `#${idFor(c)}`,
						properties: ["color", "background-color", "--st-paper"]
					}]));
					results.set(`${theme.name}/${root}`, probe.render({ bodyHtml: body, bodyClass: theme.bodyClass, probes }));
				}
			}
		}, 120_000);

		// One case per theme × root, rather than one per button: a single sweep renders them all, and
		// naming every offender in one failure is what makes a cascade regression readable.
		for (const theme of THEMES) {
			for (const root of ROOTS) {
				it(`${theme.name} theme, ${root} sheet`, () => {
					const rendered = results.get(`${theme.name}/${root}`);
					const unreadable = [];
					for (const [classList, el] of rendered) {
						const ink = CssColor.parse(el.get("color"));
						const paper = effectiveBackdrop(el.get("background-color"), el.get("--st-paper"));
						if (!ink || !paper) continue;
						const ratio = ink.over(paper).contrastWith(paper);
						if (ratio < 4.5) unreadable.push(`${classList} — ${ratio.toFixed(2)}:1 (${el.get("color")} on ${el.get("background-color")})`);
					}
					expect(unreadable, `hovered label unreadable against its own background:\n  ${unreadable.join("\n  ")}`).toEqual([]);
				});
			}
		}
	});

	describe("every clickable word carries the same treatment", () => {
		// The markup each control is written with, because the rules under test are selector-specific
		// and several of them are keyed on an ancestor. [label, root, markup].
		const WORDS = [
			["a character stat name", "character",
				`<div class="stonetop-stat"><span class="stonetop-stat-roll rollable ${HOVER}" id="probe">STR</span></div>`],
			["the damage die label", "character",
				`<div class="stonetop-resource stonetop-resource--small"><button type="button" id="probe" class="stonetop-resource__label stonetop-damage-roll rollable ${HOVER}">Damage</button></div>`],
			["the Outfit tab's add button", "character",
				`<button type="button" id="probe" class="stonetop-inv-add-btn ${HOVER}">+ Add</button>`],
			["an origin name", "character",
				`<button type="button" id="probe" class="stonetop-origin-name ${HOVER}">Wanderer</button>`],
			["an open-item name", "character",
				`<button type="button" id="probe" class="stonetop-item-name stonetop-item-name--open ${HOVER}">Battery</button>`],
			["a move row's name", "character",
				`<button type="button" class="stonetop-move-disclosure ${HOVER}"><span class="stonetop-move-disclosure-name" id="probe">Defy Danger</span></button>`],
			["a steading rating name", "steading",
				`<span class="steading-tile-label"><button type="button" id="probe" class="steading-stat-roll rollable ${HOVER}">Prosperity</button></span>`],
			["a folk trait", "steading",
				`<button type="button" id="probe" class="steading-folk-entry ${HOVER}">cheery</button>`],
			["a folk list toggle", "steading",
				`<button type="button" id="probe" class="steading-folk-list-toggle ${HOVER}">Residents</button>`],
			["an unlink control", "steading",
				`<button type="button" id="probe" class="stonetop-person-unlink ${HOVER}">unlink</button>`],
			["a list's add affordance", "steading",
				`<button type="button" id="probe" class="stonetop-list-add ${HOVER}">Add a resident</button>`],
			["an insert sheet's move", "item",
				`<li class="stonetop-insert-sheet-move"><span class="insert-move-open ${HOVER}" id="probe">Volley</span></li>`],
			["a playbook reference row", "item",
				`<li class="playbook-ref-row"><span class="playbook-ref-open ${HOVER}" id="probe">Blessed</span></li>`]
		];

		for (const theme of THEMES) {
			for (const [label, root, markup] of WORDS) {
				it(`${label}, ${theme.name} theme`, () => {
					const rendered = probe.render({
						bodyHtml: `<div class="application stonetop sheet ${root} ${theme.rootClass}"><div class="window-content">${markup}</div></div>`,
						bodyClass: theme.bodyClass,
						probes: { target: { selector: "#probe", properties: ["color", "text-decoration-line", "--st-accent", "--st-paper"] } }
					});
					const el = rendered.get("target");
					const accent = CssColor.parse(el.get("--st-accent"));
					const ink = CssColor.parse(el.get("color"));

					expect(ink, `${label} did not take the accent on hover`).not.toBeNull();
					expect([ink.r, ink.g, ink.b]).toEqual([accent.r, accent.g, accent.b]);
					expect(el.get("text-decoration-line")).toBe("underline");
				});
			}
		}
	});

	// The house idiom's two deliberate exceptions, asserted so that they stay deliberate rather than
	// drifting back into "whatever the cascade happened to leave".
	describe("glyph-only controls take the accent without a rule", () => {
		for (const [label, root, markup] of [
			["the collapse caret", "character", `<button type="button" id="probe" class="stonetop-top-toggle ${HOVER}"><i class="fas fa-chevron-up"></i></button>`],
			["a move's send-to-chat", "character", `<button type="button" id="probe" class="stonetop-move-chat ${HOVER}"><i class="fas fa-comment"></i></button>`]
		]) {
			it(label, () => {
				const rendered = probe.render({
					bodyHtml: `<div class="application stonetop sheet ${root} themed theme-light"><div class="window-content">${markup}</div></div>`,
					bodyClass: "theme-light",
					probes: { target: { selector: "#probe", properties: ["color", "text-decoration-line", "--st-accent"] } }
				});
				const el = rendered.get("target");
				const accent = CssColor.parse(el.get("--st-accent"));
				const ink = CssColor.parse(el.get("color"));
				expect([ink.r, ink.g, ink.b]).toEqual([accent.r, accent.g, accent.b]);
				expect(el.get("text-decoration-line")).toBe("none");
			});
		}
	});

	it("icon buttons stay on opacity and are never tinted", () => {
		const rendered = probe.render({
			bodyHtml: `<div class="application stonetop sheet character themed theme-light"><div class="window-content">
				<div class="stonetop-item" style="color: rgb(1, 2, 3)">
					<button type="button" id="probe" class="stonetop-icon-btn ${HOVER}"><i class="fas fa-trash"></i></button>
				</div>
			</div></div>`,
			bodyClass: "theme-light",
			probes: { target: { selector: "#probe", properties: ["color", "opacity"] } }
		});
		const el = rendered.get("target");
		// Inherited from the row, not repainted: the accent belongs to words, and core's own hover
		// colour is the paper the glyph sits on.
		expect(el.get("color")).toBe("rgb(1, 2, 3)");
		expect(el.get("opacity")).toBe("1");
	});
});
