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

// Its completion changes nothing the sheet can write — Size is a tier, not a delta.
const TOWNSHIP = improvement("township", "Township", {
	tracks: [["population", 1]],
	effects: [{ when: { kind: "completed" }, text: "change Size to town and its Population to +0" }],
});

// A moment WITHIN autumn — not the turn. The harvest coming in is something the table says has
// happened; the wheel arriving in autumn is not the same event.
const ORCHARD = improvement("rhoillyg-orchard", "Rhoillyg Orchard", {
	tracks: [["saplings", 1]],
	effects: [{ when: { kind: "moment", moment: "autumn-harvest" },
		change: { target: "surplus", amount: 1 }, text: "the orchard yields +1 Surplus" }],
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

// The track values that make an improvement BUILT — every requirement box filled. A clause is the
// ongoing effect of a finished improvement, so nothing fires until this is stored.
const BUILT = {
	mill:              { mill: { site: 1, miller: 2 } },
	"standing-watch":  { "standing-watch": { leaders: 3 } },
	township:          { township: { population: 1 } },
	"herd-of-horses":  { "herd-of-horses": { stable: 1 } },
	"rhoillyg-orchard": { "rhoillyg-orchard": { saplings: 1 } },
	"aurochs-hunting":  { "aurochs-hunting": { hunters: 1 } },
};

function catalog() {
	const repo = new FakeSteadingImprovementRepository();
	repo._improvements.push(MILL, WATCH, PALISADE, TOWNSHIP, HERD, ORCHARD, AUROCHS);
	return repo;
}

// The four Seasons Change moves, as the pack ships them — the tab promotes ONE of these and folds
// the rest away, so a fixture without them proves nothing about that split.
const SEASON_MOVE_NAMES = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };

function seasonalMoveRepo() {
	const repo = new FakeMoveRepository();
	for (const s of Seasons.all()) {
		repo.addBasic(new FakeCompendiumMoveBuilder()
			.withName(`Seasons Change: ${SEASON_MOVE_NAMES[s.key]}`)
			.withMoveType("seasons")
			.withRollStat("fortunes")
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
		.build());
	return repo;
}

async function makeSheet({ owned = [], season, year, values, turnoverApplied } = {}) {
	const actor = new FakeSteadingBuilder().build();
	actor.system.improvements      = owned;
	actor.system.improvementValues = values ?? {};
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

	// Rolling IS the turn — one act, so one control. The roll goes out as an ordinary move roll of
	// the INCOMING season's Seasons Change, not as a second kind of card.
	it("rolls the incoming season's move as it turns", async () => {
		const sheet = await makeSheet({ season: "autumn" });
		stubConfirm(true);
		await render(sheet, true);

		await act(sheet, "turnSeason", null);
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

	// Only the incoming season's move is promoted; the other three are reference below it.
	it("promotes the incoming season's move and folds the other three away", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		const turn = root.querySelector(".steading-turn");
		expect(turn.textContent).toContain("Seasons Change: Summer");

		const others = [...root.querySelectorAll(".steading-others-list .stonetop-item")];
		expect(others).toHaveLength(3);
		expect(others.map(o => o.textContent).join(" ")).not.toContain("Seasons Change: Summer");
	});

	// Folded away is about WEIGHT, not capability. Turning the wheel is what the promoted move's
	// control does; these stay fully rollable, because a table that wants to roll a season's move on
	// its own terms is not something the sheet should decide it cannot.
	it("keeps the folded moves rollable, readable and postable", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		const others = root.querySelector(".steading-others-list");

		expect(others.querySelectorAll(".move-rollable")).toHaveLength(3);
		expect(others.querySelectorAll('[data-action="moveToChat"]')).toHaveLength(3);
		expect(others.querySelectorAll('[data-action="toggleMoveBody"]')).toHaveLength(3);
	});

	it("leaves the homefront moves rollable too", async () => {
		const root = await render(await makeSheet({ season: "spring" }));
		expect(root.querySelectorAll(".steading-rail .move-rollable").length).toBeGreaterThan(0);
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
	// Assembled from what this steading has BUILT. The catalog knows about the Mill either way; the
	// statement must only speak for improvements the steading owns and has finished.
	it("lists a result of a built improvement that fires this season", async () => {
		const root = await render(await makeSheet({ season: "autumn", owned: ["mill"], values: BUILT.mill }));
		const lines = statementText(root);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("Mill");
		expect(lines[0]).toContain("+1 Surplus");
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
				season: key, owned: ["standing-watch"], values: BUILT["standing-watch"],
			}));
			expect(statementRows(root)).toHaveLength(1);
		}
	});

	// The consequence, stated before anyone commits — six people share this document.
	it("says what the season comes to before it is applied", async () => {
		const root = await render(await makeSheet({ season: "autumn", owned: ["mill"], values: BUILT.mill }));
		expect(root.querySelector(".steading-turnover .steading-statement-totals").textContent.replace(/\s+/g, " "))
			.toContain("surplus");
	});

	// One control per result, pressed through the sheet's own action router — so this proves the
	// wiring reaches the actor, not just that the method works.
	it("applies one line through the sheet's own wiring, and records what it wrote", async () => {
		const sheet = await makeSheet({ season: "autumn", owned: ["mill"], values: BUILT.mill });
		const root = await render(sheet, true);
		sheet.actor.system.attributes.surplus = 2;

		const button = root.querySelector('.steading-turnover [data-action="applyEffectLine"]');
		await act(sheet, "applyEffectLine", button);

		expect(sheet.actor.system.attributes.surplus).toBe(3);
		expect(sheet.actor.system.turnoverApplied[button.dataset.lineId]).toBeTruthy();
	});

	// The whole point of recording WHAT was written: a mis-click is recoverable, on a document six
	// people share.
	it("takes one line back through the sheet's own wiring", async () => {
		const sheet = await makeSheet({ season: "autumn", owned: ["mill"], values: BUILT.mill });
		let root = await render(sheet, true);
		sheet.actor.system.attributes.surplus = 2;

		const applyBtn = root.querySelector('.steading-turnover [data-action="applyEffectLine"]');
		const lineId = applyBtn.dataset.lineId;
		await act(sheet, "applyEffectLine", applyBtn);
		expect(sheet.actor.system.attributes.surplus).toBe(3);

		root = await render(sheet, true);
		const revertBtn = root.querySelector(`.steading-turnover [data-action="revertEffectLine"][data-line-id="${lineId}"]`);
		expect(revertBtn).not.toBeNull();
		await act(sheet, "revertEffectLine", revertBtn);

		expect(sheet.actor.system.attributes.surplus).toBe(2);
		expect(sheet.actor.system.turnoverApplied[lineId]).toBeUndefined();
	});

	// Applied lines stay listed — what the season did is worth reading after the fact — and offer
	// Revert instead of Apply.
	it("shows an applied line as applied, still listed", async () => {
		const root = await render(await makeSheet({
			season: "autumn", owned: ["mill"], values: BUILT.mill,
			turnoverApplied: { "mill:3": { change: { target: "surplus", amount: 1 } } },
		}));
		const row = statementRows(root)[0];
		expect(row.classList.contains("is-applied")).toBe(true);
		expect(row.querySelector('[data-action="applyEffectLine"]')).toBeNull();
		expect(row.querySelector('[data-action="revertEffectLine"]')).not.toBeNull();
	});

	// The point of the whole thing: the season changes the steading.
	it("writes the season's arithmetic when applied", async () => {
		const sheet = await makeSheet({ season: "autumn", owned: ["mill"], values: BUILT.mill });
		const root = await render(sheet, true);
		sheet.actor.system.attributes.surplus = 2;

		await act(sheet, "applyTurnover", root.querySelector('[data-action="applyTurnover"]'));
		expect(sheet.actor.system.attributes.surplus).toBe(3);
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
	const momentText = m => [...m.querySelectorAll(".steading-statement-line")]
		.map(r => r.textContent.replace(/\s+/g, " ").trim());

	const inAutumn = () => makeSheet({
		season: "autumn", owned: ["rhoillyg-orchard"], values: BUILT["rhoillyg-orchard"],
	});

	it("gives the harvest its own panel, apart from the turn's statement", async () => {
		const root = await render(await inAutumn());
		const harvest = momentOf(root, "autumn-harvest");
		expect(harvest).not.toBeNull();
		expect(momentText(harvest).join(" ")).toContain("the orchard yields +1 Surplus");
		// And NOT on the turn: arriving in autumn is not the harvest coming in.
		expect(statementText(root).join(" ")).not.toContain("the orchard yields");
	});

	// The hunt is a spring moment. An autumn sheet is not offered it, however many hunters there are.
	it("shows no moment that cannot happen this season", async () => {
		const root = await render(await makeSheet({
			season: "autumn", owned: ["aurochs-hunting"], values: BUILT["aurochs-hunting"],
		}));
		expect(moments(root)).toHaveLength(0);
	});

	// Every autumn has a harvest; a steading with nothing that fires at one is not shown an empty
	// panel headed with a thing it has left undone.
	it("shows no moment nothing fires at", async () => {
		const root = await render(await makeSheet({ season: "autumn", owned: ["palisade"] }));
		expect(moments(root)).toHaveLength(0);
	});

	it("writes what the harvest does, once, and says afterwards that it did", async () => {
		const sheet = await inAutumn();
		let root = await render(sheet);
		const before = sheet.actor.system.attributes.surplus;

		await act(sheet, "applyMoment", momentOf(root, "autumn-harvest").querySelector(".steading-statement-apply"));
		expect(sheet.actor.system.attributes.surplus).toBe(before + 1);

		root = await render(sheet);
		const harvest = momentOf(root, "autumn-harvest");
		expect(harvest.querySelector(".steading-moment-state")).not.toBeNull();
		// Nothing left to press: a second Apply would pay the harvest twice.
		expect(harvest.querySelector(".steading-statement-apply")).toBeNull();
	});

	// Applying the harvest is not applying the season, and neither stands in for the other.
	it("leaves the turn's own statement unapplied", async () => {
		const sheet = await makeSheet({
			season: "autumn", owned: ["rhoillyg-orchard", "mill"],
			values: { ...BUILT["rhoillyg-orchard"], ...BUILT.mill },
		});
		const root = await render(sheet);
		await act(sheet, "applyMoment", momentOf(root, "autumn-harvest").querySelector(".steading-statement-apply"));
		expect(sheet.actor.system.turnoverApplied.turn).toBeFalsy();
		expect(root.querySelector('.steading-turnover [data-action="applyTurnover"]')).not.toBeNull();
	});

	// Next autumn is owed its own harvest.
	it("offers the harvest again once the wheel has come round", async () => {
		stubConfirm(true);
		const sheet = await inAutumn();
		let root = await render(sheet);
		await act(sheet, "applyMoment", momentOf(root, "autumn-harvest").querySelector(".steading-statement-apply"));
		for (const _ of Seasons.all()) await act(sheet, "turnSeason", null);
		root = await render(sheet);
		expect(momentOf(root, "autumn-harvest").querySelector(".steading-statement-apply")).not.toBeNull();
	});
});

describe("a move an improvement confers", () => {
	const springHunt = () => makeSheet({
		season: "spring", owned: ["aurochs-hunting"], values: BUILT["aurochs-hunting"],
	});

	// The clause already reads "when you lead the aurochs hunt, roll +Defenses". What it cannot do is
	// roll it — so the sheet offers exactly that, named after the move.
	it("offers the move by name at the moment it fires", async () => {
		const root = await render(await springHunt());
		const button = root.querySelector('.steading-moment [data-action="rollGrantedMove"]');
		expect(button.dataset.slug).toBe("lead-the-aurochs-hunt");
		expect(button.textContent).toContain("Lead the Aurochs Hunt");
	});

	it("rolls it as the steading", async () => {
		const sheet = await springHunt();
		const root  = await render(sheet);
		sheet.actor.rollItem = vi.fn(async () => {});
		await act(sheet, "rollGrantedMove", root.querySelector('[data-action="rollGrantedMove"]'));
		expect(sheet.actor.rollItem).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Lead the Aurochs Hunt" }));
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

	// Nothing to compress — Township's completion changes a tier, not a number — so no chip is
	// invented for it. Compressing prose anyway is how the old summary sentence went wrong.
	it("chips nothing for an improvement whose results are only prose", async () => {
		const root = await render(await makeSheet({ owned: ["township"], values: BUILT.township }));
		expect(cardFor(root, "township").querySelector(".steading-effect-chips")).toBeNull();
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
