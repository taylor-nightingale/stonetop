// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { renderPartial } from "../fakes/renderTemplate.js";
import { Advice } from "../../src/model/data/Advice.js";

// The board's "If you want to…" ? is one of its bar's controls, hung from the bar's far end like the
// coinage panel's — not a toolbar floating over the panel.
describe("the improvement board's advice", () => {
	beforeAll(() => {
		Advice.current = Advice.fromTranslations(
			JSON.parse(readFileSync(path.resolve("languages/en.json"), "utf8")).stonetop.advice);
	});

	const board = params => {
		const host = document.createElement("div");
		host.innerHTML = renderPartial("stonetop.steading-improvement-board", { board: { isEmpty: true }, index: 0, ...params });
		return host.querySelector("section.steading-board");
	};

	it("hangs from the board's bar", () => {
		const advice = board({ advice: "steadingImprovement" })
			.querySelector(':scope > .stonetop-bar .stonetop-bar-meta [data-action="showAdvice"]');
		expect(advice?.dataset.topic).toBe("steadingImprovement");
		expect(advice.classList.contains("stonetop-bar-action")).toBe(true);
	});

	it("is absent when the board is given no topic", () => {
		expect(board({}).querySelector('[data-action="showAdvice"]')).toBeNull();
	});
});
