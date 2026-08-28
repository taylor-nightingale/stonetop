import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The migration itself is exercised by the migration suite; what matters here is the gate around it —
// which actors ran is the runner's business, whether the world is marked done is this hook's.
const run = vi.fn(async () => []);

vi.mock("../../src/migration/MigrationRunner.js", () => ({
	MigrationRunner: class { run(...args) { return run(...args); } },
}));
vi.mock("../../src/actors/character/repositories/FoundryRepositoryFactory.js", () => ({
	FoundryRepositoryFactory: class {},
}));
vi.mock("../../src/art/foundryArt.js", () => ({ isArtInstalled: async () => true }));
// Pinned to the version the stubbed world reports, so every test below runs as a current client.
// The stale-client gate is exercised by overriding `game.system.version` in its own suite.
vi.mock("../../src/version.js", () => ({ SYSTEM_VERSION: "1.0.2" }));

import { onReady } from "../../src/hooks/Ready.js";

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
	errors.length = 0;
	settings.systemVersion   = "0.14.0";
	settings.artNudgeDismissed = true;
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
