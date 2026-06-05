import { describe, it, expect } from "vitest";
import { CharacterPlaybook } from "../../../src/actors/character/CharacterPlaybook.js";
import { PlaybookSnapshot } from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import { FakeMoves } from "../../fakes/FakeMoves.js";
import { FakeVitals } from "../../fakes/FakeVitals.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeActor(playbookSlug = "the-blessed", items = []) {
	return new FakeActorBuilder().withPlaybook(playbookSlug).withItems(items).build();
}

class FakeSection {
	constructor(result = null) { this._result = result; }
	buildSnapshot(data) { this._received = data; return this._result; }
	receivedData() { return this._received ?? null; }
}

class FakeBackground {
	_selectedSlug;
	constructor(selectedSlug = "") { this._selectedSlug = selectedSlug; }
	get selectedSlug()              { return this._selectedSlug; }
	async selectBackground(slug)    { this._selectedSlug = slug; }
	async buildSnapshot()           { return null; }
}

function makePlaybook(actor, subs = {}) {
	const {
		background = new FakeBackground(),
		instinct   = new FakeSection(),
		appearance = new FakeSection(),
		origin     = new FakeSection(),
		lore       = new FakeSection(),
	} = subs;
	return new CharacterPlaybook(actor, background, instinct, appearance, origin, lore);
}

const PLAYBOOK_ITEM = new TestPlaybookItemBuilder()
	.withSlug("the-blessed")
	.withName("The Blessed")
	.withImg("img.webp")
	.withDescription("<p>A healer.</p>")
	.withStatsNote("Assign +2/+1/+1/0/0/-1")
	.withBackgrounds([
		{ slug: "herbalist", moves: ["healing-touch"] },
		{ slug: "vessel",    moves: ["channel"] },
	])
	.withInstinct({ slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [{ slug: "pious", label: "Pious", description: "Devout." }] }] })
	.withAppearance({ slug: "appearance", list: [{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "tall", text: "tall" }, { slug: "short", text: "short" }] }] })
	.withOrigin([{ region: "The Reach", names: ["Aldric"] }])
	.withLore([{ slug: "lore-1" }])
	.build();

const PLAYBOOK_DATA = { ...PLAYBOOK_ITEM.system, name: PLAYBOOK_ITEM.name, img: PLAYBOOK_ITEM.img };

// ── getData ───────────────────────────────────────────────────────────────────

describe("CharacterPlaybook.getData", () => {
	it("returns null when actor has no playbook item in actor.items", async () => {
		const actor = new FakeActorBuilder().build();
		expect(await makePlaybook(actor).getData()).toBeNull();
	});

	it("returns null when slug is set but no playbook item is in actor.items", async () => {
		const actor = new FakeActorBuilder().withPlaybook("the-blessed").build();
		expect(await makePlaybook(actor).getData()).toBeNull();
	});

	it("returns playbook data from embedded item when present", async () => {
		const data = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).getData();
		expect(data).not.toBeNull();
		expect(data.slug).toBe("the-blessed");
	});

	it("includes name and img from item top-level fields", async () => {
		const data = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).getData();
		expect(data.name).toBe("The Blessed");
		expect(data.img).toBe("img.webp");
	});

	it("includes system fields like backgrounds and lore", async () => {
		const data = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).getData();
		expect(data.backgrounds).toEqual(PLAYBOOK_ITEM.system.backgrounds);
		expect(data.lore).toEqual(PLAYBOOK_ITEM.system.lore);
	});
});

// ── buildPlaybookSnapshot ─────────────────────────────────────────────────────

describe("CharacterPlaybook.buildPlaybookSnapshot", () => {
	it("returns null when no playbook item in actor.items", async () => {
		const actor = new FakeActorBuilder().build();
		expect(await makePlaybook(actor).buildPlaybookSnapshot()).toBeNull();
	});

	it("returns a PlaybookSnapshot", async () => {
		const snap = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).buildPlaybookSnapshot();
		expect(snap).toBeInstanceOf(PlaybookSnapshot);
	});

	it("snapshot has correct slug, name, img, description, statsNote", async () => {
		const snap = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM])).buildPlaybookSnapshot();
		expect(snap.slug).toBe("the-blessed");
		expect(snap.name).toBe("The Blessed");
		expect(snap.img).toBe("img.webp");
		expect(snap.description).toBe("<p>A healer.</p>");
		expect(snap.statsNote).toBe("Assign +2/+1/+1/0/0/-1");
	});

	it("snapshot sections come from subsystem buildSnapshot() results", async () => {
		const subs = {
			background: new FakeSection("bg-snap"),
			instinct:   new FakeSection("instinct-snap"),
			appearance: new FakeSection("appearance-snap"),
			origin:     new FakeSection("origin-snap"),
			lore:       new FakeSection("lore-snap"),
		};
		const snap = await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), subs).buildPlaybookSnapshot();
		expect(snap.background).toBe("bg-snap");
		expect(snap.instinct).toBe("instinct-snap");
		expect(snap.appearance).toBe("appearance-snap");
		expect(snap.origin).toBe("origin-snap");
		expect(snap.lore).toBe("lore-snap");
	});

	it("passes playbook.backgrounds to background.buildSnapshot", async () => {
		const bg = new FakeSection();
		await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { background: bg }).buildPlaybookSnapshot();
		expect(bg.receivedData()).toEqual(PLAYBOOK_ITEM.system.backgrounds);
	});

	it("passes playbook.instinct to instinct.buildSnapshot", async () => {
		const instinct = new FakeSection();
		await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { instinct }).buildPlaybookSnapshot();
		expect(instinct.receivedData()).toEqual(PLAYBOOK_ITEM.system.instinct);
	});

	it("passes playbook.appearance to appearance.buildSnapshot", async () => {
		const appearance = new FakeSection();
		await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { appearance }).buildPlaybookSnapshot();
		expect(appearance.receivedData()).toEqual(PLAYBOOK_ITEM.system.appearance);
	});

	it("passes playbook.origin to origin.buildSnapshot", async () => {
		const origin = new FakeSection();
		await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { origin }).buildPlaybookSnapshot();
		expect(origin.receivedData()).toEqual(PLAYBOOK_ITEM.system.origin);
	});

	it("passes playbook.lore to lore.buildSnapshot", async () => {
		const lore = new FakeSection();
		await makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { lore }).buildPlaybookSnapshot();
		expect(lore.receivedData()).toEqual(PLAYBOOK_ITEM.system.lore);
	});

	it("falls back to empty arrays when playbook fields are absent", async () => {
		const minimalItem = new TestPlaybookItemBuilder().withSlug("the-blessed").withName("The Blessed").build();
		const bg = new FakeSection();
		const instinct = new FakeSection();
		const appearance = new FakeSection();
		await makePlaybook(makeActor("the-blessed", [minimalItem]), { background: bg, instinct, appearance }).buildPlaybookSnapshot();
		expect(bg.receivedData()).toEqual([]);
		expect(instinct.receivedData()).toBeNull();
		expect(appearance.receivedData()).toBeNull();
	});
});

// ── selectPlaybook ────────────────────────────────────────────────────────────

describe("CharacterPlaybook.selectPlaybook", () => {
	it("updates vitals from the playbook data", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const pb = makePlaybook(makeActor());
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK_DATA);
		expect(vitals.playbookUpdatedWith()).toBe(PLAYBOOK_DATA);
	});

	it("initializes the playbook move category", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const pb = makePlaybook(makeActor());
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK_DATA);
		expect(moves.initializedWith()).toBe(PLAYBOOK_DATA);
	});

	it("increments bg moves after init when background is pre-selected", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const bg     = new FakeBackground("herbalist");
		const pb = makePlaybook(makeActor(), { background: bg });
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK_DATA);
		expect(moves.wasIncremented("playbook-the-blessed", "healing-touch")).toBe(true);
	});

	it("does not increment moves when no background is selected", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const pb = makePlaybook(makeActor());
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK_DATA);
		expect(moves.incrementedCount()).toBe(0);
	});
});

// ── getBackgroundMoveNames ────────────────────────────────────────────────────

describe("CharacterPlaybook.getBackgroundMoveNames", () => {
	it("returns the move slugs for the matching background slug", async () => {
		const pb = makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]));
		expect(await pb.getBackgroundMoveNames("vessel")).toEqual(new Set(["channel"]));
	});

	it("returns empty Set when slug does not match any background", async () => {
		const pb = makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]));
		expect(await pb.getBackgroundMoveNames("unknown-slug")).toEqual(new Set());
	});

	it("returns empty Set when no playbook item is in actor.items", async () => {
		const actor = new FakeActorBuilder().build();
		const pb = makePlaybook(actor);
		expect(await pb.getBackgroundMoveNames("herbalist")).toEqual(new Set());
	});
});

// ── selectBackground ──────────────────────────────────────────────────────────

describe("CharacterPlaybook.selectBackground", () => {
	it("persists the new background selection", async () => {
		const bg = new FakeBackground("");
		const pb = makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { background: bg });
		pb.setMoves(new FakeMoves());
		await pb.selectBackground("herbalist");
		expect(bg.selectedSlug).toBe("herbalist");
	});

	it("increments new bg moves not in the old bg", async () => {
		const bg    = new FakeBackground("");
		const moves = new FakeMoves();
		const pb = makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("herbalist");
		expect(moves.wasIncremented("playbook-the-blessed", "healing-touch")).toBe(true);
	});

	it("decrements old bg moves not in the new bg", async () => {
		const bg    = new FakeBackground("herbalist");
		const moves = new FakeMoves();
		const pb = makePlaybook(makeActor("the-blessed", [PLAYBOOK_ITEM]), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("vessel");
		expect(moves.wasDecremented("playbook-the-blessed", "healing-touch")).toBe(true);
		expect(moves.wasIncremented("playbook-the-blessed", "channel")).toBe(true);
	});

	it("does not increment or decrement moves when no playbook item is in actor.items", async () => {
		const bg    = new FakeBackground("");
		const moves = new FakeMoves();
		const actor = new FakeActorBuilder().build();
		const pb = makePlaybook(actor, { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("herbalist");
		expect(moves.incrementedCount()).toBe(0);
	});
});
