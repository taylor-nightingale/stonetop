import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { danglingImprovementLinks, improvementSlugs, knownMoveSlugs, problemsFor, requirementSlugs, trackedRows } from "../../scripts/import/improvementModel.js";

/**
 * The improvement model is authored by hand, because classifying a clause needs judgement a parser
 * should not be trusted with — that Township's winter clause REPLACES a die rather than adding to it.
 *
 * The cost of that is drift: a requirement row renamed in the pack, an improvement whose prose grows
 * a seasonal clause nobody modelled, a moment that no longer exists. The build fails on all of it,
 * but the build only runs when someone regenerates. This runs every time.
 */

const ROOT = "packs/src/steading-improvements";

const docs = Object.fromEntries(
	["stonetop", "additional"].flatMap(dir =>
		readdirSync(join(ROOT, dir)).filter(f => f.endsWith(".json")).map(f => {
			const doc = JSON.parse(readFileSync(join(ROOT, dir, f), "utf8"));
			return [doc.system.slug, doc];
		})));

const authored = Object.entries(docs);

describe("every improvement's authored model answers the rows it has", () => {
	// Every check the review makes, run per improvement so a failure names the one at fault.
	const moves = knownMoveSlugs();
	it.each(authored.map(([slug]) => slug))("%s", slug => {
		expect(problemsFor(docs[slug], moves)).toEqual([]);
	});
});

describe("what the model is for", () => {
	// The live bug this whole model exists to fix: the book gives Greater Harvest two ways to get
	// there and asks for one. "Every box ticked" could never be satisfied.
	it("lets Greater Harvest be done at one of two", () => {
		expect(docs["greater-harvest"].system.requires).toEqual({ any: 1, of: ["double-yield", "clear-fields"] });
	});

	// Weapons of War: either you buy the weapons or you build the means to make them, and one branch
	// is itself three rows. Nesting is what holds it.
	it("keeps Weapons of War's alternation, one branch of which is a group", () => {
		const req = docs["weapons-of-war"].system.requires;
		const branch = req.all.find(t => t.of);
		expect(branch.any).toBe(1);
		expect(branch.of).toContainEqual({ all: ["smith-staff", "iron-ore", "smith-seasons"] });
	});

	// The militia exists once there is a warrior to command it; its Defenses bump waits on two
	// trained tactics. Two results of one improvement, holding at different times.
	it("narrows one result of Well-Trained Militia without narrowing the others", () => {
		const effects = docs["well-trained-militia"].system.effects;
		const defenses = effects.find(e => e.change?.target === "defenses");
		expect(defenses.requires.all).toContainEqual({
			any: 2, of: ["archery", "cavalry", "formations", "readiness", "skirmishing"],
		});
		expect(effects.find(e => e.when.kind === "turn").requires).toEqual({ all: ["veteran-warrior"] });
	});

	// A harvest is not the turn of the season — the Mill pays out during autumn, not when autumn
	// arrives.
	it("puts the Mill's Surplus at the harvest, not at the turn into autumn", () => {
		const harvest = docs.mill.system.effects.find(e => e.when.kind === "moment");
		expect(harvest.when.moment).toBe("autumn-harvest");
		expect(docs.mill.system.effects.some(e => e.when.kind === "turn")).toBe(false);
	});

	// One sentence, two results — they fire at different times, so they are modelled apart.
	it("splits Rhoillyg Orchard's one sentence into its two moments", () => {
		const when = docs["rhoillyg-orchard"].system.effects
			.filter(e => e.change?.target === "surplus")
			.map(e => e.when.kind === "moment" ? e.when.moment : e.when.seasons.join());
		expect(when).toEqual(["summer", "autumn-harvest"]);
	});
});

describe("granted moves", () => {
	// The book writes three of these as a trigger and three result tiers, which is a move — so each
	// is an ordinary item in the moves pack, rolled through the ordinary pipeline rather than
	// re-implemented as an effect that happens to have outcomes.
	it("grants exactly the three the book names, and each exists", () => {
		const moves = knownMoveSlugs();
		const granted = authored.flatMap(([slug, doc]) =>
			(doc.system.effects ?? []).filter(e => e.grantsMove).map(e => [slug, e.grantsMove]));
		expect(Object.fromEntries(granted)).toEqual({
			"aurochs-hunting":   "lead-the-aurochs-hunt",
			"inn":               "news-at-the-inn",
			"heroic-reputation": "heroic-reputation",
		});
		for (const [, moveSlug] of granted) expect(moves.has(moveSlug)).toBe(true);
	});

	// A rolled move has no amount to apply in advance; what it does depends on the dice.
	it("never marks a granted move as applicable", () => {
		for (const [, doc] of authored) {
			for (const e of doc.system.effects ?? []) {
				if (e.grantsMove) expect(e.change?.amount).toBeUndefined();
			}
		}
	});
});

describe("every requirement is answerable", () => {
	it("names only rows the improvement actually has", () => {
		const bad = [];
		for (const [slug, doc] of authored) {
			const known = new Set(Object.keys(trackedRows(doc)));
			for (const row of requirementSlugs(doc.system.requires)) {
				if (!known.has(row)) bad.push(`${slug}: ${row}`);
			}
		}
		expect(bad).toEqual([]);
	});

	// A box the table can tick that no requirement mentions is a box that means nothing.
	it("leaves no tracked row unreferenced", () => {
		const orphans = [];
		for (const [slug, doc] of authored) {
			const named = new Set([
				...requirementSlugs(doc.system.requires),
				...(doc.system.effects ?? []).flatMap(e => requirementSlugs(e.requires)),
			]);
			for (const row of Object.keys(trackedRows(doc))) {
				if (!named.has(row)) orphans.push(`${slug}: ${row}`);
			}
		}
		expect(orphans).toEqual([]);
	});
});

/**
 * `_prose` is the book's own payoff sentence, kept on the improvement beside the effects modelled
 * from it. It is the only copy of the book's wording left in the repo — the rows carry the
 * requirements, and `text` is display copy rather than a quotation — so it is what the review file
 * prints each result against. Without it a review can show what was modelled but never what was
 * missed, which is how three clauses were dropped before it existed.
 */
describe("the book's payoff sentence is recorded on every improvement", () => {
	it("records _prose for every improvement", () => {
		expect(authored.filter(([, doc]) => !(doc._prose ?? []).length).map(([slug]) => slug)).toEqual([]);
	});

	it("says so when an improvement has none", () => {
		const { _prose, ...without } = docs.mill;
		expect(problemsFor(without).some(p => /has no _prose/.test(p))).toBe(true);
	});

	// Without effects there is nothing for the prose to have been decomposed into, and the sheet has
	// nothing to reason about — the improvement would complete and do nothing.
	it("says so when an improvement models no effects", () => {
		const empty = { ...docs.mill, system: { ...docs.mill.system, effects: [] } };
		expect(problemsFor(empty).some(p => /models no effects/.test(p))).toBe(true);
	});
});

/**
 * `text` is DISPLAY COPY. Every result renders under a heading that already states its trigger, so a
 * line that re-opens with that trigger reads "The autumn harvest / Mill when the autumn harvest is
 * complete, …" — which is what made every collection of results a wall of tiny text, with the part
 * that differs buried behind a clause they all share.
 */
describe("effect text says what a result DOES, never when it fires", () => {
	const TRIGGER_OPENERS = [
		/^when (the seasons change|winter|summer|spring|autumn)/i,
		/^when (the autumn harvest|summer comes|spring (breaks|bursts))/i,
		/^(each|every) (spring|summer|autumn|winter|season)/i,
		/^at the start of each season/i,
		/^when you (lead the aurochs hunt|consume Surplus in winter)/i,
	];

	it.each(authored.flatMap(([slug, doc]) =>
		(doc.system.effects ?? []).map((e, i) => [`${slug}[${i}]`, e])
	))("%s", (_name, effect) => {
		for (const opener of TRIGGER_OPENERS) {
			expect(effect.text, `re-states its own trigger: ${effect.text}`).not.toMatch(opener);
		}
	});

	// A granted move's result tiers live on the move item in the moves pack and are translated there.
	// Restating them here made a translator do the same three tiers twice.
	it("never restates a granted move's result tiers", () => {
		for (const [slug, doc] of authored) {
			for (const e of doc.system.effects ?? []) {
				if (e.grantsMove) expect(e.text, slug).not.toMatch(/on a (10\+|7-9|6-)/i);
			}
		}
	});
});

/**
 * The wonder articles print a "Steading improvement" box, and the journal stamps each one with the
 * UUID of the item it describes — deterministic from the slug the box parses as. That link used to
 * be guaranteed: the same parse wrote the item. The items are hand-authored now, so nothing
 * regenerates one to match a box the parser reads differently, and a dead link in a journal entry
 * looks exactly like a live one.
 */
describe("the journal's improvement links", () => {
	it("knows every improvement in the pack, both halves", () => {
		const slugs = improvementSlugs();
		expect(slugs.size).toBe(Object.keys(docs).length);
		expect(slugs.has("market")).toBe(true);              // stonetop/
		expect(slugs.has("trade-with-barrier-pass")).toBe(true); // additional/
	});

	it("is quiet when every linked box has an item", () => {
		expect(danglingImprovementLinks(["market", "roadbuilding"], improvementSlugs())).toEqual([]);
	});

	it("names the box whose item is missing", () => {
		const problems = danglingImprovementLinks(["market", "trade-with-the-moon"], improvementSlugs());
		expect(problems).toHaveLength(1);
		expect(problems[0]).toMatch(/trade-with-the-moon/);
	});
});
