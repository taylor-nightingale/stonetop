import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { openMoveSheet } from "../../src/actors/embeddedMoves.js";
import { MOVE_ROW_ACTIONS } from "../../src/actors/moveRowHandlers.js";

// A move row's name opens the item behind it — the character's own copy when they have taken the
// move, otherwise the compendium move it was rendered from, which is what the Items sidebar opens.

const moveItem = (slug, name = slug) => ({ type: "move", name, system: { slug }, sheet: { render: vi.fn() } });
const actorWith = (...items) => ({ items });
const repoWith = (doc) => ({ getMoveDocumentBySlug: vi.fn(async () => doc) });

describe("openMoveSheet", () => {
	it("opens the actor's own copy when they have taken the move", async () => {
		const owned = moveItem("trade-barter");
		const repo = repoWith(moveItem("trade-barter"));
		expect(await openMoveSheet(actorWith(owned), "trade-barter", repo)).toBe(true);
		expect(owned.sheet.render).toHaveBeenCalledWith(true);
		expect(repo.getMoveDocumentBySlug).not.toHaveBeenCalled();   // no need to reach for the pack
	});

	it("falls back to the compendium source for a move the actor has not taken", async () => {
		const source = moveItem("trade-barter");
		const repo = repoWith(source);
		expect(await openMoveSheet(actorWith(), "trade-barter", repo)).toBe(true);
		expect(repo.getMoveDocumentBySlug).toHaveBeenCalledWith("trade-barter");
		expect(source.sheet.render).toHaveBeenCalledWith(true);
	});

	it("ignores an item of another type that happens to share the slug", async () => {
		const notAMove = { type: "possession", system: { slug: "trade-barter" }, sheet: { render: vi.fn() } };
		const source = moveItem("trade-barter");
		await openMoveSheet(actorWith(notAMove), "trade-barter", repoWith(source));
		expect(notAMove.sheet.render).not.toHaveBeenCalled();
		expect(source.sheet.render).toHaveBeenCalledWith(true);
	});

	// An arcanum's inline move is text printed on the arcanum, not an item — there is nothing to open.
	it("reports that there is nothing to open when neither exists", async () => {
		expect(await openMoveSheet(actorWith(), "nothing-here", repoWith(null))).toBe(false);
	});

	it("survives a host with no move repository at all", async () => {
		expect(await openMoveSheet(actorWith(), "nothing-here", null)).toBe(false);
	});
});

describe("MOVE_ROW_ACTIONS.openMove", () => {
	it("hands the row's slug to the typed actor and nothing else", () => {
		const typedActor = { openMoveSheet: vi.fn() };
		MOVE_ROW_ACTIONS.openMove.call({ typedActor }, {}, { dataset: { moveSlug: "trade-barter" } });
		expect(typedActor.openMoveSheet).toHaveBeenCalledWith("trade-barter");
	});

	// Reading a move is not an edit: it has to work on a locked sheet, so it is not editOnly-wrapped.
	it("is not edit-gated", () => {
		const typedActor = { openMoveSheet: vi.fn() };
		MOVE_ROW_ACTIONS.openMove.call({ typedActor, isEditable: false }, {}, { dataset: { moveSlug: "x" } });
		expect(typedActor.openMoveSheet).toHaveBeenCalled();
	});
});

describe("move-item.hbs", () => {
	const source = readFileSync("templates/actor/partials/move-item.hbs", "utf8");

	// Core binds click only for [data-action], and only on a <button> is it reachable by keyboard.
	it("renders the name as a button carrying the action and the slug", () => {
		expect(source).toMatch(/<button[^>]*class="[^"]*stonetop-item-name[^"]*"[^>]*data-action="openMove"/s);
		expect(source).toMatch(/data-action="openMove"[\s\S]{0,160}data-move-slug="\{\{slug\}\}"/);
	});

	// V2 disables every control on a non-editable sheet unless it is marked view-state.
	it("marks the name view-state so it still opens on a locked sheet", () => {
		const button = source.match(/<button[^>]*data-action="openMove"[^>]*>/s)[0];
		expect(button).toContain("data-view-state");
	});
});
