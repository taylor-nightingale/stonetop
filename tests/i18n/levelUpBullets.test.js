import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { MoveBullets } from "../../src/model/snapshot/character/MoveBullets.js";
import { LEVEL_UP_SLUG } from "../../src/actors/character/CharacterAdvancement.js";

// The Level Up strip takes its words from the move's DESCRIPTION rather than from a second copy on
// each step, so a translator answers each sentence once instead of twice — see LevelUpProcedure.
//
// The price of that is an invariant no other test can see: the description's bullet list and the
// pack's `steps` must stay the same length, in every language that ships. They pair by position, and
// a mismatch is not an error anywhere — the strip quietly drops every step's words and renders as a
// bare checklist. In English that would be caught by looking at it. In German it would not.
//
// This is what the four Seasons Change moves get wrong the other way: they DO author their step
// text, and every one of those strings is blank in German beside a fully translated description.

const MOVE_PATH = "packs/src/moves/homefront/level-up.json";
const source = () => JSON.parse(readFileSync(path.resolve(process.cwd(), MOVE_PATH), "utf8"));

/** Every shipped translation's description for this move, keyed by language. */
function translatedDescriptions() {
	const root = path.resolve(process.cwd(), "languages/compendium");
	if (!existsSync(root)) return [];
	return readdirSync(root, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => {
			const file = path.join(root, entry.name, "moves.json");
			if (!existsSync(file)) return null;
			const text = JSON.parse(readFileSync(file, "utf8"))[LEVEL_UP_SLUG]?.description?.text;
			return text ? [entry.name, text] : null;
		})
		.filter(Boolean);
}

describe("Level Up — the move's steps and its description's bullets", () => {
	it("ships a step for every bullet the English description spells out", () => {
		const move = source().system;
		expect(MoveBullets.from(move.description)).toHaveLength(move.steps.length);
	});

	it("carries no step text of its own — the words live in the description, translated once", () => {
		for (const step of source().system.steps) {
			expect(step, `step "${step.kind}" carries prose the translator would answer twice`)
				.not.toHaveProperty("text");
		}
	});

	// A translation that drops or merges a bullet renders the strip as a bare checklist in that
	// language alone, which is exactly the kind of thing nobody notices until a table reports it.
	it.each(translatedDescriptions())("pairs 1:1 in %s too", (_language, description) => {
		expect(MoveBullets.from(description)).toHaveLength(source().system.steps.length);
	});
});
