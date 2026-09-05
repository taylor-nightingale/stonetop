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

async function makeSheet({ owned = [], season, year, values, excluded } = {}) {
	const actor = new FakeSteadingBuilder().build();
	actor.system.improvements      = owned;
	actor.system.improvementValues = values ?? {};
	if (season !== undefined) actor.system.season = season;
	if (year !== undefined) actor.system.year = year;
	if (excluded !== undefined) actor.system.turnoverExcluded = excluded;

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

async function render(sheet, first = false) {
	sheet.element.innerHTML = renderTemplate(STEADING_TEMPLATE, await sheet._prepareContext({}));
	if (first) await sheet._onFirstRender({}, {});
	sheet._onRender({}, {});
	return sheet.element;
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

	// Dropping a line goes through the ordinary change router, so this proves the sheet's wiring
	// reaches the actor and not just that the method works.
	it("records a dropped line through the sheet's own change wiring", async () => {
		const sheet = await makeSheet({ season: "autumn", owned: ["mill"], values: BUILT.mill });
		const root = await render(sheet, true);

		const box = root.querySelector('.steading-turnover [data-change-action="effectIncluded"]');
		box.checked = false;
		box.dispatchEvent(new Event("change", { bubbles: true }));
		await Promise.resolve();

		expect(sheet.actor.system.turnoverExcluded["mill:3"]).toBe(true);
	});

	it("shows a dropped line back as dropped, still listed", async () => {
		const root = await render(await makeSheet({
			season: "autumn", owned: ["mill"], values: BUILT.mill, excluded: { "mill:3": true },
		}));
		expect(root.querySelector('.steading-turnover [data-change-action="effectIncluded"]').checked).toBe(false);
		expect(statementRows(root)[0].classList.contains("is-dropped")).toBe(true);
	});

	// The point of the whole thing: the season changes the steading.
	it("writes the season's arithmetic when applied", async () => {
		const sheet = await makeSheet({ season: "autumn", owned: ["mill"], values: BUILT.mill });
		const root = await render(sheet, true);
		sheet.actor.system.attributes.surplus = 2;

		await act(sheet, "applyTurnover", root.querySelector('[data-action="applyTurnover"]'));
		expect(sheet.actor.system.attributes.surplus).toBe(3);
	});

	it("writes nothing for a line the table dropped", async () => {
		const sheet = await makeSheet({
			season: "autumn", owned: ["mill"], values: BUILT.mill, excluded: { "mill:3": true },
		});
		const root = await render(sheet, true);
		sheet.actor.system.attributes.surplus = 2;

		await act(sheet, "applyTurnover", root.querySelector('[data-action="applyTurnover"]'));
		expect(sheet.actor.system.attributes.surplus).toBe(2);
	});

	// Turning the wheel starts the season over — what was applied and what was dropped both go.
	it("clears the record when the season turns", async () => {
		const sheet = await makeSheet({
			season: "autumn", owned: ["mill"], values: BUILT.mill, excluded: { "mill:3": true },
		});
		stubConfirm(true);
		await render(sheet, true);

		await act(sheet, "turnSeason", null);
		const root = await render(sheet);
		expect(sheet.actor.system.turnoverExcluded).toEqual({});
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

	// A move is rolled, and what it does depends on the roll — so it is never an applied line.
	it("is not something the statement offers to apply", async () => {
		const root = await render(await springHunt());
		const moment = root.querySelector(".steading-moment");
		expect(moment.querySelectorAll(".steading-statement-label")).toHaveLength(0);
		expect(moment.querySelector(".steading-statement-apply")).toBeNull();
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
