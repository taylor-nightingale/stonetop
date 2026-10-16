import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The migration itself is exercised by the migration suite; what matters here is the gate around it —
// which actors ran is the runner's business, whether the world is marked done is this hook's.
const run = vi.fn(async () => []);
const stamp = vi.fn(async () => {});

vi.mock("../../src/migration/MigrationRunner.js", () => ({
	MigrationRunner: class { run(...args) { return run(...args); } },
}));
vi.mock("../../src/migration/migrateItemProvenance.js", () => ({
	migrateItemProvenance: (...args) => stamp(...args),
}));
vi.mock("../../src/actors/PackProvenance.js", () => ({ PackProvenance: class {} }));
vi.mock("../../src/actors/character/repositories/FoundryRepositoryFactory.js", () => ({
	FoundryRepositoryFactory: class {},
}));
const artInstalled = vi.fn(async () => true);
const trimRun = vi.fn(async () => []);
vi.mock("../../src/art/foundryArt.js", () => ({
	isArtInstalled: (...args) => artInstalled(...args),
	createInstalledArtTrim: async () => ({ run: () => trimRun() }),
}));
// Pinned to the version the stubbed world reports, so every test below runs as a current client.
// The stale-client gate is exercised by overriding `game.system.version` in its own suite.
vi.mock("../../src/version.js", () => ({ SYSTEM_VERSION: "1.0.2" }));

import { onReady, trimInstalledArt } from "../../src/hooks/Ready.js";

const settings = {};
const errors   = [];

/** A system compendium whose documents were compiled by `version` (undefined = built before stamping). */
function systemPack(label, version) {
	const index = [{ _id: "e1", flags: version === undefined ? {} : { stonetop: { packVersion: version } } }];
	return { collection: `stonetop.${label}`, metadata: { label, packageType: "system", packageName: "stonetop" }, index, getIndex: async () => index };
}

/** `game.packs` is a Collection: iterable, and `get`-able by name. */
function packsCollection(packs = []) {
	const list = [...packs];
	list.get = name => list.find(p => p.collection === name) ?? null;
	return list;
}

beforeEach(() => {
	run.mockClear();
	stamp.mockClear();
	errors.length = 0;
	settings.systemVersion   = "0.14.0";
	settings.artNudgeDismissed = true;
	settings.artTrimmed = true;
	artInstalled.mockClear();
	artInstalled.mockImplementation(async () => true);
	trimRun.mockClear();
	trimRun.mockImplementation(async () => []);
	vi.stubGlobal("game", {
		user:   { isGM: true },
		system: { version: "1.0.2" },
		packs:  packsCollection([systemPack("Arcana", "1.0.2")]),
		i18n:   { localize: k => k, format: (k, data) => `${k}:${JSON.stringify(data)}` },
		settings: {
			get: (_scope, key) => settings[key],
			set: async (_scope, key, value) => { settings[key] = value; },
		},
	});
	vi.stubGlobal("ui", { notifications: { info: () => {}, error: msg => errors.push(msg) } });
	vi.stubGlobal("foundry", { utils: {
		isNewerVersion: (a, b) => a > b,
		deepClone: o => structuredClone(o),
		getProperty: (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj),
	} });
});

afterEach(() => vi.unstubAllGlobals());

describe("onReady — marking the world migrated", () => {
	it("stamps the new version after a clean run", async () => {
		await onReady();
		expect(run).toHaveBeenCalledOnce();
		expect(settings.systemVersion).toBe("1.0.2");
	});

	// The stamp is what gates every pass in the migration, so stamping a world where an actor threw
	// would skip the passes that actor missed for good — leaving its sheet on stale content forever.
	it("leaves the stored version alone when an actor failed, so the next load retries", async () => {
		run.mockImplementationOnce(async () => ["Brakken"]);
		await onReady();
		expect(settings.systemVersion).toBe("0.14.0");
	});

	it("tells the GM which actors failed", async () => {
		run.mockImplementationOnce(async () => ["Brakken", "Wren"]);
		await onReady();
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("Brakken, Wren");
	});

	it("does not migrate at all when the stored version is already current", async () => {
		settings.systemVersion = "1.0.2";
		await onReady();
		expect(run).not.toHaveBeenCalled();
	});

	it("does nothing for a player — migration is the GM's client's job", async () => {
		game.user.isGM = false;
		await onReady();
		expect(run).not.toHaveBeenCalled();
		expect(settings.systemVersion).toBe("0.14.0");
	});
});

// Foundry extracts a system update over the installed folder and holds every pack's database open
// while a world is loaded, so an update can replace the code and leave the compendium behind. The
// migration's whole job is copying pack content onto sheets — run it against a stale pack and it
// writes the previous release's content onto every character, which is far worse than not running.
// Provenance is not content: it says which compendium document an embedded item is a copy of, which
// is what lets Babele (and anything else that looks an item up by source) find it at all. A world
// already stamped at this version would never see it if it rode inside the version-gated migration.
describe("onReady — stamping item provenance", () => {
	it("stamps every actor, even when no migration is due", async () => {
		settings.systemVersion = "1.0.2";           // already migrated: the runner will not be called
		game.actors = [{ name: "Wren" }, { name: "Brakken" }];

		await onReady();

		expect(run).not.toHaveBeenCalled();
		expect(stamp).toHaveBeenCalledTimes(2);
	});

	it("shares one lookup cache across every actor", async () => {
		game.actors = [{ name: "Wren" }, { name: "Brakken" }];

		await onReady();

		expect(stamp.mock.calls[0][1]).toBe(stamp.mock.calls[1][1]);
	});

	// Stamping reads ids off the packs, so a compendium the update left behind would hand out wrong ones.
	it("does not stamp against a stale compendium", async () => {
		game.packs = packsCollection([systemPack("Arcana", "0.9.0")]);
		game.actors = [{ name: "Wren" }];

		await onReady();

		expect(stamp).not.toHaveBeenCalled();
	});

	it("carries on past an actor that throws", async () => {
		stamp.mockImplementationOnce(async () => { throw new Error("no index"); });
		game.actors = [{ name: "Wren" }, { name: "Brakken" }];

		await onReady();

		expect(stamp).toHaveBeenCalledTimes(2);
		expect(settings.systemVersion).toBe("1.0.2");
	});
});

describe("onReady — a compendium the update left behind", () => {
	it("does not migrate when a pack was built by a different version", async () => {
		game.packs = packsCollection([systemPack("Arcana", "0.14.0")]);
		await onReady();
		expect(run).not.toHaveBeenCalled();
	});

	it("tells the GM to reinstall", async () => {
		game.packs = packsCollection([systemPack("Arcana", "0.14.0")]);
		await onReady();
		expect(errors).toEqual(["stonetop.migration.stalePacks"]);
	});

	it("leaves the version unstamped so the migration runs once the install is repaired", async () => {
		game.packs = packsCollection([systemPack("Arcana", "0.14.0")]);
		await onReady();
		expect(settings.systemVersion).toBe("0.14.0");
	});

	// The worlds already hitting this have stamped the current version, so the version gate would send
	// them home before they ever heard about it.
	it("warns even when the world is already on the current version", async () => {
		settings.systemVersion = "1.0.2";
		game.packs = packsCollection([systemPack("Arcana", "0.14.0")]);
		await onReady();
		expect(errors).toEqual(["stonetop.migration.stalePacks"]);
	});

	it("treats a pack compiled before stamping existed as stale", async () => {
		game.packs = packsCollection([systemPack("Arcana", undefined)]);
		await onReady();
		expect(run).not.toHaveBeenCalled();
		expect(errors).toEqual(["stonetop.migration.stalePacks"]);
	});

	it("migrates normally once every pack matches", async () => {
		game.packs = packsCollection([systemPack("Arcana", "1.0.2"), systemPack("Moves", "1.0.2")]);
		await onReady();
		expect(run).toHaveBeenCalledOnce();
		expect(errors).toEqual([]);
		expect(settings.systemVersion).toBe("1.0.2");
	});
});

// A browser holds a system's JavaScript by an unversioned URL, so it can go on running the previous
// release's code against an updated world. Templates are never cached, so that client is handed fresh
// ones referring to partials its code never registered — and its sheets stop opening.
describe("onReady — the stale client gate", () => {
	it("says nothing while the cached code matches the install", async () => {
		await onReady();
		expect(errors).toEqual([]);
	});

	it("tells a client running last release's code to reload", async () => {
		game.system.version = "1.0.3";
		await onReady();
		expect(errors).toEqual(['stonetop.staleClient:{"installed":"1.0.3","loaded":"1.0.2"}']);
	});

	// The code running the migration would be the previous release's, so its pass list is too. Finishing
	// would stamp the world as migrated to the version now installed and skip this release's passes for
	// good — the same trap the stale-pack gate exists to avoid.
	it("does not migrate or stamp the world from a stale client", async () => {
		game.system.version = "1.0.3";
		await onReady();
		expect(run).not.toHaveBeenCalled();
		expect(settings.systemVersion).toBe("0.14.0");
	});

	// The GM gate sits below this one on purpose: players are the ones staring at a sheet that will not
	// open, and they can do nothing about it until someone tells them to hard-reload.
	it("warns players, not just the GM", async () => {
		game.user.isGM = false;
		game.system.version = "1.0.3";
		await onReady();
		expect(errors).toEqual(['stonetop.staleClient:{"installed":"1.0.3","loaded":"1.0.2"}']);
	});
});

// Art installed before the store kept the major arcana trimmed still has the books' padded canvas.
// It is trimmed once per world, silently, and a failure is tried again on the next load.
describe("trimInstalledArt", () => {
	beforeEach(() => { settings.artTrimmed = false; });

	it("trims the installed art and marks the world done", async () => {
		await trimInstalledArt();
		expect(trimRun).toHaveBeenCalledOnce();
		expect(settings.artTrimmed).toBe(true);
	});

	it("does nothing in a world already done", async () => {
		settings.artTrimmed = true;
		await trimInstalledArt();
		expect(trimRun).not.toHaveBeenCalled();
	});

	// The installer writes them trimmed, so a world with no art yet never needs the pass.
	it("marks a world with no art installed done without reading anything", async () => {
		artInstalled.mockImplementation(async () => false);
		await trimInstalledArt();
		expect(trimRun).not.toHaveBeenCalled();
		expect(settings.artTrimmed).toBe(true);
	});

	it("leaves the world unmarked when the trim fails, so the next load tries again", async () => {
		trimRun.mockImplementation(async () => { throw new Error("upload refused"); });
		await expect(trimInstalledArt()).resolves.toBeUndefined();
		expect(settings.artTrimmed).toBe(false);
	});

	it("runs from the GM's ready", async () => {
		await onReady();
		await vi.waitFor(() => expect(trimRun).toHaveBeenCalledOnce());
	});
});
