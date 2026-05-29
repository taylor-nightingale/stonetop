import { describe, it, expect, vi } from "vitest";
import { CharacterPlaybook } from "../../../module/actors/character/CharacterPlaybook.js";
import { PlaybookSnapshot } from "../../../module/model/snapshot/character/CharacterSnapshot.js";

// -- Helpers ------------------------------------------------------------------

function makeActor(playbookSlug = "the-blessed") {
	return { system: { playbook: { slug: playbookSlug } }, setFlag: vi.fn(async () => {}) };
}

function makeRepo(data = null) {
	return { findBySlug: vi.fn(async () => data) };
}

function makeFakeSub(result = null) {
	return { buildSnapshot: vi.fn(() => result) };
}

function makeBackground(selectedSlug = "") {
	return { buildSnapshot: vi.fn(), get selectedSlug() { return selectedSlug; } };
}

function makePlaybook(actor, repo, subs = {}) {
	const {
		background = makeBackground(),
		instinct   = makeFakeSub(),
		appearance = makeFakeSub(),
		origin     = makeFakeSub(),
		lore       = makeFakeSub(),
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
		{ slug: "herbalist", moves: ["Healing Touch"] },
		{ slug: "vessel",    moves: ["Channel"] },
	],
	instinct:       { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [{ slug: "pious", label: "Pious", description: "Devout." }] }] },
	appearance:     { slug: "appearance", list: [{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "tall", text: "tall" }, { slug: "short", text: "short" }] }] },
	origin:         [{ region: "The Reach", names: ["Aldric"] }],
};

// -- getData ------------------------------------------------------------------

describe("CharacterPlaybook.getData", () => {
	it("returns null when actor has no playbook slug", async () => {
		expect(await makePlaybook(makeActor(null), makeRepo(PLAYBOOK)).getData()).toBeNull();
	});

	it("calls repo.findBySlug with the actor's playbook slug", async () => {
		const repo = makeRepo(PLAYBOOK);
		await makePlaybook(makeActor("the-blessed"), repo).getData();
		expect(repo.findBySlug).toHaveBeenCalledWith("the-blessed");
	});

	it("returns the playbook from the repo", async () => {
		expect(await makePlaybook(makeActor(), makeRepo(PLAYBOOK)).getData()).toBe(PLAYBOOK);
	});

	it("returns null when repo returns null (slug not found)", async () => {
		expect(await makePlaybook(makeActor("unknown"), makeRepo(null)).getData()).toBeNull();
	});
});

// -- buildPlaybookSnapshot ----------------------------------------------------

describe("CharacterPlaybook.buildPlaybookSnapshot", () => {
	function makeSubs() {
		return {
			background: makeFakeSub("bg-snap"),
			instinct:   makeFakeSub("instinct-snap"),
			appearance: makeFakeSub("appearance-snap"),
			origin:     makeFakeSub("origin-snap"),
			lore:       makeFakeSub("lore-snap"),
		};
	}

	it("returns null when no playbook is set on actor", async () => {
		const snap = await makePlaybook(makeActor(null), makeRepo(null), makeSubs())
			.buildPlaybookSnapshot();
		expect(snap).toBeNull();
	});

	it("returns a PlaybookSnapshot", async () => {
		const snap = await makePlaybook(makeActor(), makeRepo(PLAYBOOK), makeSubs())
			.buildPlaybookSnapshot();
		expect(snap).toBeInstanceOf(PlaybookSnapshot);
	});

	it("snapshot has correct slug, name, img, description, statsNote", async () => {
		const snap = await makePlaybook(makeActor(), makeRepo(PLAYBOOK), makeSubs())
			.buildPlaybookSnapshot();
		expect(snap.slug).toBe("the-blessed");
		expect(snap.name).toBe("The Blessed");
		expect(snap.img).toBe("img.webp");
		expect(snap.description).toBe("<p>A healer.</p>");
		expect(snap.statsNote).toBe("Assign +2/+1/+1/0/0/-1");
	});

	it("delegates to background.buildSnapshot with playbook.backgrounds", async () => {
		const subs = makeSubs();
		await makePlaybook(makeActor(), makeRepo(PLAYBOOK), subs).buildPlaybookSnapshot();
		expect(subs.background.buildSnapshot).toHaveBeenCalledWith(PLAYBOOK.backgrounds);
	});

	it("delegates to instinct.buildSnapshot with playbook.instinct", async () => {
		const subs = makeSubs();
		await makePlaybook(makeActor(), makeRepo(PLAYBOOK), subs).buildPlaybookSnapshot();
		expect(subs.instinct.buildSnapshot).toHaveBeenCalledWith(PLAYBOOK.instinct);
	});

	it("delegates to appearance.buildSnapshot with playbook.appearance", async () => {
		const subs = makeSubs();
		await makePlaybook(makeActor(), makeRepo(PLAYBOOK), subs).buildPlaybookSnapshot();
		expect(subs.appearance.buildSnapshot).toHaveBeenCalledWith(PLAYBOOK.appearance);
	});

	it("delegates to origin.buildSnapshot with playbook.origin", async () => {
		const subs = makeSubs();
		await makePlaybook(makeActor(), makeRepo(PLAYBOOK), subs).buildPlaybookSnapshot();
		expect(subs.origin.buildSnapshot).toHaveBeenCalledWith(PLAYBOOK.origin);
	});

	it("delegates to lore.buildSnapshot with playbook.lore", async () => {
		const subs = makeSubs();
		await makePlaybook(makeActor(), makeRepo(PLAYBOOK), subs).buildPlaybookSnapshot();
		expect(subs.lore.buildSnapshot).toHaveBeenCalledWith(PLAYBOOK.lore);
	});

	it("snapshot sections come from subsystem buildSnapshot() results", async () => {
		const subs = makeSubs();
		const snap = await makePlaybook(makeActor(), makeRepo(PLAYBOOK), subs)
			.buildPlaybookSnapshot();
		expect(snap.background).toBe("bg-snap");
		expect(snap.instinct).toBe("instinct-snap");
		expect(snap.appearance).toBe("appearance-snap");
		expect(snap.origin).toBe("origin-snap");
		expect(snap.lore).toBe("lore-snap");
	});

	it("falls back to empty arrays when playbook fields are absent", async () => {
		const minimal = { slug: "the-blessed", name: "The Blessed" };
		const subs = makeSubs();
		await makePlaybook(makeActor(), makeRepo(minimal), subs).buildPlaybookSnapshot();
		expect(subs.background.buildSnapshot).toHaveBeenCalledWith([]);
		expect(subs.instinct.buildSnapshot).toHaveBeenCalledWith(null);
		expect(subs.appearance.buildSnapshot).toHaveBeenCalledWith(null);
		expect(subs.origin.buildSnapshot).toHaveBeenCalledWith([]);
		expect(subs.lore.buildSnapshot).toHaveBeenCalledWith([]);
	});
});

// -- selectPlaybook -----------------------------------------------------------

describe("CharacterPlaybook.selectPlaybook", () => {
	function makeVitals() {
		return { updateVitalsFromPlaybook: vi.fn(async () => {}) };
	}
	function makeMoves() {
		return {
			initPlaybookCategory: vi.fn(async () => {}),
			incrementMove: vi.fn(async () => {}),
			decrementMove: vi.fn(async () => {}),
		};
	}

	it("calls vitals.updateVitalsFromPlaybook with the playbook data", async () => {
		const vitals = makeVitals();
		const moves  = makeMoves();
		const pb = makePlaybook(makeActor(), makeRepo());
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK);
		expect(vitals.updateVitalsFromPlaybook).toHaveBeenCalledWith(PLAYBOOK);
	});

	it("calls moves.initPlaybookCategory with playbook data only", async () => {
		const vitals = makeVitals();
		const moves  = makeMoves();
		const bg = makeBackground("herbalist");
		const pb = makePlaybook(makeActor(), makeRepo(), { background: bg });
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK);
		expect(moves.initPlaybookCategory).toHaveBeenCalledWith(PLAYBOOK);
	});

	it("increments bg moves after init when background is pre-selected", async () => {
		const vitals = makeVitals();
		const moves  = makeMoves();
		const bg = makeBackground("herbalist");
		const pb = makePlaybook(makeActor(), makeRepo(), { background: bg });
		pb.setVitals(vitals);
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK);
		expect(moves.incrementMove).toHaveBeenCalledWith("playbook-the-blessed", "Healing Touch");
	});

	it("does not call incrementMove when no background is selected", async () => {
		const moves  = makeMoves();
		const pb = makePlaybook(makeActor(), makeRepo());
		pb.setVitals(makeVitals());
		pb.setMoves(moves);
		await pb.selectPlaybook(PLAYBOOK);
		expect(moves.incrementMove).not.toHaveBeenCalled();
	});
});

// -- getBackgroundMoveNames ---------------------------------------------------

describe("CharacterPlaybook.getBackgroundMoveNames", () => {
	it("returns the move names for the matching background slug", async () => {
		const pb = makePlaybook(makeActor(), makeRepo(PLAYBOOK));
		const names = await pb.getBackgroundMoveNames("vessel");
		expect(names).toEqual(new Set(["Channel"]));
	});

	it("returns empty Set when slug does not match any background", async () => {
		const pb = makePlaybook(makeActor(), makeRepo(PLAYBOOK));
		const names = await pb.getBackgroundMoveNames("unknown-slug");
		expect(names).toEqual(new Set());
	});

	it("returns empty Set when no playbook is assigned", async () => {
		const pb = makePlaybook(makeActor(null), makeRepo(null));
		const names = await pb.getBackgroundMoveNames("herbalist");
		expect(names).toEqual(new Set());
	});
});


// -- selectBackground ---------------------------------------------------------

describe("CharacterPlaybook.selectBackground", () => {
	function makeMoves() {
		return {
			incrementMove: vi.fn(async () => {}),
			decrementMove: vi.fn(async () => {}),
		};
	}

	function makeSelectableBackground(selectedSlug = "") {
		return {
			buildSnapshot: vi.fn(),
			selectBackground: vi.fn(async () => {}),
			get selectedSlug() { return selectedSlug; },
		};
	}

	it("calls background.selectBackground with the slug", async () => {
		const bg = makeSelectableBackground("");
		const moves = makeMoves();
		const pb = makePlaybook(makeActor(), makeRepo(PLAYBOOK), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("herbalist");
		expect(bg.selectBackground).toHaveBeenCalledWith("herbalist");
	});

	it("increments new bg moves that were not in the old bg", async () => {
		const bg = makeSelectableBackground("");
		const moves = makeMoves();
		const pb = makePlaybook(makeActor(), makeRepo(PLAYBOOK), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("herbalist");
		expect(moves.incrementMove).toHaveBeenCalledWith("playbook-the-blessed", "Healing Touch");
	});

	it("decrements old bg moves that are not in the new bg", async () => {
		const bg = makeSelectableBackground("herbalist");
		const moves = makeMoves();
		const pb = makePlaybook(makeActor(), makeRepo(PLAYBOOK), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("vessel");
		expect(moves.decrementMove).toHaveBeenCalledWith("playbook-the-blessed", "Healing Touch");
		expect(moves.incrementMove).toHaveBeenCalledWith("playbook-the-blessed", "Channel");
	});

	it("does not call incrementMove or decrementMove when no playbook slug is set", async () => {
		const bg = makeSelectableBackground("");
		const moves = makeMoves();
		const pb = makePlaybook(makeActor(null), makeRepo(PLAYBOOK), { background: bg });
		pb.setMoves(moves);
		await pb.selectBackground("herbalist");
		expect(moves.incrementMove).not.toHaveBeenCalled();
		expect(moves.decrementMove).not.toHaveBeenCalled();
	});
});
