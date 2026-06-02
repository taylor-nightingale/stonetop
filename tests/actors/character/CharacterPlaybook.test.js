import { describe, it, expect } from "vitest";
import { CharacterPlaybook } from "../../../src/actors/character/CharacterPlaybook.js";
import { PlaybookSnapshot } from "../../../src/model/snapshot/character/CharacterSnapshot.js";
import { FakePlaybookRepository } from "../../fakes/FakePlaybookRepository.js";
import { FakeMoves } from "../../fakes/FakeMoves.js";
import { FakeVitals } from "../../fakes/FakeVitals.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { StonetopFlags } from "../../../src/actors/character/StonetopFlags.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeActor(playbookSlug = "the-blessed") {
	const actor = new FakeActorBuilder().withPlaybook(playbookSlug).build();
	return actor;
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

function makePlaybook(actor, repo, subs = {}) {
	const {
		background = new FakeBackground(),
		instinct   = new FakeSection(),
		appearance = new FakeSection(),
		origin     = new FakeSection(),
		lore       = new FakeSection(),
	} = subs;
	return new CharacterPlaybook(actor, repo, background, instinct, appearance, origin, lore);
}

const PLAYBOOK = {
	slug:           "the-blessed",
	name:           "The Blessed",
	img:            "img.webp",
	description:    "<p>A healer.</p>",
	statsNote:      "Assign +2/+1/+1/0/0/-1",
	lore:           [{ slug: "lore-1" }],
	backgrounds:    [
		{ slug: "herbalist", moves: ["healing-touch"] },
		{ slug: "vessel",    moves: ["channel"] },
	],
	instinct:       { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [{ slug: "pious", label: "Pious", description: "Devout." }] }] },
	appearance:     { slug: "appearance", list: [{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "tall", text: "tall" }, { slug: "short", text: "short" }] }] },
	origin:         [{ region: "The Reach", names: ["Aldric"] }],
};

// ── getData ───────────────────────────────────────────────────────────────────

describe("CharacterPlaybook.getData", () => {
	it("returns null when actor has no playbook slug", async () => {
		const actor = new FakeActorBuilder().build();
		expect(await makePlaybook(actor, new FakePlaybookRepository(PLAYBOOK)).getData()).toBeNull();
	});

	it("returns the playbook from the repo when slug matches", async () => {
		expect(await makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK)).getData()).toBe(PLAYBOOK);
	});

	it("returns null when repo returns null (slug not found)", async () => {
		expect(await makePlaybook(makeActor("unknown"), new FakePlaybookRepository()).getData()).toBeNull();
	});

	it("returns null for a different actor slug when only another playbook is registered", async () => {
		const repo = new FakePlaybookRepository(PLAYBOOK);
		expect(await makePlaybook(makeActor("the-heavy"), repo).getData()).toBeNull();
	});
});

// ── buildPlaybookSnapshot ─────────────────────────────────────────────────────

describe("CharacterPlaybook.buildPlaybookSnapshot", () => {
	it("returns null when no playbook is set on actor", async () => {
		const actor = new FakeActorBuilder().build();
		expect(await makePlaybook(actor, new FakePlaybookRepository()).buildPlaybookSnapshot()).toBeNull();
	});

	it("returns a PlaybookSnapshot", async () => {
		const snap = await makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK)).buildPlaybookSnapshot();
		expect(snap).toBeInstanceOf(PlaybookSnapshot);
	});

	it("snapshot has correct slug, name, img, description, statsNote", async () => {
		const snap = await makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK)).buildPlaybookSnapshot();
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
		const snap = await makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK), subs).buildPlaybookSnapshot();
		expect(snap.background).toBe("bg-snap");
		expect(snap.instinct).toBe("instinct-snap");
		expect(snap.appearance).toBe("appearance-snap");
		expect(snap.origin).toBe("origin-snap");
		expect(snap.lore).toBe("lore-snap");
	});

	it("passes playbook.backgrounds to background.buildSnapshot", async () => {
		const bg = new FakeSection();
		await makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK), { background: bg }).buildPlaybookSnapshot();
		expect(bg.receivedData()).toEqual(PLAYBOOK.backgrounds);
	});

	it("passes playbook.instinct to instinct.buildSnapshot", async () => {
		const instinct = new FakeSection();
		await makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK), { instinct }).buildPlaybookSnapshot();
		expect(instinct.receivedData()).toEqual(PLAYBOOK.instinct);
	});

	it("passes playbook.appearance to appearance.buildSnapshot", async () => {
		const appearance = new FakeSection();
		await makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK), { appearance }).buildPlaybookSnapshot();
		expect(appearance.receivedData()).toEqual(PLAYBOOK.appearance);
	});

	it("passes playbook.origin to origin.buildSnapshot", async () => {
		const origin = new FakeSection();
		await makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK), { origin }).buildPlaybookSnapshot();
		expect(origin.receivedData()).toEqual(PLAYBOOK.origin);
	});

	it("passes playbook.lore to lore.buildSnapshot", async () => {
		const lore = new FakeSection();
		await makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK), { lore }).buildPlaybookSnapshot();
		expect(lore.receivedData()).toEqual(PLAYBOOK.lore);
	});

	it("falls back to empty arrays when playbook fields are absent", async () => {
		const minimal = { slug: "the-blessed", name: "The Blessed" };
		const bg = new FakeSection();
		const instinct = new FakeSection();
		const appearance = new FakeSection();
		await makePlaybook(makeActor(), new FakePlaybookRepository(minimal), { background: bg, instinct, appearance }).buildPlaybookSnapshot();
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
		const pb = makePlaybook(makeActor(), new FakePlaybookRepository());
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK);
		expect(vitals.playbookUpdatedWith()).toBe(PLAYBOOK);
	});

	it("initializes the playbook move category", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const pb = makePlaybook(makeActor(), new FakePlaybookRepository());
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK);
		expect(moves.initializedWith()).toBe(PLAYBOOK);
	});

	it("increments bg moves after init when background is pre-selected", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const bg     = new FakeBackground("herbalist");
		const pb = makePlaybook(makeActor(), new FakePlaybookRepository(), { background: bg });
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK);
		expect(moves.wasIncremented("playbook-the-blessed", "healing-touch")).toBe(true);
	});

	it("does not increment moves when no background is selected", async () => {
		const vitals = new FakeVitals();
		const moves  = new FakeMoves();
		const pb = makePlaybook(makeActor(), new FakePlaybookRepository());
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK);
		expect(moves.incrementedCount()).toBe(0);
	});
});

// ── getBackgroundMoveNames ────────────────────────────────────────────────────

describe("CharacterPlaybook.getBackgroundMoveNames", () => {
	it("returns the move slugs for the matching background slug", async () => {
		const pb = makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK));
		expect(await pb.getBackgroundMoveNames("vessel")).toEqual(new Set(["channel"]));
	});

	it("returns empty Set when slug does not match any background", async () => {
		const pb = makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK));
		expect(await pb.getBackgroundMoveNames("unknown-slug")).toEqual(new Set());
	});

	it("returns empty Set when no playbook is assigned", async () => {
		const actor = new FakeActorBuilder().build();
		const pb = makePlaybook(actor, new FakePlaybookRepository());
		expect(await pb.getBackgroundMoveNames("herbalist")).toEqual(new Set());
	});
});

// ── selectBackground ──────────────────────────────────────────────────────────

describe("CharacterPlaybook.selectBackground", () => {
	it("persists the new background selection", async () => {
		const bg = new FakeBackground("");
		const pb = makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK), { background: bg });
		pb.setMoves(new FakeMoves());
		await pb.selectBackground("herbalist");
		expect(bg.selectedSlug).toBe("herbalist");
	});

	it("increments new bg moves not in the old bg", async () => {
		const bg    = new FakeBackground("");
		const moves = new FakeMoves();
		const pb = makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("herbalist");
		expect(moves.wasIncremented("playbook-the-blessed", "healing-touch")).toBe(true);
	});

	it("decrements old bg moves not in the new bg", async () => {
		const bg    = new FakeBackground("herbalist");
		const moves = new FakeMoves();
		const pb = makePlaybook(makeActor(), new FakePlaybookRepository(PLAYBOOK), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("vessel");
		expect(moves.wasDecremented("playbook-the-blessed", "healing-touch")).toBe(true);
		expect(moves.wasIncremented("playbook-the-blessed", "channel")).toBe(true);
	});

	it("does not increment or decrement moves when no playbook slug is set", async () => {
		const bg    = new FakeBackground("");
		const moves = new FakeMoves();
		const actor = new FakeActorBuilder().build();
		const pb = makePlaybook(actor, new FakePlaybookRepository(PLAYBOOK), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("herbalist");
		expect(moves.incrementedCount()).toBe(0);
	});
});
