// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { readFileSync, globSync } from "fs";
import path from "path";
import { renderPartial } from "../fakes/renderTemplate.js";
import { STONETOP_PARTIALS } from "../../src/handlebars/partials.js";
import { createStonetopSteadingSheetClass } from "../../src/actors/steading/StonetopSteadingSheet.js";
import { createStonetopCharacterSheetClass } from "../../src/actors/character/StonetopCharacterSheet.js";
import { createStonetopNpcSheetClass } from "../../src/actors/npc/StonetopNpcSheet.js";
import { stonetopActorSheetBase } from "../fakes/foundry/stonetopActorSheetBase.js";
import { steadingChangeHandlers } from "../../src/actors/steading/steadingChangeHandlers.js";
import { characterChangeHandlers } from "../../src/actors/character/characterChangeHandlers.js";
import { moveRowChangeHandlers } from "../../src/actors/moveRowHandlers.js";
import { tagChipChangeHandlers } from "../../src/actors/tagChips.js";
import { ChoiceGroupWiring } from "../../src/utils/ChoiceGroupWiring.js";

// The actor templates and the actor sheets share a vocabulary of `data-action` /
// `data-change-action` names. A name emitted with nothing behind it is silent in play except for a
// console warning; neither shows up in a test that hand-writes its own markup.
//
// Two passes, because neither is a superset of the other:
//
//  - TEXT over every actor template file catches names inside {{#each}}/{{#if}} blocks that an empty
//    render context never reaches. This is what catches a handler deleted out from under a control.
//  - RENDER catches names a partial receives as a PARAMETER and stamps dynamically — e.g.
//    follower-card.hbs passes `changeAction="followerArmor"` into a sub-partial that emits
//    `data-change-action="{{changeAction}}"`, which no text scan for a literal attribute can see.
//
// Item sheets are out of scope: they carry their own actions (`flipPreview`, …) and their own bases.

const spy = () => new Proxy({}, { get: (t, p) => t[p] ??= vi.fn() });

const isActorTemplate = p => p.includes("templates/actor/");

function namesIn(html, attr) {
	const holder = document.createElement("div");
	holder.innerHTML = html;
	return [...holder.querySelectorAll(`[${attr}]`)]
		.map(el => el.getAttribute(attr))
		.filter(n => /^[a-zA-Z]+$/.test(n)); // skip an unresolved {{placeholder}}
}

function stampedNames(attr) {
	const names = new Set();

	for (const file of globSync("templates/actor/**/*.hbs", { cwd: process.cwd() })) {
		const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
		for (const m of source.matchAll(new RegExp(`${attr}="([a-zA-Z]+)"`, "g"))) names.add(m[1]);
	}

	for (const [name, servedPath] of Object.entries(STONETOP_PARTIALS)) {
		if (!isActorTemplate(servedPath)) continue;
		for (const n of namesIn(renderPartial(name, {}), attr)) names.add(n);
	}
	return names;
}

// Dispatched by core, not by us: `tab` from ApplicationV2, `editImage` from DocumentSheetV2
// (FoundryVTT 13.351, client/applications/api/document-sheet.mjs:56).
const CORE_ACTIONS = new Set(["tab", "editImage"]);

describe("actor templates ↔ sheet handler vocabulary", () => {
	const changeStamped = stampedNames("data-change-action");
	const actionStamped = stampedNames("data-action");

	it("finds enough stamped names to be a meaningful check", () => {
		// Guards the check itself: a scan that found nothing would pass every assertion below.
		expect(changeStamped.size).toBeGreaterThan(20);
		expect(actionStamped.size).toBeGreaterThan(15);
	});

	// The render pass is what sees these; a literal-attribute text scan cannot.
	it("sees the names a partial receives as a parameter and stamps dynamically", () => {
		expect(changeStamped.has("followerArmor")).toBe(true);
		expect(changeStamped.has("followerInstinct")).toBe(true);
	});

	it("every data-change-action an actor template emits is handled by some actor sheet", () => {
		const handled = new Set([
			...Object.keys(steadingChangeHandlers(spy(), { availableSteadfasts: () => [] })),
			...Object.keys(characterChangeHandlers(spy())),
			...Object.keys(moveRowChangeHandlers(spy())),
			...Object.keys(tagChipChangeHandlers(spy())),
			...ChoiceGroupWiring.CHANGE_ACTIONS,
		]);

		expect([...changeStamped].filter(n => !handled.has(n))).toEqual([]);
	});

	it("every data-action an actor template emits is registered by some actor sheet", () => {
		const registered = new Set([
			...CORE_ACTIONS,
			...Object.keys(createStonetopCharacterSheetClass(stonetopActorSheetBase()).DEFAULT_OPTIONS.actions ?? {}),
			...Object.keys(createStonetopSteadingSheetClass(stonetopActorSheetBase()).DEFAULT_OPTIONS.actions ?? {}),
			...Object.keys(createStonetopNpcSheetClass(stonetopActorSheetBase()).DEFAULT_OPTIONS.actions ?? {}),
		]);

		expect([...actionStamped].filter(n => !registered.has(n))).toEqual([]);
	});
});
