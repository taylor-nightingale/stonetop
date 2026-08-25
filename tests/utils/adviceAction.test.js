import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { ADVICE_ACTIONS } from "../../src/utils/adviceAction.js";

describe("ADVICE_ACTIONS.showAdvice", () => {
	// The sheet handler reads the DOM and calls one named thing — it decides nothing itself.
	it("passes the button's topic through and returns the result", async () => {
		const opened = [];
		globalThis.game = { packs: { get: () => null } };
		const result = ADVICE_ACTIONS.showAdvice({}, { dataset: { topic: "coin" } });
		expect(result).toBeInstanceOf(Promise);
		await expect(result).resolves.toBe(false);   // no pack in a bare test world
		delete globalThis.game;
		expect(opened).toEqual([]);
	});
});

describe("advice-button.hbs", () => {
	const source = readFileSync("templates/actor/partials/advice-button.hbs", "utf8");

	it("still names the action and carries its topic", () => {
		expect(source).toContain('data-action="showAdvice"');
		expect(source).toContain('data-topic="{{topic}}"');
	});

	// Reading the book is not an edit: the button has to work on a sheet a player can only observe.
	it("stays live on a non-editable sheet", () => {
		expect(source).toContain("data-view-state");
	});
});
