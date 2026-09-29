// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { buildMoveSnapshot } from "../../src/actors/embeddedMoves.js";
import { MovePhaseGroup } from "../../src/model/snapshot/character/MovePhaseGroup.js";
import { ResourceController } from "../../src/actors/character/ResourceController.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

const resources = new ResourceController(new FakeCharacterActorBuilder().build(), "moveResources");

const move = (system, { id = null, name = "Defend" } = {}) =>
	buildMoveSnapshot({ _id: id, name, system: { slug: name.toLowerCase().replace(/ /g, "-"), ...system } },
		"basic", false, resources);

const DEFEND = {
	rollStat: "con",
	description: "When you **_stand in defense of a person, item, or location_**, roll +CON.",
	moveResults: { success: { label: "10+", value: "hold 3" }, partial: { label: "7-9", value: "hold 1" } },
	resource: { max: 4 },
};

const render = (moves, params = {}) => {
	const host = document.createElement("div");
	host.innerHTML = renderPartial("stonetop.character-move-list", {
		moves, categoryKey: "basic", categoryLabel: "Basic Moves", sheetIdPrefix: "s1", ...params,
	});
	return host;
};

const rowOf = (host, slug) => host.querySelector(`li[data-slug="${slug}"]`);

describe("a character's move row — rolling", () => {
	// The die and the name are one control, so the name is what a reader hits to roll.
	it("makes the die and the name one roll button", () => {
		const button = rowOf(render([move(DEFEND)]), "defend").querySelector(".stonetop-mrow-roll");
		expect(button.matches("button.rollable[data-roll='con']")).toBe(true);
		expect(button.dataset.moveSlug).toBe("defend");
		expect(button.querySelector(".stonetop-mrow-die")).not.toBeNull();
		expect(button.querySelector(".stonetop-mrow-title").textContent).toBe("Defend");
	});

	it("says what the roll adds", () => {
		expect(rowOf(render([move(DEFEND)]), "defend").querySelector(".stonetop-mrow-stat").textContent.trim())
			.toBe(move(DEFEND).rollLabel);
	});

	it("marks an owned move so the roll finds the character's own copy", () => {
		const row = rowOf(render([move(DEFEND, { id: "owned-1" })]), "defend");
		expect(row.classList.contains("item")).toBe(true);
		expect(row.dataset.itemId).toBe("owned-1");
	});

	it("rolls an unowned move by its slug alone", () => {
		const row = rowOf(render([move(DEFEND)]), "defend");
		expect(row.classList.contains("item")).toBe(false);
		expect(row.hasAttribute("data-item-id")).toBe(false);
	});

	// A prompt move rolls plain 2d6: the die says it rolls, and there is nothing to add.
	it("gives a prompt move its die and an empty stat column", () => {
		const row = rowOf(render([move({ rollStat: "prompt" }, { name: "Deaths Door" })]), "deaths-door");
		expect(row.querySelector(".stonetop-mrow-roll")).not.toBeNull();
		expect(row.querySelector(".stonetop-mrow-stat").textContent.trim()).toBe("");
	});

	it("gives a move that does not roll no button, its plain name, and a dash", () => {
		const row = rowOf(render([move({}, { name: "Recover" })]), "recover");
		expect(row.querySelector("button.rollable")).toBeNull();
		expect(row.querySelector(".stonetop-mrow-title--static").textContent).toBe("Recover");
		expect(row.querySelector(".stonetop-mrow-nil").textContent).toBe("—");
	});
});

describe("a character's move row — its text", () => {
	it("keeps the text shut behind a caret that names what it opens", () => {
		const row = rowOf(render([move(DEFEND)]), "defend");
		const caret = row.querySelector(".stonetop-mrow-caret[data-disclosure]");
		const body = row.querySelector(".stonetop-move-body");
		expect(caret.getAttribute("aria-controls")).toBe(body.id);
		expect(body.id).toBe("s1-move-basic-defend");
		expect(body.hidden).toBe(true);
		expect(caret.getAttribute("aria-expanded")).toBe("false");
		expect(caret.dataset.action).toBe("toggleSliding");
		expect(caret.hasAttribute("data-view-state")).toBe(true);
	});

	it("is the row the caret opens and shuts, and its gloss goes while it is open", () => {
		const row = rowOf(render([move(DEFEND)]), "defend");
		expect(row.hasAttribute("data-disclosure-row")).toBe(true);
		const gloss = row.querySelector(".stonetop-move-gloss");
		expect(gloss.textContent).toBe("stand in defense of a person, item, or location");
		expect(gloss.hasAttribute("data-disclosure-shut")).toBe(true);
	});

	it("draws no gloss for a move with no text to lift one from", () => {
		expect(rowOf(render([move({ description: "" }, { name: "Plain" })]), "plain")
			.querySelector(".stonetop-move-gloss")).toBeNull();
	});

	it("draws what the move lets you mark through the shipped choice rows", () => {
		const choices = { slug: "choices", list: [{ type: "entry", slug: "tether", content: { text: "Choose" },
			input: { type: "inline" } }] };
		const row = rowOf(render([move({ choices }, { name: "Tethered" })]), "tethered");
		const blank = row.querySelector(".stonetop-move-body .stonetop-move-choices textarea.stonetop-cg-text");
		expect(blank.dataset.cgContext).toBe("move");
		expect(row.querySelector(".stonetop-move-choices").dataset.moveSlug).toBe("tethered");
	});
});

// Burn Brightly appears open: its whole rule is one sentence, and that sentence is what says it is not
// levelling. The reader can still shut it.
describe("a character's move row — starting open", () => {
	const open = () => {
		const host = document.createElement("div");
		host.innerHTML = renderPartial("stonetop.character-move-row",
			{ ...move(DEFEND), categoryKey: "special", startOpen: true, sheetIdPrefix: "s1" });
		return host.querySelector("li");
	};

	it("shows its text and says so", () => {
		const row = open();
		expect(row.classList.contains("is-open")).toBe(true);
		expect(row.querySelector(".stonetop-move-body").hidden).toBe(false);
		const caret = row.querySelector(".stonetop-mrow-caret");
		expect(caret.getAttribute("aria-expanded")).toBe("true");
		expect(caret.getAttribute("aria-label")).toBe(caret.dataset.labelHide);
	});

	it("keeps its gloss away while it is open", () => {
		expect(open().querySelector(".stonetop-move-gloss").hidden).toBe(true);
	});
});

describe("a character's move row — what it carries", () => {
	it("keeps a track on the row", () => {
		const pips = rowOf(render([move(DEFEND)]), "defend")
			.querySelectorAll(".stonetop-item-resources .stonetop-item-resource-check");
		expect(pips).toHaveLength(4);
		expect(pips[0].dataset.action).toBe("moveResourcePip");
	});

	// No chat bubble in the rail: it cost 20px of the only column with anything long in it.
	it("puts the send-to-chat button on only where the list asks for it", () => {
		expect(rowOf(render([move(DEFEND)]), "defend").querySelector(".stonetop-move-chat")).toBeNull();
		const chat = rowOf(render([move(DEFEND)], { chat: true }), "defend").querySelector(".stonetop-move-chat");
		expect(chat.dataset.action).toBe("moveToChat");
	});
});

describe("a character's move row — the hover card", () => {
	const card = () => rowOf(render([move(DEFEND)]), "defend").querySelector(".stonetop-move-preview");

	it("names the move and what it rolls", () => {
		expect(card().querySelector(".stonetop-move-preview-title").textContent).toContain("Defend");
		expect(card().querySelector(".stonetop-move-preview-roll")).not.toBeNull();
	});

	it("prints the move's own text and its result tiers", () => {
		expect(card().querySelector(".stonetop-move-preview-text").textContent).toContain("stand in defense");
		expect([...card().querySelectorAll(".stonetop-move-preview-tiers dt")].map(dt => dt.textContent))
			.toEqual(["10+", "7-9"]);
	});

	it("says which list the move is from", () => {
		expect(card().querySelector(".stonetop-move-preview-foot").textContent).toBe("Basic Moves");
	});
});

describe("a character's move list — by phase", () => {
	const phases = MovePhaseGroup.fromMoves([
		{ ...move({}, { name: "Outfit" }), phase: "setting-out" },
		{ ...move({}, { name: "Forage" }), phase: "on-the-road" },
		move({}, { name: "Homebrew" }),
	]);

	// One list with the headings inside it, so every row shares one set of columns.
	it("heads each part of the journey inside the one list", () => {
		const host = render(null, { phases });
		expect(host.querySelectorAll("ol.stonetop-move-list")).toHaveLength(1);
		expect([...host.querySelectorAll(".stonetop-move-phase-title")].map(h => h.textContent))
			.toEqual(["stonetop.character.moves.phase.setting-out", "stonetop.character.moves.phase.on-the-road"]);
	});

	it("draws every move, the unphased last and under no heading", () => {
		const slugs = [...render(null, { phases }).querySelectorAll("li.stonetop-mrow")].map(li => li.dataset.slug);
		expect(slugs).toEqual(["outfit", "forage", "homebrew"]);
	});
});
