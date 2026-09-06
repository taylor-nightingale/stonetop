import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { knownMoveSlugs, missingFrom, payoffRows, problemsFor, requirementSlugs, trackedRows } from "../../scripts/import/improvementModel.js";

/**
 * The improvement model is authored by hand, because classifying a clause needs judgement a parser
 * should not be trusted with — that Township's winter clause REPLACES a die rather than adding to it.
 *
 * The cost of that is drift: a requirement row renamed in the pack, an improvement whose prose grows
 * a seasonal clause nobody modelled, a moment that no longer exists. The build fails on all of it,
 * but the build only runs when someone regenerates. This runs every time.
 */

const ROOT = "packs/src/steading-improvements";
const MODEL = JSON.parse(readFileSync("data/improvement-effects.json", "utf8"));

const docs = Object.fromEntries(
	["stonetop", "additional"].flatMap(dir =>
		readdirSync(join(ROOT, dir)).filter(f => f.endsWith(".json")).map(f => {
			const doc = JSON.parse(readFileSync(join(ROOT, dir, f), "utf8"));
			return [doc.system.slug, doc];
		})));

const authored = Object.entries(MODEL).filter(([slug]) => !slug.startsWith("_"));

describe("the authored improvement model matches the pack", () => {
	it("has an entry for every improvement, and no entry for anything else", () => {
		expect(missingFrom(MODEL, docs)).toEqual([]);
		expect(authored.filter(([slug]) => !docs[slug]).map(([slug]) => slug)).toEqual([]);
	});

	// Every check the build makes, run per improvement so a failure names the one at fault.
	const moves = knownMoveSlugs();
	it.each(authored.map(([slug]) => slug))("%s", slug => {
		expect(problemsFor(slug, MODEL[slug], docs[slug], moves)).toEqual([]);
	});
});

describe("what the model is for", () => {
	// The live bug this whole model exists to fix: the book gives Greater Harvest two ways to get
	// there and asks for one. "Every box ticked" could never be satisfied.
	it("lets Greater Harvest be done at one of two", () => {
		expect(MODEL["greater-harvest"].requires).toEqual({ any: 1, of: ["double-yield", "clear-fields"] });
	});

	// Weapons of War: either you buy the weapons or you build the means to make them, and one branch
	// is itself three rows. Nesting is what holds it.
	it("keeps Weapons of War's alternation, one branch of which is a group", () => {
		const req = MODEL["weapons-of-war"].requires;
		const branch = req.all.find(t => t.of);
		expect(branch.any).toBe(1);
		expect(branch.of).toContainEqual({ all: ["smith-staff", "iron-ore", "smith-seasons"] });
	});

	// The militia exists once there is a warrior to command it; its Defenses bump waits on two
	// trained tactics. Two results of one improvement, holding at different times.
	it("narrows one result of Well-Trained Militia without narrowing the others", () => {
		const effects = MODEL["well-trained-militia"].effects;
		const defenses = effects.find(e => e.change?.target === "defenses");
		expect(defenses.requires.all).toContainEqual({
			any: 2, of: ["archery", "cavalry", "formations", "readiness", "skirmishing"],
		});
		expect(effects.find(e => e.when.kind === "turn").requires).toBe("veteran-warrior");
	});

	// A harvest is not the turn of the season — the Mill pays out during autumn, not when autumn
	// arrives.
	it("puts the Mill's Surplus at the harvest, not at the turn into autumn", () => {
		const harvest = MODEL.mill.effects.find(e => e.when.kind === "moment");
		expect(harvest.when.moment).toBe("autumn-harvest");
		expect(MODEL.mill.effects.some(e => e.when.kind === "turn")).toBe(false);
	});

	// One sentence, two results — they fire at different times, so they are modelled apart.
	it("splits Rhoillyg Orchard's one sentence into its two moments", () => {
		const when = MODEL["rhoillyg-orchard"].effects
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
		const granted = authored.flatMap(([slug, entry]) =>
			(entry.effects ?? []).filter(e => e.grantsMove).map(e => [slug, e.grantsMove]));
		expect(Object.fromEntries(granted)).toEqual({
			"aurochs-hunting":   "lead-the-aurochs-hunt",
			"inn":               "news-at-the-inn",
			"heroic-reputation": "heroic-reputation",
		});
		for (const [, moveSlug] of granted) expect(moves.has(moveSlug)).toBe(true);
	});

	// A rolled move has no amount to apply in advance; what it does depends on the dice.
	it("never marks a granted move as applicable", () => {
		for (const [, entry] of authored) {
			for (const e of entry.effects ?? []) {
				if (e.grantsMove) expect(e.change?.amount).toBeUndefined();
			}
		}
	});
});

describe("every requirement is answerable", () => {
	it("names only rows the improvement actually has", () => {
		const bad = [];
		for (const [slug, entry] of authored) {
			const known = new Set(Object.keys(trackedRows(docs[slug])));
			for (const row of requirementSlugs(entry.requires)) {
				if (!known.has(row)) bad.push(`${slug}: ${row}`);
			}
		}
		expect(bad).toEqual([]);
	});

	// A box the table can tick that no requirement mentions is a box that means nothing.
	it("leaves no tracked row unreferenced", () => {
		const orphans = [];
		for (const [slug, entry] of authored) {
			const named = new Set([
				...requirementSlugs(entry.requires),
				...(entry.effects ?? []).flatMap(e => requirementSlugs(e.requires)),
			]);
			for (const row of Object.keys(trackedRows(docs[slug]))) {
				if (!named.has(row)) orphans.push(`${slug}: ${row}`);
			}
		}
		expect(orphans).toEqual([]);
	});
});

/**
 * `_prose` is the book's payoff sentence, moved into the model when the pack's copy was stripped —
 * it was a second statement of everything `effects` says, and BOTH halves were extracted for
 * translation (29 strings, 7,848 characters, against 6,276 of effect text saying the same things).
 *
 * Moving it makes `text` free to be display copy, and makes `_prose` the only thing left that can be
 * checked against Book I/II. So these are the checks that keep the move honest: without them the
 * strip is a delete with nothing watching it.
 */
describe("the book's payoff sentence is recorded before the pack's copy is stripped", () => {
	// What build-improvements.js leaves behind every time it regenerates additional/: the payoff rows
	// back on the end of the list, waiting for the strip pass. That is the state these guards run in,
	// so it is the state they are tested in — the committed pack is already stripped and would let
	// every one of them pass by having nothing to check.
	const unstripped = (slug, prose = MODEL[slug]._prose) => {
		const doc = docs[slug];
		return { ...doc, system: { ...doc.system, choices: { ...doc.system.choices,
			list: [...doc.system.choices.list, ...prose.map(text => ({ type: "entry", content: { title: null, text } }))],
		} } };
	};

	it("records _prose for every improvement", () => {
		expect(authored.filter(([, e]) => !(e._prose ?? []).length).map(([slug]) => slug)).toEqual([]);
	});

	it("reads back exactly the rows the strip removed", () => {
		for (const [slug, entry] of authored) {
			expect(payoffRows(unstripped(slug)), slug).toEqual(entry._prose);
		}
	});

	// The committed pack is stripped, and every guard has to be quiet about that — otherwise the
	// build fails the moment the strip it is guarding actually runs.
	it("is quiet once the pack has been stripped", () => {
		const moves = knownMoveSlugs();
		for (const [slug, entry] of authored) {
			expect(payoffRows(docs[slug]), slug).toEqual([]);
			expect(problemsFor(slug, entry, docs[slug], moves), slug).toEqual([]);
		}
	});

	// The refusal that matters. A parser regression that empties `effects` must not let the strip
	// proceed: the book's payoff would be deleted with nothing left saying what it was.
	it("refuses to strip an improvement that models no effects", () => {
		const problems = problemsFor("mill", { ...MODEL.mill, effects: [] }, unstripped("mill"));
		expect(problems.some(p => /payoff row\(s\) to strip but models no effects/.test(p))).toBe(true);
	});

	it("refuses when a builder has reworded the pack's payoff out from under _prose", () => {
		const doc = unstripped("mill", ["Henceforth, something else entirely."]);
		const problems = problemsFor("mill", MODEL.mill, doc);
		expect(problems.some(p => /no longer match _prose/.test(p))).toBe(true);
	});

	it("refuses an improvement with no _prose at all", () => {
		const { _prose, ...without } = MODEL.mill;
		expect(problemsFor("mill", without, docs.mill).some(p => /has no _prose/.test(p))).toBe(true);
	});

	// A payoff the box parser ran onto the end of a requirement row is prose the strip cannot reach.
	it("refuses a payoff glued onto the last requirement row", () => {
		const doc = docs.mill;
		const rows = [...doc.system.choices.list];
		const last = rows.reduce((l, r, i) => (r.track ? i : l), -1);
		rows[last] = { ...rows[last], content: { ...rows[last].content,
			text: `${rows[last].content.text} Henceforth, the steading generates +1 Surplus.` } };
		const glued = { ...doc, system: { ...doc.system, choices: { ...doc.system.choices, list: rows } } };
		expect(problemsFor("mill", MODEL.mill, glued).some(p => /glued onto the last requirement row/.test(p))).toBe(true);
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

	it.each(authored.flatMap(([slug, entry]) =>
		(entry.effects ?? []).map((e, i) => [`${slug}[${i}]`, e])
	))("%s", (_name, effect) => {
		for (const opener of TRIGGER_OPENERS) {
			expect(effect.text, `re-states its own trigger: ${effect.text}`).not.toMatch(opener);
		}
	});

	// A granted move's result tiers live on the move item in the moves pack and are translated there.
	// Restating them here made a translator do the same three tiers twice.
	it("never restates a granted move's result tiers", () => {
		for (const [slug, entry] of authored) {
			for (const e of entry.effects ?? []) {
				if (e.grantsMove) expect(e.text, slug).not.toMatch(/on a (10\+|7-9|6-)/i);
			}
		}
	});
});
