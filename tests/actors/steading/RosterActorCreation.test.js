import { afterEach, describe, expect, it, vi } from "vitest";
import { RosterActorCreation } from "../../../src/actors/steading/RosterActorCreation.js";
import { PersonActorPlan } from "../../../src/actors/steading/PersonActorPlan.js";

function stubFoundry(confirmed) {
	const confirm = vi.fn(async () => confirmed);
	const info    = vi.fn();
	vi.stubGlobal("foundry", { applications: { api: { DialogV2: { confirm } } } });
	vi.stubGlobal("ui", { notifications: { info } });
	vi.stubGlobal("game", {
		i18n: { localize: key => key, format: (key, data) => `${key}:${JSON.stringify(data)}` },
	});
	return { confirm, info };
}

const plan = (name, action) => new PersonActorPlan(name, "Stonetop", action);

function spySteading(plans = [plan("Willa", PersonActorPlan.CREATE)]) {
	return {
		previewFolkActors:       vi.fn(async () => plans),
		createMissingFolkActors: vi.fn(async () => {}),
	};
}

afterEach(() => vi.unstubAllGlobals());

describe("RosterActorCreation.forFolk", () => {
	it("creates once the GM confirms", async () => {
		stubFoundry(true);
		const steading = spySteading();
		await RosterActorCreation.forFolk(steading).run();
		expect(steading.previewFolkActors).toHaveBeenCalledOnce();
		expect(steading.createMissingFolkActors).toHaveBeenCalledOnce();
	});

	it("writes nothing when the GM declines", async () => {
		stubFoundry(false);
		const steading = spySteading();
		await RosterActorCreation.forFolk(steading).run();
		expect(steading.createMissingFolkActors).not.toHaveBeenCalled();
	});

	it("shows the plans before doing any of them", async () => {
		const { confirm } = stubFoundry(true);
		const steading = spySteading();
		await RosterActorCreation.forFolk(steading).run();
		expect(confirm).toHaveBeenCalledOnce();
		expect(confirm.mock.invocationCallOrder[0])
			.toBeLessThan(steading.createMissingFolkActors.mock.invocationCallOrder[0]);
	});

	it("says so and asks nothing when there is no work", async () => {
		const { confirm, info } = stubFoundry(true);
		const steading = spySteading([plan("Idony", PersonActorPlan.LINKED)]);
		await RosterActorCreation.forFolk(steading).run();
		expect(confirm).not.toHaveBeenCalled();
		expect(info).toHaveBeenCalledWith("stonetop.steading.createActors.nothing");
		expect(steading.createMissingFolkActors).not.toHaveBeenCalled();
	});
});
