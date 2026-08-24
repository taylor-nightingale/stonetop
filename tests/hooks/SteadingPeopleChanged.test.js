import { afterEach, describe, expect, it, vi } from "vitest";
import { onPreUpdateSteadingPeople, onUpdateSteadingPeople, PEOPLE_DELTA_KEY } from "../../src/hooks/SteadingPeopleChanged.js";

const gm     = { id: "gm" };
const player = { id: "p" };

function stubGame({ user = gm, activeGM = gm, autoCreate = true } = {}) {
	vi.stubGlobal("game", {
		user,
		users: { activeGM },
		settings: { get: () => autoCreate },
	});
}

const steading = (syncLinkedActors = vi.fn(async () => {})) => ({
	type: "steading",
	system: { residentPeople: [{ id: "p1", name: "Willa" }] },
	typedActor: { syncLinkedActors },
});

afterEach(() => vi.unstubAllGlobals());

describe("onPreUpdateSteadingPeople", () => {
	it("stashes the delta on the update options", () => {
		const options = {};
		onPreUpdateSteadingPeople(steading(), { system: { residentPeople: [{ id: "p1", name: "Willa Fletcher" }] } }, options);
		expect(options[PEOPLE_DELTA_KEY]).toEqual({ residents: ["p1"], neighbors: [] });
	});

	it("stashes nothing when no person changed", () => {
		const options = {};
		onPreUpdateSteadingPeople(steading(), { system: { attributes: {} } }, options);
		expect(options[PEOPLE_DELTA_KEY]).toBeUndefined();
	});

	it("ignores actors that are not steadings", () => {
		const options = {};
		onPreUpdateSteadingPeople({ type: "character", system: {} }, { system: { residentPeople: [{ id: "p1", name: "X" }] } }, options);
		expect(options[PEOPLE_DELTA_KEY]).toBeUndefined();
	});
});

describe("onUpdateSteadingPeople", () => {
	it("syncs the changed rows on the active GM's client", async () => {
		stubGame();
		const sync = vi.fn(async () => {});
		await onUpdateSteadingPeople(steading(sync), {}, { [PEOPLE_DELTA_KEY]: { residents: ["p1"], neighbors: [] } });
		expect(sync).toHaveBeenCalledOnce();
		expect(sync.mock.calls[0][0].residents).toEqual(["p1"]);
	});

	it("does nothing on a player's client — creating actors is not theirs to do", async () => {
		stubGame({ user: player, activeGM: gm });
		const sync = vi.fn(async () => {});
		await onUpdateSteadingPeople(steading(sync), {}, { [PEOPLE_DELTA_KEY]: { residents: ["p1"], neighbors: [] } });
		expect(sync).not.toHaveBeenCalled();
	});

	it("does nothing when no GM is connected", async () => {
		stubGame({ user: player, activeGM: null });
		const sync = vi.fn(async () => {});
		await onUpdateSteadingPeople(steading(sync), {}, { [PEOPLE_DELTA_KEY]: { residents: ["p1"], neighbors: [] } });
		expect(sync).not.toHaveBeenCalled();
	});

	it("does nothing when only one of several GMs is designated active", async () => {
		stubGame({ user: { id: "gm2" }, activeGM: gm });
		const sync = vi.fn(async () => {});
		await onUpdateSteadingPeople(steading(sync), {}, { [PEOPLE_DELTA_KEY]: { residents: ["p1"], neighbors: [] } });
		expect(sync).not.toHaveBeenCalled();
	});

	it("does nothing when the world setting is off", async () => {
		stubGame({ autoCreate: false });
		const sync = vi.fn(async () => {});
		await onUpdateSteadingPeople(steading(sync), {}, { [PEOPLE_DELTA_KEY]: { residents: ["p1"], neighbors: [] } });
		expect(sync).not.toHaveBeenCalled();
	});

	it("does nothing for an update that carried no delta", async () => {
		stubGame();
		const sync = vi.fn(async () => {});
		await onUpdateSteadingPeople(steading(sync), {}, {});
		expect(sync).not.toHaveBeenCalled();
	});
});
