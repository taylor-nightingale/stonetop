// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isBareRollMessage, inlineRollCard, onRenderRollMessage } from "../../src/chat/inlineRollCard.js";
import { FakeDiceTerm } from "../fakes/foundry/FakeDiceTerm.js";
import { renderTemplate as renderRealTemplate } from "../fakes/renderTemplate.js";

// `[[/r 1d6]]` in a move's text posts CORE's roll template — a grey formula bar over a grey total bar
// — beside our own cards. Same act, three presentations in one log. These prove the redraw goes
// through the same view model and the same template as every other card, and that it leaves alone
// anything that already decided how its rolls look.

const roll = (formula, values, total, faces = 6) => ({
	formula, total, dice: [FakeDiceTerm.kept(values, faces)],
});

function message({ rolls = [roll("1d6", [6], 6)], flavor = "" } = {}) {
	return { rolls, flavor };
}

function chatNode(inner) {
	const root = document.createElement("li");
	root.innerHTML = `<div class="message-content">${inner}</div>`;
	return root;
}

const CORE_ROLL = `<div class="dice-roll"><div class="dice-result">
	<div class="dice-formula">1d6</div><h4 class="dice-total">6</h4></div></div>`;

// -- what it will and will not touch -------------------------------------------

describe("isBareRollMessage", () => {
	it("recognises core's own roll message", () => {
		expect(isBareRollMessage(message(), chatNode(CORE_ROLL))).toBe(true);
	});

	it("leaves a message that carries no roll alone", () => {
		expect(isBareRollMessage({ rolls: [] }, chatNode(CORE_ROLL))).toBe(false);
	});

	// Our own cards render their dice themselves, and go through this hook too.
	it("leaves a card that is already ours alone", () => {
		const ours = `<h3 class="stonetop-roll-title">Aid</h3><div class="stonetop-roll-line"></div>`;
		expect(isBareRollMessage(message(), chatNode(ours))).toBe(false);
	});

	// A system or module that renders its own card has already decided how its rolls look — the roll
	// sits among other content, so the content is not the roll.
	it("leaves a card that renders more than the roll alone", () => {
		expect(isBareRollMessage(message(), chatNode(`<p>Fireball</p>${CORE_ROLL}`))).toBe(false);
	});

	// Two rolls in one message is a card of someone's own making, whatever it looks like.
	it("leaves a message of several rolls alone", () => {
		const two = message({ rolls: [roll("1d6", [6], 6), roll("1d8", [3], 3, 8)] });
		expect(isBareRollMessage(two, chatNode(CORE_ROLL))).toBe(false);
	});

	it("leaves a message with no content element alone", () => {
		expect(isBareRollMessage(message(), document.createElement("li"))).toBe(false);
	});
});

// -- the card it becomes -------------------------------------------------------

describe("inlineRollCard", () => {
	const localize = k => k;

	// Nothing else to call it by, and a receipt line under the total would say it twice.
	it("titles a bare roll by its formula, and states no formula line", () => {
		const card = inlineRollCard(message(), localize);
		expect(card.name).toBe("1d6");
		expect(card.dice.formula).toBeNull();
	});

	// `[[/r 1d6]]{Damage}` — the flavour is the name, so the formula drops to the receipt.
	it("titles a flavoured roll by its flavour, and keeps the formula as the receipt", () => {
		const card = inlineRollCard(message({ flavor: "Damage" }), localize);
		expect(card.name).toBe("Damage");
		expect(card.dice.formula).toBe("1d6");
	});

	it("draws the dice through the same view model every other card uses", () => {
		const card = inlineRollCard(message(), localize);
		expect(card.dice.rolls.map(r => r.result)).toEqual(["6"]);
		expect(card.dice.rolls[0].classes).toContain("d6");
	});

	it("states what a modified formula added", () => {
		const card = inlineRollCard(message({ rolls: [roll("1d6 + 2", [4], 6)] }), localize);
		expect(card.dice.mod).toBe("+2");
	});

	// A bare 1d6 named no modifier, so it prints none.
	it("states no modifier for an unmodified roll", () => {
		expect(inlineRollCard(message(), localize).dice.mod).toBeNull();
	});
});

// -- redrawn in place ----------------------------------------------------------

describe("onRenderRollMessage", () => {
	beforeEach(() => {
		vi.stubGlobal("game", { i18n: { localize: k => k } });
		foundry.applications.handlebars.renderTemplate = renderRealTemplate;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		foundry.applications.handlebars.renderTemplate = async () => "";
	});

	it("replaces core's roll markup with a Stonetop card", async () => {
		const root = chatNode(CORE_ROLL);
		await onRenderRollMessage(message({ flavor: "Damage" }), root);
		expect(root.querySelector(".dice-formula")).toBeNull();
		expect(root.querySelector(".stonetop-roll-title").textContent.trim()).toBe("Damage");
		expect(root.querySelector(".stonetop-roll-total").textContent.trim()).toBe("6");
	});

	// Core's own class names, so core's own die faces draw them.
	it("draws the dice with Foundry's own markup", async () => {
		const root = chatNode(CORE_ROLL);
		await onRenderRollMessage(message(), root);
		const die = root.querySelector(".stonetop-roll-dice .dice-rolls .roll");
		expect(die.textContent.trim()).toBe("6");
		expect(die.classList.contains("d6")).toBe(true);
	});

	it("leaves a message it does not own untouched", async () => {
		const root = chatNode(`<p>Fireball</p>${CORE_ROLL}`);
		await onRenderRollMessage(message(), root);
		expect(root.querySelector(".dice-formula")).not.toBeNull();
	});
});
