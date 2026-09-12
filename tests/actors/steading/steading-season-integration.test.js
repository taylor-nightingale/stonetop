// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { SteadingImprovement } from "../../../src/actors/steading/repositories/FoundrySteadingImprovementRepository.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeSteadingImprovementRepository } from "../../fakes/FakeSteadingImprovementRepository.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { Seasons } from "../../../src/model/data/steading/Seasons.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { renderSheetPart } from "../../fakes/renderSheetPart.js";
import { readFileSync } from "fs";
import path from "path";

const STEADING_TEMPLATE = "systems/stonetop/templates/actor/steading.hbs";

/**
 * The Season tab end to end, with only Foundry faked: the real sheet, the real template and its real
 * partials, the real SteadingSeason, SteadingImprovements and the shared choice machinery.
 *
 * The tab's claims are all wiring claims — that the checklist is assembled from the improvements
 * this steading OWNS and not from the catalog, that advancing the wheel actually reaches the actor
 * and clears the ticks, that the board's meters come from the track state the choice rows write.
 * Unit tests over a mocked repo prove each part works and miss whether the sheet ever calls it.
 */

// Improvements shaped like the real pack sources after the model merge: requirement rows carrying a
// track, the effect prose, and the authored `requires` + `effects`. A result inherits the
// improvement's requirement, so nothing fires until the tracks are filled.
function improvement(slug, name, { tracks = [], effects = [], effect = "Henceforth, it helps." } = {}) {
	return new SteadingImprovement(slug, name, {
		slug,
		list: [
			...tracks.map(([rowSlug, max]) => ({
				type: "entry", slug: rowSlug, content: { text: `needs ${rowSlug}` }, track: { max },
			})),
			{ type: "entry", content: { text: effect } },
		],
	}, 0, { requires: { all: tracks.map(([rowSlug]) => rowSlug) }, effects });
}

const MILL = improvement("mill", "Mill", {
	tracks: [["site", 1], ["miller", 2]],
	effects: [
		// What finishing it owes the steading, what it does each autumn, and one clause the sheet
		// can only state — the three shapes a card has to render.
		{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 },
		  text: "increase Fortunes by 1" },
		{ when: { kind: "completed" }, listEntry: { list: "resources", text: "Mill" },
		  text: 'add "Mill" to the Resources list' },
		{ when: { kind: "completed" }, text: "each of supplies has 1 extra use" },
		{ when: { kind: "turn", seasons: ["autumn"] }, change: { target: "surplus", amount: 1 },
		  text: "the steading generates +1 Surplus" },
	],
	effect: "Henceforth, when the autumn harvest is complete, the steading generates +1 Surplus.",
});
const WATCH = improvement("standing-watch", "Standing Watch", {
	tracks: [["leaders", 3]],
	effects: [{ when: { kind: "turn" }, change: { target: "surplus", amount: -1 },
		text: "the watch consumes 1 Surplus or it disbands" }],
});
const PALISADE = improvement("palisade", "Palisade", { tracks: [["timber", 4]] });

// A clause the sheet can only STATE — it cannot know whether the market was active. What the general
// list still holds, now that everything it can write is shown where it happens.
const MARKET = improvement("market", "Market", {
	tracks: [["traders", 1]],
	effects: [{ when: { kind: "turn", seasons: ["winter"],
			phrase: "when **_winter grips the land and the market is active_**" },
		change: { target: "surplus", amount: 1 }, condition: true,
		text: "the market generates 1 Surplus" }],
});

// Its completion changes nothing the sheet can write — Size is a tier, not a delta.
const TOWNSHIP = improvement("township", "Township", {
	tracks: [["population", 1]],
	effects: [
		{ when: { kind: "completed" }, text: "change Size to town and its Population to +0" },
		// "roll 2d6+Population to consume Surplus, instead of 1d4+Population" — the dice themselves.
		{ when: { kind: "turn", seasons: ["winter"] },
		  adjustment: { step: "consumption", at: "formula", die: "2d6", stat: "population" },
		  text: "roll 2d6+Population to consume Surplus, instead of 1d4+Population" },
		// "the town generates Surplus equal to Population+1" — arithmetic over a rating the sheet
		// knows, which is not a die however it is written.
		{ when: { kind: "turn", seasons: ["spring", "summer"] },
		  change: { target: "surplus", formula: "@population + 1" },
		  text: "the town generates Surplus equal to Population+1" },
	],
});

// A moment WITHIN autumn — not the turn. The harvest coming in is something the table says has
// happened; the wheel arriving in autumn is not the same event.
const ORCHARD = improvement("rhoillyg-orchard", "Rhoillyg Orchard", {
	tracks: [["saplings", 1]],
	effects: [{ when: { kind: "moment", moment: "autumn-harvest" },
		change: { target: "surplus", amount: 1 }, text: "the orchard yields +1 Surplus" }],
});

// A moment clause the book ROLLS for — "gain +1d4 Surplus". Dice, so the step's own dice take it up
// rather than an amount doing.
const GREATER = improvement("greater-harvest", "Greater Harvest", {
	tracks: [["fields", 1]],
	effects: [{ when: { kind: "moment", moment: "autumn-harvest" },
		change: { target: "surplus", formula: "1d4" }, text: "gain +1d4 Surplus" }],
});

// A moment in ANY season, and one the table pays for: the gathering costs a Surplus, which is
// part of the book's own clause and nothing the sheet can judge.
const INN = improvement("inn", "The Inn", {
	tracks: [["innkeeper", 1]],
	effects: [{ when: { kind: "moment", moment: "inn-gathering",
			phrase: "once per season, when **_you expend 1 Surplus and bring folks together at the inn_**" },
		condition: true, text: "clear one of the steading's debilities" }],
});

// A moment that hands the table a MOVE instead of a delta: the hunt is led by rolling it.
const AUROCHS = improvement("aurochs-hunting", "Aurochs Hunting", {
	tracks: [["hunters", 1]],
	effects: [{ when: { kind: "moment", moment: "aurochs-hunt" }, grantsMove: "lead-the-aurochs-hunt",
		text: "when you lead the aurochs hunt in spring, roll +Defenses" }],
});

// Summer bookkeeping the sheet can only state: the herd's size is not tracked anywhere.
const HERD = improvement("herd-of-horses", "Herd of Horses", {
	tracks: [["stable", 1]],
	effects: [{ when: { kind: "turn", seasons: ["summer"] },
		text: "any yearlings become horses, any foals become yearlings" }],
});

// Improvements that BEND winter's consumption rather than adding to the season, at the three places
// the book bends it: the dice, a term inside them, and what you pay once they are rolled. They belong
// against the step they bend, which is the one place they were never shown.
const WALL = improvement("stone-wall", "Stone Wall", {
	tracks: [["stone", 1]],
	effects: [{ when: { kind: "turn", seasons: ["winter"] },
		adjustment: { step: "consumption", at: "result", amount: -1 },
		text: "consumes 1 less Surplus than normal" }],
});
const HOUSING = improvement("additional-housing", "Additional Housing", {
	tracks: [["homes", 1]],
	effects: [{ when: { kind: "turn", seasons: ["winter"] },
		adjustment: { step: "consumption", at: "term", term: "population", amount: -1 },
		text: "consider Population to be 1 lower than it is" }],
});
// "when the steading generates Surplus, even just 1, it generates +1" — every season, so it lands on
// summer's generation step and on nothing at all in winter.
const SAPLING = improvement("golden-sapling", "Golden Sapling", {
	tracks: [["sapling", 1]],
	effects: [{ when: { kind: "turn", seasons: [] },
		adjustment: { step: "generation", at: "result", amount: 1 },
		text: "when the steading generates Surplus, even just 1, it generates +1 Surplus" }],
});
// The one improvement that waits on the season's OWN roll — it belongs against the roll it waits on.
const STREAM = improvement("harnessing-the-stream", "Harnessing the Stream", {
	tracks: [["stream", 1]],
	effects: [{ when: { kind: "turn", seasons: ["winter"],
			phrase: "when **_winter grips the land and you roll a 7+ with Fortunes_**" },
		change: { target: "surplus", amount: 1 }, condition: true, outcome: "7+",
		text: "the steading generates 1 Surplus" }],
});

// The track values that make an improvement BUILT — every requirement box filled. A clause is the
// ongoing effect of a finished improvement, so nothing fires until this is stored.
const BUILT = {
	mill:              { mill: { site: 1, miller: 2 } },
	"standing-watch":  { "standing-watch": { leaders: 3 } },
	township:          { township: { population: 1 } },
	"herd-of-horses":  { "herd-of-horses": { stable: 1 } },
	"rhoillyg-orchard": { "rhoillyg-orchard": { saplings: 1 } },
	"aurochs-hunting":  { "aurochs-hunting": { hunters: 1 } },
	"stone-wall":        { "stone-wall": { stone: 1 } },
	"additional-housing": { "additional-housing": { homes: 1 } },
	"golden-sapling":     { "golden-sapling": { sapling: 1 } },
	"harnessing-the-stream": { "harnessing-the-stream": { stream: 1 } },
	"greater-harvest":     { "greater-harvest": { fields: 1 } },
	market:                { market: { traders: 1 } },
	inn:                   { inn: { innkeeper: 1 } },
};

function catalog() {
	const repo = new FakeSteadingImprovementRepository();
	repo._improvements.push(MILL, WATCH, PALISADE, TOWNSHIP, HERD, ORCHARD, AUROCHS, WALL, HOUSING,
		SAPLING, STREAM, GREATER, MARKET, INN);
	return repo;
}

// The four Seasons Change moves, as the pack ships them — the tab draws ONE of these in its turn
// control and hangs each season's own off the wheel, so a fixture without them proves nothing.
const SEASON_MOVE_NAMES = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };

// The procedure each move carries, read from the pack sources themselves. It used to be a copy
// written out here, which drifted the moment the pack changed — autumn's steps were reordered and
// every step gained the move's own words, and this fixture went on asserting the old shape.
// The four moves exactly as the pack authors them — the steps AND the result tiers, because the box
// draws the move's own results and a fixture carrying only half of one would draw half a season.
const SEASON_MOVES = Object.fromEntries(Seasons.all().map(season => [
	season.key,
	JSON.parse(readFileSync(
		path.resolve(process.cwd(), `packs/src/moves/seasons/${season.moveSlug}.json`), "utf8",
	)).system,
]));

function seasonalMoveRepo() {
	const repo = new FakeMoveRepository();
	for (const s of Seasons.all()) {
		repo.addBasic(new FakeCompendiumMoveBuilder()
			.withName(`Seasons Change: ${SEASON_MOVE_NAMES[s.key]}`)
			.withMoveType("seasons")
			.withRollStat("fortunes")
			.withSteps(SEASON_MOVES[s.key].steps)
			.withMoveResults(SEASON_MOVES[s.key].moveResults)
			.build());
	}
	// One homefront move as well, so the tab is exercised with a second move group beside the
	// seasonal one rather than with the seasonal one alone.
	repo.addBasic(new FakeCompendiumMoveBuilder()
		.withName("Pull Together")
		.withMoveType("homefront")
		.withRollStat("prosperity")
		.build());
	// A move an improvement CONFERS. moveType "improvement" keeps it out of every category the
	// steading seeds, which is the point: it is never one of the steading's own moves.
	repo.addBasic(new FakeCompendiumMoveBuilder()
		.withName("Lead the Aurochs Hunt")
		.withMoveType("improvement")
		.withRollStat("defenses")
		.withDescription("When you **_lead the aurochs hunt_**, roll +Defenses.")
		.build());
	return repo;
}

async function makeSheet({ owned = [], season, year, values, turnoverApplied, size } = {}) {
	const actor = new FakeSteadingBuilder().build();
	actor.system.improvements      = owned;
	actor.system.improvementValues = values ?? {};
	if (size !== undefined) actor.system.attributes.size = size;
	if (season !== undefined) actor.system.season = season;
	if (year !== undefined) actor.system.year = year;
	if (turnoverApplied !== undefined) actor.system.turnoverApplied = turnoverApplied;

	const moveRepo = seasonalMoveRepo();
	actor.typedActor = new StonetopSteading(actor, steadingRepos({ improvements: catalog(), moves: moveRepo }));
	// Seeded the way a real steading is, so the promoted move is genuinely resolved off the actor's
	// own owned items rather than handed to the snapshot.
	await actor.typedActor.backfillMoves();
	const sheet = new (createStonetopSteadingSheetClass(stonetopActorSheetBase()))(actor);
	sheet.id = "steading-season";
	sheet.isEditable = true;
	document.body.append(sheet.element);
	return sheet;
}

async function render(sheet, first = false, opts = {}) {
	return renderSheetPart(sheet, renderTemplate(STEADING_TEMPLATE, await sheet._prepareContext({})),
		{ first, ...opts });
}

const act = (sheet, name, target) => {
	const entry = sheet.constructor.DEFAULT_OPTIONS.actions[name];
	return (entry.handler ?? entry).call(sheet, { type: "click", preventDefault() {} }, target);
};

/**
 * Roll `total` on the step's own dice, and honour the modifier the sheet appended to them.
 *
 * What the steading's improvements come to lives INSIDE the expression now — "2d6 + 0" for a town
 * that counts Population one lower and consumes one less — so a fake answering a fixed number
 * whatever it was handed would be testing the dice and none of what the steading built.
 *
 * Only the TRAILING term is read, which is the one `expressionFrom` writes. Everything before it is
 * the step's own dice expression, summer's `1d4-1` included, and `total` is what those came to.
 *
 * Returns the list the calls land in — the formula, and the card each one posted.
 */
const rollsDice = (sheet, total) => {
	const rolled = [];
	sheet.actor.evaluateFormula = async formula => {
		rolled.push({ formula });
		const [, sign, amount] = formula.match(/\s([+-])\s(\d+)$/) ?? [];
		return { total: total + (amount ? Number(`${sign}${amount}`) : 0) };
	};
	sheet.actor.postFormulaCard = async card => { rolled[rolled.length - 1].card = card; };
	return rolled;
};

const statementRows = root => [...root.querySelectorAll(".steading-turnover .steading-statement-line")];
const statementText = root => statementRows(root).map(r => r.textContent.replace(/\s+/g, " ").trim());
const cards        = root => [...root.querySelectorAll(".steading-improvement-card")];
const cardNames    = root => cards(root).map(c => c.querySelector(".steading-improvement-name").textContent.trim());
const pipsOf       = card => [...card.querySelectorAll(".steading-improvement-pip")].map(p => p.classList.contains("is-on"));

beforeEach(() => { document.body.innerHTML = ""; });
afterEach(() => vi.unstubAllGlobals());

/**
 * Answer the advance prompt with `answer`, for one test.
 *
 * Only Foundry's DIALOG is swapped, not the whole `foundry` global — the render pass below reaches
 * through it for the text enricher, and replacing it wholesale takes the enricher with it.
 */
function stubConfirm(answer) {
	const savedApi = foundry.applications.api;
	foundry.applications.api = { ...savedApi, DialogV2: { confirm: async () => answer } };
	afterEach(() => { foundry.applications.api = savedApi; });
}

describe("the season, wherever the ratings are", () => {
	// The band takes its tint from one attribute on the sheet root, so a season with no colour still
	// renders and nothing has to run to keep the two in step.
	it("stamps the season on the sheet root for the band to tint from", async () => {
		const root = await render(await makeSheet({ season: "autumn" }));
		expect(root.querySelector(".sheet-wrapper").dataset.season).toBe("autumn");
		expect(root.querySelector(".steading-season-band")).not.toBeNull();
	});

	// Colour is never the only carrier: the season is also written out on the ledger line.
	it("states the season as text on the ledger line, not only as a tint", async () => {
		const root = await render(await makeSheet({ season: "winter", year: 3 }));
		expect(root.querySelector(".steading-season-line").textContent).toContain("winter");
		expect(root.querySelector(".steading-season-line").textContent).toContain("3");
	});

	// Display is not control. An advance-the-season click reachable from anywhere is a foot-gun on a
	// sheet six people can edit, so the line carries no button at all.
	it("gives the ledger line no way to advance the season", async () => {
		const root = await render(await makeSheet());
		expect(root.querySelector(".steading-season-line button")).toBeNull();
		expect(root.querySelectorAll('[data-action="turnSeason"]')).toHaveLength(1);
	});
});

describe("the season wheel", () => {
	it("draws all four seasons and marks the current one", async () => {
		const root = await render(await makeSheet({ season: "autumn" }));
		const wheel = [...root.querySelectorAll(".steading-wheel-season")];
		expect(wheel).toHaveLength(4);
		expect(wheel.filter(s => s.classList.contains("is-current"))).toHaveLength(1);
		expect(wheel.find(s => s.classList.contains("is-current")).getAttribute("aria-current")).toBe("true");
	});

	it("advances the wheel, and the year when winter passes", async () => {
		const sheet = await makeSheet({ season: "winter", year: 2, owned: ["mill"] });
		stubConfirm(true);
		await render(sheet, true);

		await act(sheet, "turnSeason", null);
		expect([sheet.actor.system.season, sheet.actor.system.year]).toEqual(["spring", 3]);
	});

	// The turn is silent. It used to roll the incoming season's move with it, which put the card out
	// ahead of the steps it is step one of and made "roll Seasons Change again" mean "turn the season
	// again". The wheel moves; the dice are the table's, in the box.
	it("turns the wheel without rolling or posting anything", async () => {
		const sheet = await makeSheet({ season: "autumn" });
		stubConfirm(true);
		await render(sheet, true);

		await act(sheet, "turnSeason", null);
		expect(sheet.actor.system.season).toBe("winter");
		// Every card this tab can post goes out through `rollItem`, so an empty list is the whole of
		// "nothing was posted" here.
		expect(sheet.actor.rolledItems).toEqual([]);
	});

	// Where the roll lives instead: step one of the section the turn just handed the steading. It is
	// the season the box IS, so a turn followed by a roll posts the season the steading is now in.
	it("rolls that season's move from the section that describes it", async () => {
		const sheet = await makeSheet({ season: "autumn" });
		stubConfirm(true);
		await render(sheet, true);
		await act(sheet, "turnSeason", null);

		const root = await render(sheet);
		const die  = root.querySelector(".steading-season-box .move-rollable");
		expect(die.dataset.moveSlug).toBe("seasons-change-winter");

		await sheet.actor.typedActor.rollMoveBySlug(die.dataset.moveSlug);
		expect(sheet.actor.rolledItems.map(r => r.item.system.slug)).toEqual(["seasons-change-winter"]);
		expect(sheet.actor.system.season).toBe("winter");
	});

	it("rolls nothing when the prompt is declined", async () => {
		const sheet = await makeSheet({ season: "autumn" });
		stubConfirm(false);
		await render(sheet, true);

		await act(sheet, "turnSeason", null);
		expect(sheet.actor.rolledItems).toEqual([]);
	});

	// One control, not two: there is no abstract "advance" anywhere on the sheet beside the roll.
	it("offers exactly one control that turns the season", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		expect(root.querySelectorAll('[data-action="turnSeason"]')).toHaveLength(1);
		expect(root.querySelectorAll('[data-action="advanceSeason"]')).toHaveLength(0);
	});

	// The box is the season the steading is IN, so it holds THAT season's move. What this replaced
	// was a separate "The other seasons" list — three full rows spending a screen of height on
	// reference, numbered by an `ol` nobody had written a rule for.
	it("puts the current season's move in the box", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		expect(root.querySelector(".steading-season-box").textContent).toContain("Seasons Change: Spring");
		expect(root.querySelector(".steading-others-list")).toBeNull();
	});

	// The wheel says what time of year it is and nothing else. It used to hang each season's whole
	// move off its segment, which made a control of a label and put the four moves on one tab.
	it("carries no control at all — it states the year", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		const wheel = root.querySelector(".steading-wheel");
		expect(wheel.querySelectorAll("button")).toHaveLength(0);
		expect(wheel.querySelectorAll("[data-action]")).toHaveLength(0);
		expect(root.querySelector(".steading-wheel-move")).toBeNull();
	});

	// The same move is drawn on the tab and in the rail, and the two must not mint the same region
	// id, or one disclosure would drive whichever the document found first.
	it("mints no id twice across the sheet", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		const ids  = [...root.querySelectorAll("[id]")].map(e => e.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

// The four Seasons Change moves are the steading's own moves, so they are read where its moves are
// read: the rail, beside the homefront ones, on every tab — not hung off a wheel segment on the one
// tab the wheel is drawn on.
describe("the rail's seasonal moves", () => {
	const railGroup = (root, title) => [...root.querySelectorAll(".steading-rail .stonetop-move-group")]
		.find(g => g.querySelector(".stonetop-move-group-title")?.textContent.includes(title));

	it("lists all four, spring to winter, under Seasonal Moves", async () => {
		const root  = await render(await makeSheet({ season: "autumn" }));
		const group = railGroup(root, "Seasonal Moves");
		const names = [...group.querySelectorAll(".stonetop-item-name")].map(n => n.textContent.trim());
		expect(names).toEqual([
			"Seasons Change: Spring", "Seasons Change: Summer",
			"Seasons Change: Autumn", "Seasons Change: Winter",
		]);
	});

	// Shut to begin with, like every other rail row: six moves printed in full is a column nobody
	// can read past.
	it("draws each as a disclosure row, shut, over its own region", async () => {
		const root     = await render(await makeSheet({ season: "spring" }));
		const controls = [...railGroup(root, "Seasonal Moves").querySelectorAll("[aria-controls]")];
		expect(controls).toHaveLength(4);
		expect(new Set(controls.map(c => c.getAttribute("aria-controls"))).size).toBe(4);
		for (const control of controls) {
			expect(control.getAttribute("aria-expanded")).toBe("false");
			expect(root.querySelector(`#${control.getAttribute("aria-controls")}`).hidden).toBe(true);
		}
	});

	// Reference is about WEIGHT, not capability: a table that wants to roll a season's move on its
	// own terms is not something the sheet should decide it cannot. Every rendering of a move goes
	// through the same row, so every rendering rolls and posts to chat.
	it("keeps every season's move rollable and postable, as the box's is", async () => {
		const root  = await render(await makeSheet({ season: "spring" }));
		const group = railGroup(root, "Seasonal Moves");
		expect(group.querySelectorAll(".move-rollable")).toHaveLength(4);
		expect(group.querySelectorAll('[data-action="moveToChat"]')).toHaveLength(4);
		expect(root.querySelector(".steading-season-box .move-rollable")).not.toBeNull();
	});

	// A steading has all four from the day it exists, so the acquisition tick asserts a state that
	// does not exist — and costs a column of a 220px rail.
	it("offers no acquisition tick, exactly as the homefront group does not", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		expect(railGroup(root, "Seasonal Moves").querySelectorAll(".stonetop-item-check")).toHaveLength(0);
		expect(railGroup(root, "Homefront Moves").querySelectorAll(".stonetop-item-check")).toHaveLength(0);
	});

	it("leaves the homefront moves rollable too", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		expect(railGroup(root, "Homefront Moves").querySelectorAll(".move-rollable").length).toBeGreaterThan(0);
	});
});

// The tab used to split one season across two blocks: a "Turn to <next>" disclosure holding the
// INCOMING season's numbered steps, and a "During <current>" section holding the gain in force, the
// turnover checklist and the adjustments. So the list and everything it produced were never the same
// season, and the box could be headed "Winter" over a line reading "Autumn, year 3".
describe("the season tab's one box", () => {
	it("is the season the steading is in, open, with that season's move", async () => {
		const root = await render(await makeSheet({ season: "autumn" }));
		const box  = root.querySelector(".steading-season-box");
		expect(box.dataset.season).toBe("autumn");
		expect(box.querySelector(".steading-season-box-title").textContent)
			.toContain("Seasons Change: Autumn");
		expect(root.querySelector('[data-action="toggleTurn"]')).toBeNull();
	});

	// Turning the wheel is still one act and one control — it just names the season it brings rather
	// than heading the whole tab with a season the steading is not in yet.
	it("names the season the control brings, not the one the box is", async () => {
		const root    = await render(await makeSheet({ season: "autumn" }));
		const advance = root.querySelector('[data-action="turnSeason"]');
		// The harness leaves a nested {{localize}} as its key, so the season is asserted by key.
		expect(advance.textContent).toContain("names.winter");
		expect(root.querySelector(".steading-season-stated").textContent).toContain("names.autumn");
	});

	// What the season owes now sits under the steps that describe that same season — which is what
	// made the adjustments reach the right step at last (they were built for the current season all
	// along, beside a list drawn for the next one).
	it("puts what this season owes under this season's steps, in the same box", async () => {
		const root = await render(await makeSheet({
			season: "autumn", owned: ["rhoillyg-orchard"], values: BUILT["rhoillyg-orchard"],
		}));
		const box = root.querySelector(".steading-season-box");
		expect(box.querySelector(".steading-during-owed .steading-during-label").textContent)
			.toContain("names.autumn");
		expect(box.querySelector(".steading-turnover")).not.toBeNull();
		// The orchard's harvest is inside autumn's fourth step, which is the harvest.
		expect(box.querySelectorAll(".steading-turn-step")[3].textContent).toContain("the orchard yields");
		expect(box.innerHTML.indexOf("steading-turn-steps"))
			.toBeLessThan(box.innerHTML.indexOf("steading-during-owed"));
		expect(root.querySelector(".steading-during")).toBeNull();
	});

	// A move ROW, addressed by the move it draws: the row itself carries the owned id, and the slug is
	// on the die inside it.
	const moveRowFor = (root, slug) => [...root.querySelectorAll(".stonetop-item")]
		.find(row => row.querySelector(`[data-move-slug="${slug}"]`));

	// The move's full text ran into the numbered list it introduced, and was not what anyone had the
	// tab open to read. It is not in the box at all now — it is in the rail, shut, with the other
	// three. The box is that same move as steps.
	it("leaves the move's own text to the rail and keeps no row of its own", async () => {
		const root = await render(await makeSheet({ season: "autumn" }));
		const box  = root.querySelector(".steading-season-box");
		const rail = root.querySelector(".steading-rail");

		expect(moveRowFor(rail, "seasons-change-autumn")).not.toBeUndefined();

		// Rows for moves an IMPROVEMENT confers do belong in the box — this is about the season's own
		// move, which the box states as steps and the rail states as words.
		expect(moveRowFor(box, "seasons-change-autumn")).toBeUndefined();
		expect(box.querySelector(".steading-turn-steps")).not.toBeNull();
	});
});

// Twenty-plus rows, three state chips, and no way to type "mill".
describe("searching the improvement board", () => {
	const typeInto = (root, value) => {
		const input = root.querySelector(".steading-board-search");
		input.value = value;
		input.dispatchEvent(new window.Event("input", { bubbles: true }));
		return input;
	};

	const visibleCards = root => cards(root).filter(c => !c.hidden);

	it("narrows the board to the cards that answer what was typed", async () => {
		const sheet = await makeSheet({ owned: ["mill", "palisade"] });
		const root  = await render(sheet, true);
		expect(visibleCards(root).length).toBe(2);

		typeInto(root, "mill");
		expect(visibleCards(root).map(c => c.dataset.slug ?? c.textContent.trim().slice(0, 4)))
			.toHaveLength(1);
	});

	// Filtering writes nothing: what you are looking for is a fact about you, not about the steading,
	// and a document update per keystroke would re-render every other client at the table.
	it("writes nothing to the actor", async () => {
		const sheet = await makeSheet({ owned: ["mill", "palisade"] });
		const root  = await render(sheet, true);
		const before = JSON.stringify(sheet.actor.system);
		typeInto(root, "mill");
		expect(JSON.stringify(sheet.actor.system)).toBe(before);
	});

	// Core rebuilds the part's DOM on every render, which takes the typed query with it.
	it("survives a re-render, query and all", async () => {
		const sheet = await makeSheet({ owned: ["mill", "palisade"] });
		let root    = await render(sheet, true);
		typeInto(root, "mill");

		root = await render(sheet);
		expect(root.querySelector(".steading-board-search").value).toBe("mill");
		expect(visibleCards(root)).toHaveLength(1);
	});
});

// The tab drew ONE procedure — roll it, pick 1 seasonal gain, reset Fortunes — which is Spring's,
// and wrong for the other three. It draws the move of the season the steading is IN, so the season
// asked for below is the season whose steps are expected.
describe("each season's own procedure", () => {
	// A step's line is the move's own words where it has them, and the generic label only where it
	// does not — so the line is read from whichever the step rendered.
	const stepsOf = root => [...root.querySelectorAll(".steading-turn-step")]
		.map(li => (li.querySelector(".steading-turn-text") ?? li.querySelector(".steading-turn-label"))
			?.textContent.replace(/\s+/g, " ").trim() ?? "");

	it("draws spring's three steps", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		expect(stepsOf(root)).toHaveLength(3);
	});

	// Winter is two rolls with a choice between them, and a generation step summer has that it does
	// not. Order is DATA now, so the tab draws what winter's move actually says.
	it("draws winter's five, in winter's order", async () => {
		const root  = await render(await makeSheet({ season: "winter" }));
		const steps = stepsOf(root);
		expect(steps).toHaveLength(5);
		expect(steps[0]).toContain("1d4+Population");
		expect(steps[1]).toContain("consumes");
	});

	it("draws summer's generation step, which no other season has", async () => {
		const root = await render(await makeSheet({ season: "summer" }));
		expect(stepsOf(root).join(" ")).toContain("1d4-1");
	});

	// The steps say what the move says. "Roll it" and "Roll 1d4" dropped the trigger, the roller and
	// winter's Meet with Disaster clause — the whole reason the list read as a stub of the move.
	it("gives each step the move's own words", async () => {
		const root = await render(await makeSheet({ season: "winter" }));
		const steps = stepsOf(root);
		expect(steps[0]).toContain("whoever is weariest");
		expect(steps[1]).toContain("Meet with Disaster");
	});

	// Winter's opening roll had no control at all: the panel's one button rolled +Fortunes, which is
	// the FOURTH thing winter does.
	it("gives winter's 1d4+Population roll its own control", async () => {
		const root = await render(await makeSheet({ season: "winter" }));
		const die  = root.querySelector('[data-action="rollSeasonStep"]');
		expect(die.dataset.step).toBe("0");
		expect(die.closest(".steading-turn-step").textContent).toContain("1d4+Population");
	});

	// Rolled as the steading, adding the rating at its current value — through the same resolveBonus
	// every other roll on this sheet goes through.
	it("rolls it as the steading, with Population added", async () => {
		const sheet = await makeSheet({ season: "winter" });
		sheet.actor.system.attributes.population = 2;
		const root  = await render(sheet, true);
		const rolled = [];
		sheet.actor.evaluateFormula = async formula => { rolled.push({ formula }); return { total: 2 }; };
		sheet.actor.postFormulaCard = async () => {};

		await act(sheet, "rollSeasonStep", root.querySelector('[data-action="rollSeasonStep"]'));
		expect(rolled[0].formula).toBe("1d4 + 2");
	});

	/**
	 * "In winter, the village consumes 1d4 + Population. If Stonetop has shrunk to a hamlet, it
	 * consumes only 1d2 + Population. If it has grown to a town, it consumes 2d6 + Population."
	 *
	 * The dice follow the Size. They used to follow the Township improvement, which says the same
	 * thing on its own page — so a steading that shrank to a hamlet had nothing saying so.
	 */
	it("rolls the dice this steading's size calls for, and says which size", async () => {
		const sheet = await makeSheet({ season: "winter", size: "town" });
		sheet.actor.system.attributes.population = 2;
		const root = await render(sheet, true);
		const step = root.querySelector(".steading-turn-step");
		expect(step.querySelector(".steading-turn-size").textContent).toContain("2d6");
		expect(step.querySelector('[data-action="rollSeasonStep"]').textContent).toContain("2d6");

		const rolled = [];
		sheet.actor.evaluateFormula = async formula => { rolled.push(formula); return { total: 5 }; };
		sheet.actor.postFormulaCard = async () => {};
		await act(sheet, "rollSeasonStep", step.querySelector('[data-action="rollSeasonStep"]'));
		expect(rolled[0]).toBe("2d6 + 2");
	});

	// A village rolls what winter's own line already names, so nothing is said twice.
	it("says nothing of size where the size changes nothing", async () => {
		const root = await render(await makeSheet({ season: "winter", size: "village" }));
		expect(root.querySelector(".steading-turn-size")).toBeNull();
		expect(root.querySelector('[data-action="rollSeasonStep"]').closest(".steading-turn-step").textContent)
			.toContain("1d4+Population");
	});

	// A season with no dice of its own offers no such control — spring's steps are all the move's own.
	it("offers no formula roll in a season that calls for none", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		expect(root.querySelector('[data-action="rollSeasonStep"]')).toBeNull();
	});

	// Summer's "generates 1d4-1 Surplus" and autumn's "roll 1d4" at the harvest name dice too, and
	// had no control until the step said so in the book's own words and the gap became visible.
	it("gives summer's generation and autumn's harvest their dice too", async () => {
		const summer = await render(await makeSheet({ season: "summer" }));
		expect(summer.querySelector('[data-action="rollSeasonStep"]').dataset.step).toBe("2");

		const autumn = await render(await makeSheet({ season: "autumn" }));
		expect(autumn.querySelector('[data-action="rollSeasonStep"]').dataset.step).toBe("3");
	});

	// Winter's 7-9 and 6- each consume a SECOND 1d4+Population. It was prose in the middle of the
	// step's line — no control, no record, no undo — beside an opening consumption that had all three.
	it("draws the move's results as rows, and rolls the one that costs a second consumption", async () => {
		const sheet = await makeSheet({ season: "winter" });
		sheet.actor.system.attributes.surplus    = 6;
		sheet.actor.system.attributes.population = 2;
		const root = await render(sheet, true);

		const tiers = [...root.querySelectorAll(".stonetop-result-row")];
		expect(tiers.map(t => t.querySelector(".stonetop-result-notation").textContent.trim()))
			.toEqual(["10+", "7-9", "6-"]);
		expect(tiers[1].textContent).toContain("consume additional Surplus equal to 1d4+Population");

		// A mild winter costs nothing; the two that do carry the control.
		expect(tiers[0].querySelector('[data-action="rollSeasonStep"]')).toBeNull();
		const roll = tiers[1].querySelector('[data-action="rollSeasonStep"]');
		expect(roll.dataset.step).toBe("3:partial");

		sheet.actor.evaluateFormula = async () => ({ total: 4 });
		sheet.actor.postFormulaCard = async () => {};
		await act(sheet, "rollSeasonStep", roll);
		expect(sheet.actor.system.attributes.surplus).toBe(2);
		// Recorded against its own tier, so winter's opening consumption is still to roll.
		expect(sheet.actor.system.seasonStepsApplied["3:partial"].total).toBe(4);
		expect(sheet.actor.system.seasonStepsApplied["0"]).toBeUndefined();
	});

	// What the move came up is the steading's own record, so the row the dice landed on is lit on
	// every screen the sheet is open on — and only that row.
	it("lights the result the season's own move rolled", async () => {
		const sheet = await makeSheet({ season: "winter" });
		await sheet.actor.typedActor.recordMoveOutcome("seasons-change-winter",
			{ key: "partial", label: "Weak Hit" });

		const root = await render(sheet, true);
		expect(root.querySelector(".stonetop-result-row--partial").classList).toContain("is-rolled");
		expect(root.querySelector(".stonetop-result-row--success").classList).not.toContain("is-rolled");
		expect(root.querySelector(".stonetop-result-row--partial").getAttribute("aria-current")).toBe("true");
	});

	// Another move's roll says nothing about which of winter's three results the steading is living
	// with, and the aurochs hunt is rolled from this very tab.
	it("lights nothing when the move rolled was not the season's", async () => {
		const sheet = await makeSheet({ season: "winter" });
		await sheet.actor.typedActor.recordMoveOutcome("lead-the-aurochs-hunt",
			{ key: "success", label: "Strong Hit!" });

		const root = await render(sheet, true);
		expect(root.querySelector(".is-rolled")).toBeNull();
	});

	// Turning the wheel ends the season that was rolled, and the result goes with it.
	it("puts the light out when the wheel turns", async () => {
		const sheet = await makeSheet({ season: "winter" });
		await sheet.actor.typedActor.recordMoveOutcome("seasons-change-winter",
			{ key: "failure", label: "Miss" });
		stubConfirm(true);
		await render(sheet, true);

		await act(sheet, "turnSeason", null);
		expect((await render(sheet)).querySelector(".is-rolled")).toBeNull();
	});

	// Rolling MOVES Surplus, so the row then says what it did and offers to give it back.
	it("gives back what a result's roll took", async () => {
		const sheet = await makeSheet({ season: "winter" });
		sheet.actor.system.attributes.surplus = 6;
		let root = await render(sheet, true);
		sheet.actor.evaluateFormula = async () => ({ total: 4 });
		sheet.actor.postFormulaCard = async () => {};
		await act(sheet, "rollSeasonStep", root.querySelector('[data-step="3:partial"]'));

		root = await render(sheet);
		const tier = [...root.querySelectorAll(".stonetop-result-row")][1];
		expect(tier.textContent).toContain("Consumed 4 Surplus");
		await act(sheet, "revertSeasonStep", tier.querySelector('[data-action="revertSeasonStep"]'));
		expect(sheet.actor.system.attributes.surplus).toBe(6);
	});

	// Spring, summer and autumn state their results too — the tier sentence used to sit on the PICK
	// step, describing the roll from under the wrong line — but none of them costs a roll.
	it.each(["spring", "summer", "autumn"])("draws %s's results without offering a roll on any", async season => {
		const root  = await render(await makeSheet({ season }));
		const tiers = [...root.querySelectorAll(".stonetop-result-row")];
		expect(tiers).toHaveLength(3);
		expect(tiers.some(t => t.querySelector('[data-action="rollSeasonStep"]'))).toBe(false);
	});

	// The move's own roll gets no button in the box: it has already happened — it is what brought the
	// steading into this season — and the advance control below the box is what performed it.
	it("offers exactly one control that rolls the season's move, and it is the advance", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		const steps = root.querySelector(".steading-turn-steps");
		expect(steps.querySelector('[data-action="turnSeason"]')).toBeNull();
		expect(root.querySelectorAll('[data-action="turnSeason"]')).toHaveLength(1);
	});
});

// The user, on the old layout: "'pick 1 from what winter takes' is the wrong place to say that", and
// "the picking of the content should be inline in the seasons change box". The pick step used to
// render a note pointing at a "During <season>" block further down the tab.
//
// It can only be inline because the box is the CURRENT season's: spring, summer and autumn all write
// the same `seasonal-gains` group and turning the wheel clears it, so a picker inside a box headed
// "Turn to Summer" would have shown spring's gain, invited a change, and then been wiped by the roll.
describe("the season's pick, in the step that calls for it", () => {
	const pickIn = root => root.querySelector(".steading-turn-step .steading-turn-pick");

	it("offers winter the losses its move names, not the seasonal gains", async () => {
		const root = await render(await makeSheet({ season: "winter" }));
		expect(pickIn(root).textContent).toContain("Reduce Population by 1");
		expect(pickIn(root).textContent).not.toContain("Population boom");
	});

	it("offers spring the seasonal gains", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		expect(pickIn(root).textContent).toContain("Population boom");
	});

	// The pick renders in the step, and nowhere else — a second copy on the tab would be two places
	// to tick one choice.
	it("draws the choice once, inside the steps", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		expect(root.querySelectorAll(".steading-turn-pick")).toHaveLength(1);
		expect(root.querySelector(".steading-during-gain")).toBeNull();
	});

	// The wiring claim, and the reason this is an integration test: a tick inside the box has to reach
	// the actor through the shared choice machinery — ChoiceGroupWiring on the sheet root, the
	// steading's ChoiceStores, SteadingChoices' controller — none of which a unit test over a mocked
	// repo would exercise. The picker was in a different block until now, so nothing proved it still
	// wrote from here.
	it("writes a gain picked inside the box through to the steading", async () => {
		const sheet = await makeSheet({ season: "spring" });
		const root  = await render(sheet, true);
		const tick  = root.querySelector(".steading-turn-pick input.stonetop-cg-pick");
		expect(tick).not.toBeNull();
		expect(tick.dataset.cgContext).toBe("steading");
		expect(tick.dataset.cgGroup).toBe("seasonal-gains");

		tick.checked = true;
		tick.dispatchEvent(new root.ownerDocument.defaultView.Event("change", { bubbles: true }));
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(JSON.stringify(sheet.actor.system.choiceValues ?? {}))
			.toContain(tick.dataset.cgOption);
	});
});

// Every result appears exactly ONCE, in a section whose heading states its trigger in the book's
// words. The row says only WHAT IT DOES and WHICH improvement it came from.
//
// What this replaced: a heading that named the SOURCE of every row ("Because of what Stonetop has
// built") over rows that each re-opened with the trigger the heading had not stated — so the part
// that differed between rows was buried behind a clause they all shared.
describe("the season's results, stated once", () => {
	// The market's conditional Surplus is what the general list still holds: everything the sheet can
	// write is shown where it happens, and a heading over an empty list is not drawn at all.
	const winterSteading = () => makeSheet({
		season: "winter",
		owned: ["standing-watch", "stone-wall", "additional-housing", "market"],
		values: {
			...BUILT["standing-watch"], ...BUILT["stone-wall"], ...BUILT["additional-housing"],
			...BUILT.market,
		},
	});

	it("heads the season's results with WHEN they fire, not with where they came from", async () => {
		const root = await render(await winterSteading());
		const head = root.querySelector(".steading-during-owed .steading-during-label");
		expect(head.textContent).toContain("When");
		expect(head.textContent).toContain("names.winter");
		expect(head.textContent).not.toContain("Because of what Stonetop has built");
	});

	// Source in one column, result in the other.
	it("splits each row into the improvement and what it does", async () => {
		const root = await render(await makeSheet({
			season: "autumn", owned: ["standing-watch"], values: BUILT["standing-watch"],
		}));
		const row = root.querySelector(".steading-upkeep .steading-statement-line");
		expect(row.querySelector(".steading-statement-source").textContent).toBe("Standing Watch");
		expect(row.querySelector(".steading-statement-clause").textContent.trim())
			.toBe("the watch consumes 1 Surplus or it disbands");
	});

	// Exactly once: a result shown against the step it bends is not also a line in the general list.
	it("does not also list an adjustment among the season's results", async () => {
		const root = await render(await winterSteading());
		const owed = root.querySelector(".steading-during-owed")?.textContent ?? "";
		expect(owed).not.toContain("consumes 1 less Surplus than normal");
		expect(owed).not.toContain("consider Population to be 1 lower");
	});

	// Never a control: an adjustment changes an arithmetic the sheet does not perform.
	it("offers no control on an adjustment", async () => {
		const root = await render(await winterSteading());
		const step = root.querySelectorAll(".steading-turn-step")[0];
		expect(step.querySelectorAll('[data-action="applyEffectLine"]')).toHaveLength(0);
	});

	// A heading over nothing would read as a step this steading does differently when it does not.
	it("shows no step heading in a season nothing bends", async () => {
		const root = await render(await makeSheet({
			season: "autumn", owned: ["mill"], values: BUILT.mill,
		}));
		expect(root.querySelector(".steading-adjustments")).toBeNull();
	});

	// The improvement's OWN card is the one place that states its whole payoff, so it keeps the
	// adjustment inline — there is no step there to collect it under.
	it("keeps the adjustment on the improvement's own card", async () => {
		const root = await render(await winterSteading());
		const card = [...root.querySelectorAll(".steading-improvement-card")]
			.find(c => c.textContent.includes("Stone Wall"));
		expect(card.textContent).toContain("consumes 1 less Surplus than normal");
	});
});

// The third of the user's complaints about the tab: it "isn't content aware of improvements that
// modify it". Five improvements bend winter's consumption and every one used to sit in a list headed
// "when the steading consumes Surplus", nowhere near the step that consumes — and the step's own
// control rolled a hardcoded 1d4+Population whatever the steading had built.
describe("a season's steps, bent by what the steading built", () => {
	const rolling = async (sheet, total) => ({
		root: await render(sheet, true), rolled: rollsDice(sheet, total),
	});

	const stepOne = root => root.querySelectorAll(".steading-turn-step")[0];

	// "roll 2d6+Population to consume Surplus, instead of 1d4+Population" — and the control says
	// which improvement did it, because a table looking at dice the book does not name needs to know.
	it("rolls the dice a township replaced them with, and names it", async () => {
		const sheet = await makeSheet({ season: "winter", owned: ["township"], values: BUILT.township });
		sheet.actor.system.attributes.population = 2;
		const { root, rolled } = await rolling(sheet, 5);
		// The book's own sentence, under the step, attributed — and the dice it describes on the
		// control, which is what says the sheet took it at its word.
		const bend = stepOne(root).querySelector(".steading-effect-lines .steading-statement-line");
		expect(bend.querySelector(".steading-statement-source").textContent).toBe("Township");
		expect(bend.textContent).toContain("instead of 1d4+Population");
		expect(stepOne(root).querySelector('[data-action="rollSeasonStep"]').textContent)
			.toContain("2d6");

		await act(sheet, "rollSeasonStep", root.querySelector('[data-action="rollSeasonStep"]'));
		expect(rolled[0].formula).toBe("2d6 + 2");
	});

	// Three improvements bending one step, each stating itself in the book's own sentence, and the
	// control rolling what they come to. The sheet used to print its own summary of them instead —
	// "Rolls 2d6 + Population, counted −1 — Additional Housing, Township" — which said neither which
	// improvement did which nor what was counted −1.
	it("lists every bend on the step, in the book's words, with its source", async () => {
		const sheet = await makeSheet({
			season: "winter",
			owned: ["township", "additional-housing", "stone-wall"],
			values: { ...BUILT.township, ...BUILT["additional-housing"], ...BUILT["stone-wall"] },
		});
		const { root } = await rolling(sheet, 4);
		const rows = [...stepOne(root).querySelectorAll(".steading-effect-lines .steading-statement-line")];
		expect(rows.map(r => r.querySelector(".steading-statement-source").textContent))
			.toEqual(["Township", "Additional Housing", "Stone Wall"]);
		expect(stepOne(root).textContent).not.toContain("counted");
	});

	// "consider Population to be 1 lower than it is" — the formula is the book's; what changes is
	// what Population counts as inside it.
	it("counts a rating as additional housing leaves it", async () => {
		const sheet = await makeSheet({
			season: "winter", owned: ["additional-housing"], values: BUILT["additional-housing"],
		});
		sheet.actor.system.attributes.population = 2;
		const { root, rolled } = await rolling(sheet, 3);
		await act(sheet, "rollSeasonStep", root.querySelector('[data-action="rollSeasonStep"]'));
		expect(rolled[0].formula).toBe("1d4 + 1");
	});

	// A different hook — the book takes it off after the roll — but the sheet puts it in the dice, so
	// the total the table watches is the Surplus that leaves the stores.
	it("rolls what a stone wall pays, rather than quietly paying less than it rolled", async () => {
		const sheet = await makeSheet({
			season: "winter", owned: ["stone-wall"], values: BUILT["stone-wall"],
		});
		sheet.actor.system.attributes.surplus = 8;
		const { root, rolled } = await rolling(sheet, 6);
		// The book's own sentence still reads under the step, unsummarised.
		expect(stepOne(root).querySelector(".steading-turn-results").textContent)
			.toContain("consumes 1 less Surplus than normal");
		// And the control names the dice, because they are no longer the ones the line above gave.
		const control = stepOne(root).querySelector('[data-action="rollSeasonStep"]').textContent;
		expect(control).toContain("1d4");
		expect(control).toContain("\u2212 1");

		await act(sheet, "rollSeasonStep", root.querySelector('[data-action="rollSeasonStep"]'));
		expect(rolled[0].formula).toBe("1d4 - 1");
		// The dice said 6, so the roll came to 5 — and 5 is what was consumed.
		expect(sheet.actor.system.attributes.surplus).toBe(3);
	});

	// What the user reported: a town that counts Population one lower and consumes one less rolls
	// 2d6 + Population − 2, in one formula, and nothing is taken off afterwards.
	it("rolls both bends as one formula", async () => {
		const sheet = await makeSheet({
			season: "winter", owned: ["stone-wall", "additional-housing"],
			values: { ...BUILT["stone-wall"], ...BUILT["additional-housing"] }, size: "town",
		});
		sheet.actor.system.attributes.population = 2;
		sheet.actor.system.attributes.surplus    = 9;
		const { root, rolled } = await rolling(sheet, 7);
		const control = stepOne(root).querySelector('[data-action="rollSeasonStep"]').textContent;
		expect(control).toContain("2d6");
		expect(control).toContain("\u2212 2");

		await act(sheet, "rollSeasonStep", root.querySelector('[data-action="rollSeasonStep"]'));
		expect(rolled[0].formula).toBe("2d6 + 0");
		expect(sheet.actor.system.attributes.surplus).toBe(2);
	});

	// And it says so afterwards in ONE number: there is no longer a rolled total to reconcile against
	// what was paid, because the roll IS what was paid.
	it("says what it paid, with no second number to reconcile", async () => {
		const sheet = await makeSheet({
			season: "winter", owned: ["stone-wall"], values: BUILT["stone-wall"],
		});
		sheet.actor.system.attributes.surplus = 8;
		const { root } = await rolling(sheet, 6);
		await act(sheet, "rollSeasonStep", root.querySelector('[data-action="rollSeasonStep"]'));

		const after = await render(sheet, true);
		const said  = stepOne(after).querySelector(".stonetop-applied").textContent;
		expect(said).toContain("Consumed 5 Surplus (8 → 3)");
		expect(said).not.toContain("was rolled");
	});

	// Nothing hangs on a step no season of this steading has: the sapling generates +1 whenever the
	// steading generates at all, and winter generates nothing.
	it("keeps a bend with no step of its own in the general list", async () => {
		const root = await render(await makeSheet({
			season: "winter", owned: ["golden-sapling"], values: BUILT["golden-sapling"],
		}));
		expect(root.querySelector(".steading-adjustments").textContent)
			.toContain("it generates +1 Surplus");
	});

	it("hangs it on the generation step in a season that has one", async () => {
		const root = await render(await makeSheet({
			season: "summer", owned: ["golden-sapling"], values: BUILT["golden-sapling"],
		}));
		expect(root.querySelector(".steading-adjustments")).toBeNull();
		expect(root.querySelectorAll(".steading-turn-step")[2].textContent)
			.toContain("it generates +1 Surplus");
	});

	// "if you roll a 7+ with Fortunes" — a fact about the move's own roll, so it belongs inside the
	// RESULTS of that roll rather than floating in a list beside the season. A 7+ is two of them.
	it("hangs what waits on the season's roll inside the results it waits on", async () => {
		const root = await render(await makeSheet({
			season: "winter", owned: ["harnessing-the-stream"], values: BUILT["harnessing-the-stream"],
		}));
		const tiered = root.querySelectorAll(".steading-turn-step")[3];
		const rowFor = key => tiered.querySelector(`.stonetop-result-row--${key}`).textContent;
		expect(rowFor("success")).toContain("Harnessing the Stream");
		expect(rowFor("partial")).toContain("Harnessing the Stream");
		expect(rowFor("failure")).not.toContain("Harnessing the Stream");
		// The row is the condition; stating it again inside the row would be saying it twice.
		expect(tiered.textContent).not.toContain("you roll a 7+ with Fortunes");
		expect(root.querySelector(".steading-during-owed")?.textContent ?? "")
			.not.toContain("Harnessing the Stream");
	});
});

// The steading's own bills — the watch's Surplus "or it disbands", the militia's week of practice.
// Nothing in Seasons Change says any of it, so they are not among the move's numbered steps; and they
// are not payouts either, so they are not in the list of what the season owes.
describe("what the steading keeps up", () => {
	const watching = () => makeSheet({
		season: "winter", owned: ["standing-watch"], values: BUILT["standing-watch"],
	});

	it("gives the steading's own bills a section outside the numbered steps", async () => {
		const root = await render(await watching());
		const upkeep = root.querySelector(".steading-upkeep");
		expect(upkeep.textContent).toContain("Standing Watch");
		expect(upkeep.closest(".steading-turn-step")).toBeNull();
		expect(root.querySelector(".steading-during-owed")?.textContent ?? "")
			.not.toContain("or it disbands");
	});

	// Moved, not disowned: it is still one of the season's automatic lines, so it keeps its own
	// control and the season's Apply still writes it.
	it("keeps its control, and writes what it says", async () => {
		const sheet = await watching();
		sheet.actor.system.attributes.surplus = 4;
		const root = await render(sheet, true);
		const apply = root.querySelector('.steading-upkeep [data-action="applyEffectLine"]');
		expect(apply).not.toBeNull();

		await act(sheet, "applyEffectLine", apply);
		expect(sheet.actor.system.attributes.surplus).toBe(3);
	});
});

// Autumn's move ends "when the harvest is complete, roll 1d4; the steading generates that much
// Surplus" — the book's own half of a moment improvements also fire at.
describe("a moment's own half", () => {
	const momentOf = (root, key) => root.querySelector(`.steading-moment[data-moment="${key}"]`);
	// The step the moment's own improvements are folded into. Found by the words rather than by
	// position: a steading that also GENERATES in autumn is given a step of its own for that, and
	// every step after it shifts down one.
	const harvestStep = root => [...root.querySelectorAll(".steading-turn-step")]
		.find(step => step.textContent.includes("the harvest is complete"));

	// The season's own half and the steading's are ONE step now: autumn's fourth step is the harvest,
	// and what the orchard adds to it is read there rather than in a panel below the list.
	it("states the steading's half inside the step that is the moment", async () => {
		const root = await render(await makeSheet({
			season: "autumn", owned: ["rhoillyg-orchard"], values: BUILT["rhoillyg-orchard"],
		}));
		const harvest = harvestStep(root);
		expect(harvest.textContent).toContain("the harvest is complete");
		const sources = [...harvest.querySelectorAll(".steading-statement-source")].map(e => e.textContent);
		expect(sources).toEqual(["Rhoillyg Orchard"]);
		expect(momentOf(root, "autumn-harvest")).toBeNull();
	});

	// Spring's hunt is not something spring's move calls for — it exists only because Aurochs Hunting
	// granted it. A row sourced to "the season itself" there would be an invention.
	it("says nothing for a moment the season's own move does not call for", async () => {
		const root = await render(await makeSheet({
			season: "spring", owned: ["aurochs-hunting"], values: BUILT["aurochs-hunting"],
		}));
		const hunt = momentOf(root, "aurochs-hunt");
		expect(hunt.textContent).not.toContain("stonetop.steading.seasons.theSeason");
	});
});

// Twenty-plus rows in the order the steading owns them, and nothing saying which of them the table
// is about to need. The board answers that WITHOUT moving anything: the card that becomes owed is the
// card someone just ticked the last box of, with the cursor still on it.
describe("the board says what needs attention", () => {
	const attentionOn = card => card.querySelector(".steading-improvement-attention")?.textContent ?? null;
	const cardNamed   = (root, name) => cards(root).find(c => c.textContent.includes(name));

	it("marks a finished improvement that still owes the steading something", async () => {
		const root = await render(await makeSheet({ owned: ["mill"], values: BUILT.mill }));
		expect(attentionOn(cardNamed(root, "Mill"))).toBe("stonetop.steading.improvements.owed");
	});

	// Once taken, the card has nothing left to ask for.
	it("stops marking it once what it owed has been applied", async () => {
		const sheet = await makeSheet({ owned: ["mill"], values: BUILT.mill });
		let root = await render(sheet, true);
		for (const btn of root.querySelectorAll('.steading-improvement-card [data-action="applyEffectLine"]')) {
			await act(sheet, "applyEffectLine", btn);
		}
		root = await render(sheet);
		expect(attentionOn(cardNamed(root, "Mill"))).not.toBe("stonetop.steading.improvements.owed");
	});

	it("marks what fires in the season the steading is in", async () => {
		const root = await render(await makeSheet({
			season: "summer", owned: ["herd-of-horses"], values: BUILT["herd-of-horses"],
		}));
		expect(attentionOn(cardNamed(root, "Herd of Horses")))
			.toBe("stonetop.steading.improvements.firesNow");
	});

	it("says nothing about it in a season it does not fire in", async () => {
		const root = await render(await makeSheet({
			season: "winter", owned: ["herd-of-horses"], values: BUILT["herd-of-horses"],
		}));
		expect(attentionOn(cardNamed(root, "Herd of Horses"))).toBeNull();
	});

	// The card stays exactly where the steading owns it. A board that promoted it would move it out
	// from under the reader at the moment they finished it.
	it("never moves a card out of the order the steading owns them in", async () => {
		const before = cardNames(await render(await makeSheet({
			season: "summer", owned: ["palisade", "herd-of-horses", "mill"],
		})));
		const after = cardNames(await render(await makeSheet({
			season: "summer", owned: ["palisade", "herd-of-horses", "mill"],
			values: { ...BUILT["herd-of-horses"], ...BUILT.mill },
		})));
		expect(after).toEqual(before);
	});

	// The chips cut across the states, so they are their own group and narrow on their own axis.
	it("offers a chip for each question there is something to find for", async () => {
		const root = await render(await makeSheet({
			season: "summer", owned: ["mill", "herd-of-horses"],
			values: { ...BUILT.mill, ...BUILT["herd-of-horses"] },
		}));
		expect([...root.querySelectorAll("[data-board-flag]")].map(c => c.dataset.boardFlag))
			.toEqual(["owed", "season"]);
	});

	// A chip reading "0 owed" is a control that does nothing.
	it("offers no chip for a question with no answers", async () => {
		const root = await render(await makeSheet({ owned: ["palisade"] }));
		expect(root.querySelectorAll("[data-board-flag]")).toHaveLength(0);
	});

	it("narrows the board to what the chip asks about", async () => {
		const sheet = await makeSheet({
			season: "summer", owned: ["palisade", "herd-of-horses"], values: BUILT["herd-of-horses"],
		});
		const root = await render(sheet, true);
		await act(sheet, "toggleBoardFlag", root.querySelector('[data-board-flag="season"]'));
		expect(cards(root).filter(c => !c.hidden).map(c => c.dataset.slug)).toEqual(["herd-of-horses"]);
	});

	// One format down the column. It used to print "done" for a finished card and "0 / 4" for the
	// rest, so the meter alternated between a word and a fraction and could not be read vertically.
	it("states every meter the same way, finished or not", async () => {
		const root = await render(await makeSheet({
			owned: ["mill", "palisade"], values: BUILT.mill,
		}));
		const counts = [...root.querySelectorAll(".steading-improvement-count")].map(c => c.textContent.trim());
		expect(counts).toEqual(["3 / 3", "0 / 4"]);
	});
});

describe("resetting Fortunes", () => {
	// The one instruction in Seasons Change that applies on every result, and the sheet used to
	// leave it entirely unsaid.
	it("resets Fortunes to +1", async () => {
		const sheet = await makeSheet();
		sheet.actor.system.attributes.fortunes = 3;
		await act(sheet, "resetFortunes", null);
		expect(sheet.actor.system.attributes.fortunes).toBe(1);
	});

	// "malcontent — Fortunes reset to +0 each season, not +1". The debility's whole effect.
	it("resets to +0 while the steading is malcontent", async () => {
		const sheet = await makeSheet();
		sheet.actor.system.debilities.malcontent = true;
		sheet.actor.system.attributes.fortunes = 3;
		await act(sheet, "resetFortunes", null);
		expect(sheet.actor.system.attributes.fortunes).toBe(0);
	});

	// The button says the number it will actually set, rather than implying +1 and doing otherwise.
	it("states the value it will set", async () => {
		const plain = await render(await makeSheet());
		expect(plain.querySelector('[data-action="resetFortunes"]').textContent).toContain("1");

		const sheet = await makeSheet();
		sheet.actor.system.debilities.malcontent = true;
		const root = await render(sheet);
		expect(root.querySelector('[data-action="resetFortunes"]').textContent).toContain("0");
	});

	// It runs a whole procedure, so it asks first — and a declined prompt must change nothing.
	it("leaves the season alone when the prompt is declined", async () => {
		const sheet = await makeSheet({ season: "autumn" });
		stubConfirm(false);
		await render(sheet, true);

		await act(sheet, "turnSeason", null);
		expect(sheet.actor.system.season).toBe("autumn");
	});
});

describe("the season's statement", () => {
	// The steading's own bills — what the general statement still writes, now that what it GENERATES
	// belongs to the step that generates it.
	const watching = extra => makeSheet({
		season: "autumn", owned: ["standing-watch"], values: BUILT["standing-watch"], ...extra,
	});

	// Assembled from what this steading has BUILT. The catalog knows about the Mill either way; the
	// statement must only speak for improvements the steading owns and has finished.
	it("lists a result of a built improvement that fires this season", async () => {
		const root = await render(await watching());
		expect(root.querySelector(".steading-upkeep").textContent).toContain("Standing Watch");
	});

	it("says nothing about an improvement the steading does not own", async () => {
		const root = await render(await makeSheet({ season: "autumn", owned: [] }));
		expect(statementRows(root)).toHaveLength(0);
		expect(root.querySelector(".steading-turnover-empty")).not.toBeNull();
	});

	it("leaves out a result that fires in another season", async () => {
		const root = await render(await makeSheet({ season: "spring", owned: ["mill"], values: BUILT.mill }));
		expect(statementRows(root)).toHaveLength(0);
	});

	it("carries an every-season result into every season", async () => {
		for (const key of ["spring", "summer", "autumn", "winter"]) {
			const root = await render(await makeSheet({
				season: key, owned: ["mill", "standing-watch"],
				values: { ...BUILT.mill, ...BUILT["standing-watch"] },
			}));
			// The watch's own bill is upkeep and has its own section in every season; the mill's
			// Surplus is generated, so it is on the step that generates, and only in autumn.
			expect(root.querySelector(".steading-upkeep").textContent).toContain("Standing Watch");
			expect(root.querySelector(".steading-turn-steps").textContent.includes("Mill"))
				.toBe(key === "autumn");
		}
	});

	// The consequence, stated before anyone commits — six people share this document.
	it("says what the season comes to before it is applied", async () => {
		const root = await render(await watching());
		expect(root.querySelector(".steading-upkeep .steading-statement-totals").textContent.replace(/\s+/g, " "))
			.toContain("surplus");
	});

	// One control per result, pressed through the sheet's own action router — so this proves the
	// wiring reaches the actor, not just that the method works.
	it("applies one line through the sheet's own wiring, and records what it wrote", async () => {
		const sheet = await watching();
		const root = await render(sheet, true);
		sheet.actor.system.attributes.surplus = 2;

		const button = root.querySelector('.steading-upkeep [data-action="applyEffectLine"]');
		await act(sheet, "applyEffectLine", button);

		expect(sheet.actor.system.attributes.surplus).toBe(1);
		expect(sheet.actor.system.turnoverApplied[button.dataset.lineId]).toBeTruthy();
	});

	// The whole point of recording WHAT was written: a mis-click is recoverable, on a document six
	// people share.
	it("takes one line back through the sheet's own wiring", async () => {
		const sheet = await watching();
		let root = await render(sheet, true);
		sheet.actor.system.attributes.surplus = 2;

		const applyBtn = root.querySelector('.steading-upkeep [data-action="applyEffectLine"]');
		const lineId = applyBtn.dataset.lineId;
		await act(sheet, "applyEffectLine", applyBtn);
		expect(sheet.actor.system.attributes.surplus).toBe(1);

		root = await render(sheet, true);
		const revertBtn = root.querySelector(`.steading-upkeep [data-action="revertEffectLine"][data-line-id="${lineId}"]`);
		expect(revertBtn).not.toBeNull();
		await act(sheet, "revertEffectLine", revertBtn);

		expect(sheet.actor.system.attributes.surplus).toBe(2);
		expect(sheet.actor.system.turnoverApplied[lineId]).toBeUndefined();
	});

	// Applied lines stay listed — what the season did is worth reading after the fact — and offer
	// Revert instead of Apply.
	it("shows an applied line as applied, still listed", async () => {
		const root = await render(await watching({
			turnoverApplied: { "standing-watch:0": { change: { target: "surplus", amount: -1 } } },
		}));
		const row = root.querySelector(".steading-upkeep .steading-statement-line");
		expect(row.classList.contains("is-applied")).toBe(true);
		expect(row.querySelector('[data-action="applyEffectLine"]')).toBeNull();
		expect(row.querySelector('[data-action="revertEffectLine"]')).not.toBeNull();
	});

	// The point of the whole thing: the season changes the steading.
	it("writes the season's arithmetic when applied", async () => {
		const sheet = await watching();
		const root = await render(sheet, true);
		sheet.actor.system.attributes.surplus = 2;

		await act(sheet, "applyTurnover", root.querySelector('[data-action="applyTurnover"]'));
		expect(sheet.actor.system.attributes.surplus).toBe(1);
	});

	// "Apply all" is not a different mechanism — it is every line still owed, so a line already
	// applied is simply skipped rather than paid twice.
	it("writes nothing for a line already applied", async () => {
		const sheet = await makeSheet({
			season: "autumn", owned: ["mill"], values: BUILT.mill,
			turnoverApplied: { "mill:3": { change: { target: "surplus", amount: 1 } } },
		});
		const root = await render(sheet, true);
		sheet.actor.system.attributes.surplus = 2;

		const applyAll = root.querySelector('[data-action="applyTurnover"]');
		if (applyAll) await act(sheet, "applyTurnover", applyAll);
		expect(sheet.actor.system.attributes.surplus).toBe(2);
	});

	// Turning the wheel starts the season over — last season's records go, so the mill's harvest is
	// owed again when autumn comes round.
	it("clears the record when the season turns", async () => {
		const sheet = await makeSheet({
			season: "autumn", owned: ["mill"], values: BUILT.mill,
			turnoverApplied: { "mill:3": { change: { target: "surplus", amount: 1 } } },
		});
		stubConfirm(true);
		await render(sheet, true);

		await act(sheet, "turnSeason", null);
		const root = await render(sheet);
		expect(sheet.actor.system.turnoverApplied).toEqual({});
		expect(statementRows(root)).toHaveLength(0);   // winter: the Mill is quiet
	});
});

describe("the improvement board", () => {
	it("renders one card per owned improvement, and none for the rest of the catalog", async () => {
		const root = await render(await makeSheet({ owned: ["mill", "palisade"] }));
		expect(cardNames(root).sort()).toEqual(["Mill", "Palisade"]);
	});

	// The meters need no new data: every requirement row already carries a track, and its checks are
	// the pips.
	it("fills the meter from the track state the choice rows write", async () => {
		const root = await render(await makeSheet({ owned: ["mill"], values: { mill: { site: 1, miller: 1 } } }));
		expect(pipsOf(cards(root)[0])).toEqual([true, true, false]);
		expect(cards(root)[0].querySelector(".steading-improvement-count").textContent).toContain("2");
	});

	// However far along each one is: the state is on the card, not in where it sits.
	it("draws them in the order the steading owns them", async () => {
		const root = await render(await makeSheet({
			owned: ["palisade", "standing-watch", "mill"],
			values: { "standing-watch": { leaders: 3 }, mill: { site: 1, miller: 1 } },
		}));
		expect(cardNames(root)).toEqual(["Palisade", "Standing Watch", "Mill"]);
	});



	// The card SUMMARISES the ticking; the real requirement rows are inside it, so a requirement can
	// still be ticked off from the board.
	it("opens onto the improvement's real requirement rows", async () => {
		const sheet = await makeSheet({ owned: ["mill"] });
		const root = await render(sheet, true);
		const toggle = root.querySelector('[data-action="toggleImprovementCard"]');
		const body   = root.querySelector(`#${toggle.getAttribute("aria-controls")}`);

		expect(body.hidden).toBe(true);
		expect(body.querySelectorAll('[data-change-action="choiceTrack"], .stonetop-choice-track input').length)
			.toBeGreaterThan(0);

		await act(sheet, "toggleImprovementCard", toggle);
		expect(body.hidden).toBe(false);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
	});

	// The chips looked like filters and were inert spans. They are toggles now, and clicking one
	// narrows the board in place — no actor write, so nobody else's sheet re-renders.
	it("narrows the board when a chip is pressed", async () => {
		const sheet = await makeSheet({
			owned: ["mill", "palisade", "standing-watch"],
			values: { mill: { site: 1 } },
		});
		const root = await render(sheet, true);
		const shown = () => cards(root).filter(c => !c.hidden).map(c => c.dataset.state);
		expect(shown()).toHaveLength(3);

		await act(sheet, "toggleBoardFilter", root.querySelector('[data-board-filter="progress"]'));
		expect(shown()).toEqual(["progress"]);
		expect(root.querySelector('[data-board-filter="progress"]').getAttribute("aria-pressed")).toBe("true");
	});

	it("clears back to the whole board when the chip is released", async () => {
		const sheet = await makeSheet({ owned: ["mill", "palisade"], values: { mill: { site: 1 } } });
		const root = await render(sheet, true);
		const chip = root.querySelector('[data-board-filter="progress"]');

		await act(sheet, "toggleBoardFilter", chip);
		await act(sheet, "toggleBoardFilter", chip);
		expect(cards(root).filter(c => !c.hidden)).toHaveLength(2);
		expect(chip.getAttribute("aria-pressed")).toBe("false");
	});

	// Ticking a requirement used to move the card you were ticking: the board sorted by how close
	// each was to done, so working on one reshuffled it out from under the cursor. It keeps the order
	// the steading owns them in, and there is no control that changes that.
	it("keeps the owned order, whatever gets ticked", async () => {
		const sheet = await makeSheet({
			owned: ["palisade", "mill", "standing-watch"], values: BUILT.mill,
		});
		const root = await render(sheet, true);
		expect(cardNames(root)).toEqual(["Palisade", "Mill", "Standing Watch"]);
		expect(root.querySelector("[data-board-sort]")).toBeNull();
	});


	it("states the board's counts", async () => {
		const root = await render(await makeSheet({
			owned: ["mill", "palisade", "standing-watch"],
			values: { mill: { site: 1 } },
		}));
		const chips = [...root.querySelectorAll(".steading-board-chip")].map(c => c.textContent.trim());
		expect(chips.join(" ")).toMatch(/1/);
		expect(chips).toHaveLength(3);
	});

	// Ticking a requirement threw the view hundreds of pixels down the tab. The write re-renders, the
	// template renders every card shut and the whole board unfiltered, and the scroll position core
	// hands back was measured against the tab the READER had — so the browser clamped it to the
	// shorter tree, and its own scroll anchoring then shoved against the correction as the cards
	// reopened. The board this sheet restores has to be back before core measures the part.
	//
	// happy-dom has no layout, so the clamp is modelled: a card is worth 100, an open card body 300,
	// in a 200-tall viewport.
	it("has the open card and the filtered board back before the scroll position is restored", async () => {
		const sheet = await makeSheet({
			owned: ["mill", "palisade", "standing-watch"], values: { mill: { site: 1 } },
		});
		let root = await render(sheet, true);
		const clamping = tree => {
			const body = tree.querySelector(".sheet-body");
			let top = 0;
			Object.defineProperty(body, "scrollTop", {
				configurable: true,
				get: () => top,
				set: v => {
					const shown = cards(tree).filter(c => !c.hidden).length;
					const open  = cards(tree).filter(c => !c.querySelector(".steading-improvement-body").hidden).length;
					top = Math.max(0, Math.min(v, shown * 100 + open * 300 - 200));
				},
			});
			return body;
		};

		// The reader narrows the board to what is under way and opens the card they are working on.
		await act(sheet, "toggleBoardFilter", root.querySelector('[data-board-filter="progress"]'));
		await act(sheet, "toggleImprovementCard",
			root.querySelector('.steading-improvement-card[data-slug="mill"] [data-disclosure]'));
		clamping(root).scrollTop = 200;

		// …and ticks something, which is a write, which is a render.
		root = await render(sheet, false, { beforeSync: clamping });

		expect(root.querySelector('.steading-improvement-card[data-slug="mill"] .steading-improvement-body').hidden,
			"the card the reader was working in shut").toBe(false);
		expect(cards(root).filter(c => c.hidden), "the board came back unfiltered").toHaveLength(2);
		expect(root.querySelector(".sheet-body").scrollTop,
			"the scroll position was clamped to a tree the reader was never looking at").toBe(200);
	});
});

describe("the moments within a season", () => {
	const moments   = root => [...root.querySelectorAll(".steading-moment")];
	const momentOf  = (root, key) => root.querySelector(`.steading-moment[data-moment="${key}"]`);
	// Autumn's harvest step: "when the harvest is complete, roll 1d4; the steading generates that much
	// Surplus". Found by the words, not by position — a steading that also generates in autumn is
	// given a step of its own for that, and every step after it shifts down one.
	const harvestStep = root => [...root.querySelectorAll(".steading-turn-step")]
		.find(step => step.textContent.includes("the harvest is complete"));

	const inAutumn = (owned = ["rhoillyg-orchard"]) => makeSheet({
		season: "autumn", owned,
		values: Object.assign({}, ...owned.map(slug => BUILT[slug])),
	});

	/**
	 * The harvest is ONE event. It used to be two: the move's own 1d4 with a roll control up in the
	 * numbered steps, and the orchard's +1 in a panel below with an Apply of its own — so a table
	 * rolled the season, applied it, scrolled down and paid the orchard separately.
	 */
	it("reads what the steading brings inside the step that is the moment", async () => {
		const root = await render(await inAutumn());
		expect(harvestStep(root).textContent).toContain("the orchard yields +1 Surplus");
		expect(moments(root)).toHaveLength(0);
		// And NOT on the turn: arriving in autumn is not the harvest coming in.
		expect(statementText(root).join(" ")).not.toContain("the orchard yields");
	});

	// No control of its own: the step's roll is the act that pays it.
	it("offers nothing to apply beside the roll", async () => {
		const root = await render(await inAutumn());
		expect(harvestStep(root).querySelector(".steading-statement-apply")).toBeNull();
		expect(harvestStep(root).querySelector('[data-action="applyEffectLine"]')).toBeNull();
		expect(harvestStep(root).querySelector('[data-action="rollSeasonStep"]')).not.toBeNull();
	});

	// One roll, and it pays the season's 1d4 and the orchard's +1 together — in one formula, so the
	// total on the dice is the Surplus that arrives.
	it("rolls the season's dice and what the steading adds, in one act", async () => {
		const sheet = await inAutumn();
		const root  = await render(sheet, true);
		const before = sheet.actor.system.attributes.surplus;
		const rolled = rollsDice(sheet, 3);

		await act(sheet, "rollSeasonStep", harvestStep(root).querySelector('[data-action="rollSeasonStep"]'));
		expect(rolled[0].formula).toBe("1d4 + 1");
		expect(sheet.actor.system.attributes.surplus).toBe(before + 4);
	});

	// Greater Harvest's "+1d4 Surplus" is dice, so it joins the dice: the control offers the whole
	// harvest rather than the season's half of it.
	it("puts a rolled clause into the dice the control offers", async () => {
		const sheet = await inAutumn(["greater-harvest"]);
		const root  = await render(sheet, true);
		const rolled = [];
		sheet.actor.evaluateFormula = async formula => { rolled.push(formula); return { total: 5 }; };
		sheet.actor.postFormulaCard = async () => {};

		expect(harvestStep(root).querySelector('[data-action="rollSeasonStep"]').textContent)
			.toContain("1d4 + 1d4");
		await act(sheet, "rollSeasonStep", harvestStep(root).querySelector('[data-action="rollSeasonStep"]'));
		expect(rolled[0]).toBe("1d4 + 1d4 + 0");
	});

	// Rolling MOVES Surplus, so the step then says what it did and offers to give it back — the same
	// record every other step of the season keeps, and the reason no second Apply is needed.
	it("says what the harvest did, and gives it back", async () => {
		const sheet = await inAutumn();
		let root = await render(sheet, true);
		const before = sheet.actor.system.attributes.surplus;
		rollsDice(sheet, 3);
		await act(sheet, "rollSeasonStep", harvestStep(root).querySelector('[data-action="rollSeasonStep"]'));

		root = await render(sheet);
		expect(harvestStep(root).textContent).toContain("4 Surplus");
		await act(sheet, "revertSeasonStep", harvestStep(root).querySelector('[data-action="revertSeasonStep"]'));
		expect(sheet.actor.system.attributes.surplus).toBe(before);
	});

	/**
	 * Rolling the harvest is not applying the season. The mill's autumn Surplus is a TURN result in
	 * this fixture, paid by the step that generates — a different step, with a record of its own —
	 * so the harvest's roll must leave it exactly where it was.
	 */
	it("leaves what the season itself owes unpaid", async () => {
		const sheet = await inAutumn(["rhoillyg-orchard", "mill"]);
		const root  = await render(sheet, true);
		const generates = [...root.querySelectorAll(".steading-turn-step")]
			.find(step => step.textContent.includes("Mill"));
		sheet.actor.evaluateFormula = async () => ({ total: 1 });
		sheet.actor.postFormulaCard = async () => {};
		const harvestRoll = harvestStep(root).querySelector('[data-action="rollSeasonStep"]');
		await act(sheet, "rollSeasonStep", harvestRoll);

		expect(Object.keys(sheet.actor.system.seasonStepsApplied)).toEqual([harvestRoll.dataset.step]);
		expect(generates.querySelector('[data-action="applySeasonStep"]')).not.toBeNull();
	});

	// Next autumn is owed its own harvest: the step's record is season-scoped, and the turn clears it.
	it("offers the harvest again once the wheel has come round", async () => {
		stubConfirm(true);
		const sheet = await inAutumn();
		let root = await render(sheet, true);
		sheet.actor.evaluateFormula = async () => ({ total: 1 });
		sheet.actor.postFormulaCard = async () => {};
		await act(sheet, "rollSeasonStep", harvestStep(root).querySelector('[data-action="rollSeasonStep"]'));
		for (const _ of Seasons.all()) await act(sheet, "turnSeason", null);

		root = await render(sheet);
		expect(harvestStep(root).querySelector('[data-action="rollSeasonStep"]')).not.toBeNull();
	});

	/**
	 * A moment no step of the season numbers keeps its panel and its Apply — the gathering at the inn
	 * can happen in any season, and no Seasons Change move calls for it.
	 */
	it("keeps a panel for a moment the season's move does not number", async () => {
		const sheet = await makeSheet({
			season: "spring", owned: ["aurochs-hunting"], values: BUILT["aurochs-hunting"],
		});
		const root = await render(sheet);
		expect(momentOf(root, "aurochs-hunt")).not.toBeNull();
	});

	// The hunt is a spring moment. An autumn sheet is not offered it, however many hunters there are.
	it("shows no moment that cannot happen this season", async () => {
		const root = await render(await makeSheet({
			season: "autumn", owned: ["aurochs-hunting"], values: BUILT["aurochs-hunting"],
		}));
		expect(moments(root)).toHaveLength(0);
	});

	/**
	 * A moment panel reads like the improvement's own card: the book's clause, then the result,
	 * one sentence. The gathering's cost used to arrive as a tail in the sheet's voice — "clear
	 * one of the steading's debilities only if you expend 1 Surplus" — which said the fiction a
	 * second time and read as an afterthought to the thing it qualifies.
	 */
	it("reads a moment as the book's own sentence, clause first", async () => {
		const root = await render(await makeSheet({ season: "spring", owned: ["inn"], values: BUILT.inn }));
		const clause = momentOf(root, "inn-gathering").querySelector(".steading-statement-clause");
		expect(clause.textContent.trim()).toBe(
			"once per season, when you expend 1 Surplus and bring folks together at the inn, "
			+ "clear one of the steading's debilities");
		expect(clause.textContent).not.toContain("only if");
	});

	// Every autumn has a harvest; a steading with nothing that fires at one is not shown an empty
	// panel headed with a thing it has left undone — nor a step full of nothing.
	it("shows no moment nothing fires at", async () => {
		const root = await render(await makeSheet({ season: "autumn", owned: ["palisade"] }));
		expect(moments(root)).toHaveLength(0);
		expect(harvestStep(root).querySelector(".steading-turn-moment")).toBeNull();
	});
});

/**
 * What the steading GENERATES is part of the season's generation, not a list beside it. It used to
 * sit in "When spring comes" with an Apply per line, while the season's own generation was a
 * numbered step with a roll — one act, in two places, paid twice.
 */
describe("what the steading generates", () => {
	const generationStep = root => [...root.querySelectorAll(".steading-turn-step")]
		.find(step => step.textContent.includes("Township"));

	const asATown = (season) => makeSheet({
		season, owned: ["township"], values: BUILT.township,
	});

	// Spring's move generates nothing of its own, so the sheet numbers a step for what the steading
	// generates — one control, one record, one Revert.
	it("is numbered as a step of a season whose move generates nothing", async () => {
		const sheet = await asATown("spring");
		sheet.actor.system.attributes.population = 2;
		const root = await render(sheet, true);

		const step = generationStep(root);
		expect(step).not.toBeUndefined();
		expect(step.textContent).toContain("Surplus equal to Population+1");
		// And not in the general list, which is where it used to be stated.
		expect(root.querySelector(".steading-during-owed")?.textContent ?? "").not.toContain("Township");
	});

	// "Population+1" is arithmetic over a rating the sheet knows — not a die, however it is written.
	it("works the amount out and writes it once", async () => {
		const sheet = await asATown("spring");
		sheet.actor.system.attributes.population = 2;
		sheet.actor.system.attributes.surplus    = 1;
		let root = await render(sheet, true);

		const apply = generationStep(root).querySelector('[data-action="applySeasonStep"]');
		expect(apply.textContent).toContain("3");
		await act(sheet, "applySeasonStep", apply);
		expect(sheet.actor.system.attributes.surplus).toBe(4);

		// Rolled nothing, so it says what it generated and offers it back — never "0 was rolled".
		root = await render(sheet);
		const step = generationStep(root);
		expect(step.textContent).not.toContain("was rolled");
		await act(sheet, "revertSeasonStep", step.querySelector('[data-action="revertSeasonStep"]'));
		expect(sheet.actor.system.attributes.surplus).toBe(1);
	});

	// Summer's move DOES generate, so the gains ride its roll: one roll, one amount, one record.
	it("rides the roll of a season that generates for itself", async () => {
		const sheet = await asATown("summer");
		sheet.actor.system.attributes.population = 2;
		sheet.actor.system.attributes.surplus    = 0;
		const root = await render(sheet, true);

		const step = generationStep(root);
		expect(step.textContent).toContain("1d4-1");
		expect(step.querySelector('[data-action="applySeasonStep"]')).toBeNull();

		const rolled = rollsDice(sheet, 2);
		await act(sheet, "rollSeasonStep", step.querySelector('[data-action="rollSeasonStep"]'));
		// The town's Population+1 rides the season's own 1d4-1: one formula, one total, one record.
		expect(rolled[0].formula).toBe("1d4-1 + 3");
		expect(sheet.actor.system.attributes.surplus).toBe(5);
	});

	// The season's own Apply must not pay it a second time: the step's record is the step's, and the
	// turnover's records are per line.
	it("is never paid again by the season's own Apply", async () => {
		const sheet = await asATown("spring");
		sheet.actor.system.attributes.population = 2;
		sheet.actor.system.attributes.surplus    = 1;
		const root = await render(sheet, true);

		await act(sheet, "applySeasonStep",
			generationStep(root).querySelector('[data-action="applySeasonStep"]'));
		expect(sheet.actor.system.attributes.surplus).toBe(4);

		const applyAll = root.querySelector('.steading-turnover [data-action="applyTurnover"]');
		if (applyAll) await act(sheet, "applyTurnover", applyAll);
		expect(sheet.actor.system.attributes.surplus).toBe(4);
	});
});

/**
 * "the steading generates 1 Surplus, if you roll a 7+ with Fortunes" is not a condition the sheet
 * cannot judge. The reader judges it by pressing the button on the row the dice landed on.
 */
describe("what a result row pays out", () => {
	const rowFor = (root, key) => root.querySelector(`.stonetop-result-row--${key}`);

	const withStream = () => makeSheet({
		season: "winter", owned: ["harnessing-the-stream"], values: BUILT["harnessing-the-stream"],
	});

	it("offers the roll's own payout on every row its range covers", async () => {
		const root = await render(await withStream(), true);
		expect(rowFor(root, "success").querySelector('[data-action="applyEffectLine"]')).not.toBeNull();
		expect(rowFor(root, "partial").querySelector('[data-action="applyEffectLine"]')).not.toBeNull();
		expect(rowFor(root, "failure").querySelector('[data-action="applyEffectLine"]')).toBeNull();
	});

	it("writes it, and gives it back", async () => {
		const sheet = await withStream();
		sheet.actor.system.attributes.surplus = 2;
		let root = await render(sheet, true);

		const apply = rowFor(root, "success").querySelector('[data-action="applyEffectLine"]');
		await act(sheet, "applyEffectLine", apply);
		expect(sheet.actor.system.attributes.surplus).toBe(3);

		root = await render(sheet, true);
		const revert = rowFor(root, "success").querySelector('[data-action="revertEffectLine"]');
		expect(revert).not.toBeNull();
		await act(sheet, "revertEffectLine", revert);
		expect(sheet.actor.system.attributes.surplus).toBe(2);
	});

	// Applied on one row, it reads as applied on the other — it is one result, and it was paid once.
	it("says on both rows that it has been paid", async () => {
		const sheet = await withStream();
		let root = await render(sheet, true);
		await act(sheet, "applyEffectLine",
			rowFor(root, "success").querySelector('[data-action="applyEffectLine"]'));

		root = await render(sheet, true);
		for (const key of ["success", "partial"]) {
			expect(rowFor(root, key).querySelector('[data-action="applyEffectLine"]')).toBeNull();
			expect(rowFor(root, key).querySelector('[data-action="revertEffectLine"]')).not.toBeNull();
		}
	});

	// The season's batch cannot know what was rolled, so it never writes one of these.
	it("is never written by the season's own Apply", async () => {
		const sheet = await withStream();
		sheet.actor.system.attributes.surplus = 2;
		const root = await render(sheet, true);
		const applyAll = root.querySelector('.steading-turnover [data-action="applyTurnover"]');
		if (applyAll) await act(sheet, "applyTurnover", applyAll);
		expect(sheet.actor.system.attributes.surplus).toBe(2);
	});
});

describe("a move an improvement confers", () => {
	const springHunt = () => makeSheet({
		season: "spring", owned: ["aurochs-hunting"], values: BUILT["aurochs-hunting"],
	});

	const grantedRow = root => root.querySelector(".steading-moment .steading-statement-moves .stonetop-item");

	// It renders as the move it is — one row, the move's own words behind its disclosure, its own
	// die. What this replaced was a fragment of the move printed as an advisory line AND a detached
	// "Roll X" button under it: two half-renderings, neither of which was a move.
	it("renders the move at the moment it fires, as a move row", async () => {
		const root = await render(await springHunt());
		const row  = grantedRow(root);
		expect(row.querySelector(".stonetop-move-disclosure").textContent).toContain("Lead the Aurochs Hunt");
		expect(row.querySelector(".stonetop-move-body").textContent).toContain("+Defenses");
	});

	// And it says nothing else. The improvement's name used to ride along as a caption, which landed
	// between the move's name and the move's own words — the one place on a row nothing else may
	// stand, and wide enough to push the name itself out of the row's first line.
	it("hangs no caption between the move's name and its own words", async () => {
		const row = grantedRow(await render(await springHunt()));
		expect(row.querySelector(".stonetop-item-source")).toBeNull();
		expect(row.querySelector(".stonetop-move-gloss").textContent).toContain("lead the aurochs hunt");
	});

	// The move is not the steading's, so there is no owned id on the row to roll through: the die
	// names the move by slug, and the roll resolves it from the pack.
	it("rolls it as the steading, resolved from the pack by slug", async () => {
		const sheet = await springHunt();
		const root  = await render(sheet);
		sheet.actor.rollItem = vi.fn(async () => {});
		const die = grantedRow(root).querySelector(".move-rollable");
		expect(die.closest(".stonetop-item").dataset.itemId).toBeFalsy();
		expect(die.dataset.moveSlug).toBe("lead-the-aurochs-hunt");
		await sheet.actor.typedActor.rollMoveBySlug(die.dataset.moveSlug);
		expect(sheet.actor.rollItem).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Lead the Aurochs Hunt" }));
	});

	// The advisory line the row replaced said the same thing in fewer words. One rendering, not two.
	it("states the move once, not as prose beside itself", async () => {
		const root  = await render(await springHunt());
		const lines = [...root.querySelectorAll(".steading-moment .steading-statement-line")];
		expect(lines.map(l => l.textContent)).not.toContainEqual(expect.stringContaining("aurochs hunt"));
	});

	// It belongs to the improvement that granted it, not to the steading: seeding it would file it
	// under Homefront on the Moves tab, a third place, severed from the thing that earned it.
	it("never joins the steading's own moves", async () => {
		const sheet = await springHunt();
		await render(sheet);
		expect([...sheet.actor.items].some(i => i.name === "Lead the Aurochs Hunt")).toBe(false);
	});

	// A move is rolled, and what it does depends on the roll — so it is never an applied line and
	// gets no control of its own, only something to roll.
	it("is not something the statement offers to apply", async () => {
		const root = await render(await springHunt());
		const moment = root.querySelector(".steading-moment");
		expect(moment.querySelectorAll('[data-action="applyEffectLine"]')).toHaveLength(0);
		expect(moment.querySelector(".steading-statement-apply")).toBeNull();
	});
});

/**
 * The card reads requirements → payoff, in one flow, and the payoff is stated exactly ONCE.
 *
 * It used to be stated four times over: as chips, as a statement line, as a delta chip beside that
 * line, and again as the book's prose at the end of the requirement rows — with a `Fortunes 4 → 5`
 * total underneath for a fifth. The prose is stripped from the pack, the delta and the total are
 * gone from this surface, and the chips are the SHUT view only. What is left is the book's own two
 * headed halves, with one control per result the sheet can write.
 */
describe("the payoff on an improvement's card", () => {
	const cardFor = (root, slug) => root.querySelector(`.steading-improvement-card[data-slug="${slug}"]`);
	const payoffOf = card => card.querySelector(".steading-payoff");
	const headsOf = card => [...card.querySelectorAll(".steading-payoff-head")]
		.map(h => h.textContent.trim());

	it("states both of the book's halves, under their own headings", async () => {
		const root = await render(await makeSheet({ owned: ["mill"], values: BUILT.mill }));
		expect(headsOf(cardFor(root, "mill"))).toEqual([
			"stonetop.steading.effects.onCompletion",
			"stonetop.steading.effects.henceforth",
		]);
	});

	// Inside the body, AFTER the requirement rows — the order the book prints them in and the order
	// the work happens in. It used to be bolted on above the header, floating with no context.
	it("puts the payoff inside the card body, after the requirements", async () => {
		const root = await render(await makeSheet({ owned: ["mill"], values: BUILT.mill }));
		const body = cardFor(root, "mill").querySelector(".steading-improvement-body");
		expect(body.querySelector(".steading-payoff")).not.toBeNull();
		const kids = [...body.children];
		expect(kids.findIndex(k => k.classList.contains("stonetop-choice-entry")))
			.toBeLessThan(kids.findIndex(k => k.classList.contains("steading-payoff")));
	});

	// The prose that used to say this was stripped from the pack, so the card is the only place it is
	// said — which means it has to be said before the work is finished, not only after.
	it("states what an UNFINISHED improvement will do, with no control", async () => {
		const root = await render(await makeSheet({ owned: ["mill"] }), true);
		const payoff = payoffOf(cardFor(root, "mill"));
		expect(payoff.textContent).toContain("increase Fortunes by 1");
		expect(payoff.querySelectorAll('[data-action="applyEffectLine"]')).toHaveLength(0);
	});

	it("offers one control per writable result once it is built", async () => {
		const root = await render(await makeSheet({ owned: ["mill"], values: BUILT.mill }), true);
		const payoff = payoffOf(cardFor(root, "mill"));
		// Two writable completion results; the fiction line beside them gets nothing to press.
		expect(payoff.querySelectorAll('[data-action="applyEffectLine"]')).toHaveLength(2);
	});

	// Applied and reverted from the card itself, through the sheet's own action router.
	it("applies and reverts one result from the card", async () => {
		const sheet = await makeSheet({ owned: ["mill"], values: BUILT.mill });
		let root = await render(sheet, true);
		sheet.actor.system.attributes.fortunes = 2;

		const apply = payoffOf(cardFor(root, "mill")).querySelector('[data-action="applyEffectLine"]');
		const lineId = apply.dataset.lineId;
		await act(sheet, "applyEffectLine", apply);
		expect(sheet.actor.system.attributes.fortunes).toBe(3);

		root = await render(sheet, true);
		const revert = root.querySelector(`[data-action="revertEffectLine"][data-line-id="${lineId}"]`);
		await act(sheet, "revertEffectLine", revert);
		expect(sheet.actor.system.attributes.fortunes).toBe(2);
	});

    // Its results fire at the turn of the season, and the season's panel is where they are written.
	it("offers no control on the Henceforth half, even where the sheet could write it", async () => {
		const root = await render(await makeSheet({ owned: ["mill"], values: BUILT.mill }), true);
		const heads = [...cardFor(root, "mill").querySelectorAll(".steading-payoff-head")];
		const henceforth = heads[1].nextElementSibling;
		expect(henceforth.textContent).toContain("+1 Surplus");
		expect(henceforth.querySelectorAll("button[data-action^=\"applyEffectLine\"]")).toHaveLength(0);
	});

	// "Henceforth" says these fire later without saying WHEN, and the trigger came out of the line's
	// own words when the payoff prose was stripped. So the timing is stated beside it.
	it("says when a Henceforth result fires", async () => {
		const root = await render(await makeSheet({ owned: ["mill"], values: BUILT.mill }));
		expect([...cardFor(root, "mill").querySelectorAll(".steading-statement-when")].map(e => e.textContent.trim()))
			.toEqual(["stonetop.steading.seasons.names.autumn"]);
	});

	// On the season's own panel the timing IS the panel, so repeating it down every line would be
	// noise. It is stated on the card and nowhere else.
	it("does not repeat the timing on the season's own panel", async () => {
		const root = await render(await makeSheet({ season: "autumn", owned: ["mill"], values: BUILT.mill }));
		expect(root.querySelectorAll(".steading-turnover .steading-statement-when")).toHaveLength(0);
	});

	// The disclosure button above already says the name; the titled group printed it again directly
	// beneath, so the open card said it twice.
	it("does not print the improvement's name twice", async () => {
		const root = await render(await makeSheet({ owned: ["mill"], values: BUILT.mill }));
		const card = cardFor(root, "mill");
		// The group's title is where the second copy came from — the board builds from `choices` now,
		// not `titledChoices`, so there is none. (The Resources chip also reads "Mill", but that is the
		// entry the improvement WRITES, not its name.)
		expect(card.querySelectorAll(".stonetop-choice-entry-title")).toHaveLength(0);
		expect(card.querySelectorAll(".steading-improvement-name")).toHaveLength(1);
	});
});

describe("what a card says an improvement is for", () => {
	const cardFor  = (root, slug) => root.querySelector(`.steading-improvement-card[data-slug="${slug}"]`);
	const chipsOf  = card => [...card.querySelectorAll(".steading-effect-chip")]
		.map(c => c.textContent.replace(/\s+/g, " ").trim());

	// Shut, a card is otherwise a name and a meter: how far along the work is, and nothing about what
	// the work buys.
	it("chips the numbers its results state, without opening the card", async () => {
		const root = await render(await makeSheet({ owned: ["mill"], values: BUILT.mill }));
		const card = cardFor(root, "mill");
		expect(card.querySelector(".steading-improvement-body").hidden).toBe(true);
		expect(chipsOf(card)).toEqual([
			"+1 stonetop.steading.attr.fortunes",
			"stonetop.steading.lists.resources: Mill",
			"stonetop.steading.seasons.names.autumn +1 stonetop.steading.attr.surplus",
		]);
	});

	/**
	 * Only what a result already states as data. Township's completion changes a TIER and its winter
	 * clause changes an arithmetic — neither is a number to compress, and inventing one for them is
	 * how the old summary sentence went wrong. Its spring Surplus is a number, and chips as one.
	 */
	it("chips only the results that state a number", async () => {
		const root = await render(await makeSheet({ owned: ["township"], values: BUILT.township }));
		expect(chipsOf(cardFor(root, "township"))).toEqual([
			"stonetop.steading.seasons.names.spring stonetop.steading.seasons.names.summer "
			+ "stonetop.steading.attr.population+1 stonetop.steading.attr.surplus",
		]);
	});

	// An improvement with no structured results at all says nothing rather than something invented.
	it("chips nothing for an improvement whose results are only prose", async () => {
		const root = await render(await makeSheet({ owned: ["palisade"], values: BUILT.palisade }));
		expect(cardFor(root, "palisade").querySelector(".steading-effect-chips")).toBeNull();
	});

	// On an unfinished improvement a chip is what it WILL do, and the card says so by dimming it.
	it("marks a chip pending until the requirement behind it holds", async () => {
		const root = await render(await makeSheet({ owned: ["mill"] }));
		const chips = [...cardFor(root, "mill").querySelectorAll(".steading-effect-chip")];
		expect(chips.every(c => c.classList.contains("is-pending"))).toBe(true);
	});

	it("stops marking them pending once it is built", async () => {
		const root = await render(await makeSheet({ owned: ["mill"], values: BUILT.mill }));
		const chips = [...cardFor(root, "mill").querySelectorAll(".steading-effect-chip")];
		expect(chips.some(c => c.classList.contains("is-pending"))).toBe(false);
	});
});
