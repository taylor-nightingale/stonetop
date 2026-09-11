// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { renderPartial } from "../fakes/renderTemplate.js";
import { ImprovementPayoff } from "../../src/model/snapshot/steading/ImprovementPayoff.js";
import { SteadingImprovement } from "../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";

/**
 * An improvement's card, rendered from the pack's own effects.
 *
 * The card is the one surface that is not inside a season, so it reads each clause as the sentence
 * the book prints — "when ***summer comes and you roll a 7+ with Fortunes***, the steading generates
 * 1 Surplus" — rather than as a fragment under a heading, a timing chip and an "only if" tail.
 */
const payoffFor = (slug, dir = "stonetop") => {
	const doc = JSON.parse(readFileSync(
		`packs/src/steading-improvements/${dir}/${slug}.json`, "utf8"));
	const improvement = new SteadingImprovement(doc.system.slug, doc.name, doc.system.choices, 0,
		{ requires: doc.system.requires, effects: doc.system.effects });
	const root = document.createElement("div");
	root.innerHTML = renderPartial("stonetop.steading-improvement-payoff",
		ImprovementPayoff.forCatalog(improvement));
	return root;
};

const rows = (root, head) => {
	const heads = [...root.querySelectorAll(".steading-payoff-head")];
	const from  = heads.find(h => h.textContent.includes(head));
	return [...from.nextElementSibling.querySelectorAll(".steading-statement-line")];
};

const flat = el => el.textContent.replace(/\s+/g, " ").trim();

describe("an improvement's card", () => {
	it("reads a clause as the book's own sentence", () => {
		const [line] = rows(payoffFor("raincatching"), "henceforth");
		expect(flat(line)).toBe("when summer comes and you roll a 7+ with Fortunes, the steading generates 1 Surplus");
		expect(line.querySelector(".steading-statement-clause em")).not.toBeNull();
	});

	// Under "When you meet the requirements:", which states the trigger for all of them.
	it("leaves a plain completion result as what it does", () => {
		expect(rows(payoffFor("raincatching"), "onCompletion").map(flat))
			.toEqual(["increase Fortunes by 1", 'add "Raincatching" to the Resources list']);
	});

	/**
	 * The em dash that closes the timing group is drawn by the group's own span, so a line showing
	 * its clause left an EMPTY one — and the dash with it, sitting in front of a clause that had just said its
	 * own "when". The group goes when the chips do.
	 */
	it("draws no timing group for a clause that states its own trigger", () => {
		const root = payoffFor("township");
		expect(root.querySelector(".steading-statement-whens")).toBeNull();
		for (const line of rows(root, "henceforth")) expect(flat(line).startsWith("when ")).toBe(true);
	});

	// The chips are the fallback for a clause with no phrase of its own — a homebrew improvement, or
	// one authored before the trigger words were.
	it("keeps the timing chip where the clause says nothing of when", () => {
		const bare = new SteadingImprovement("bare", "Bare", { slug: "bare", list: [] }, 0, {
			effects: [{ when: { kind: "turn", seasons: ["winter"] }, text: "something happens" }],
		});
		const root = document.createElement("div");
		root.innerHTML = renderPartial("stonetop.steading-improvement-payoff",
			ImprovementPayoff.forCatalog(bare));
		expect(root.querySelector(".steading-statement-when").textContent)
			.toBe("stonetop.steading.seasons.names.winter");
	});

	// The palisade's advantage holds from the moment the palisade stands, so the pack stores it as
	// completion-triggered — but the book prints it under Henceforth, and it states its own "when".
	it("files a clause with its own trigger under Henceforth", () => {
		const root = payoffFor("palisade");
		expect(rows(root, "onCompletion").map(flat))
			.toEqual(["increase Fortunes by 1", 'add "Palisade" to the Fortifications list and draw it on the map']);
		expect(rows(root, "henceforth").map(flat))
			.toEqual(["when you take advantage of the palisade, you have advantage to Deploy"]);
	});
});
