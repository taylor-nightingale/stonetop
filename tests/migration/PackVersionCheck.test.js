import { describe, it, expect, vi, afterEach } from "vitest";
import { PackVersionCheck, PACK_VERSION_FLAG } from "../../src/migration/PackVersionCheck.js";

// A compiled pack document carries the version of the system that built it. Foundry extracts a system
// update over the installed folder and holds every pack's database open while a world is loaded, so an
// update can replace the code and leave the packs untouched. The result reads as perfectly valid
// content — just the previous release's — which is why it has to be detected rather than noticed.

function entry(version) {
	return version === undefined
		? { _id: "e1", name: "Hec’tumel Codex" }
		: { _id: "e1", name: "Hec’tumel Codex", flags: { stonetop: { [PACK_VERSION_FLAG]: version } } };
}

function pack(label, entries, { packageType = "system", packageName = "stonetop" } = {}) {
	return {
		collection: `stonetop.${label}`,
		metadata: { label, packageType, packageName },
		index: entries,
		getIndex: vi.fn(async () => entries),
	};
}

const check = (packs, version = "1.0.3") => new PackVersionCheck(packs, version);

afterEach(() => vi.unstubAllGlobals());

describe("PackVersionCheck.stalePacks", () => {
	it("reports nothing when the pack was built by the running version", async () => {
		expect(await check([pack("Arcana", [entry("1.0.3")])]).stalePacks()).toEqual([]);
	});

	it("names a pack built by an older version", async () => {
		expect(await check([pack("Arcana", [entry("0.14.0")])]).stalePacks()).toEqual(["Arcana"]);
	});

	// The install this was written for: packs compiled before the stamp existed carry no version at all.
	it("treats an unstamped pack as stale", async () => {
		expect(await check([pack("Arcana", [entry(undefined)])]).stalePacks()).toEqual(["Arcana"]);
	});

	it("does not accuse an empty pack — there is no content to be out of date", async () => {
		expect(await check([pack("Arcana", [])]).stalePacks()).toEqual([]);
	});

	it("names every stale pack, not just the first", async () => {
		const packs = [pack("Arcana", [entry("0.14.0")]), pack("Moves", [entry("1.0.3")]), pack("Playbooks", [entry(undefined)])];
		expect(await check(packs).stalePacks()).toEqual(["Arcana", "Playbooks"]);
	});

	it("asks for the version field when indexing, or the flag would not be there to read", async () => {
		const p = pack("Arcana", [entry("1.0.3")]);
		await check([p]).stalePacks();
		expect(p.getIndex).toHaveBeenCalledWith({ fields: ["flags.stonetop.packVersion"] });
	});
});

describe("PackVersionCheck.systemPacks", () => {
	const stub = packs => vi.stubGlobal("game", { packs });

	it("collects the packs this system ships", () => {
		stub([pack("Arcana", []), pack("Moves", [])]);
		expect(PackVersionCheck.systemPacks().map(p => p.metadata.label)).toEqual(["Arcana", "Moves"]);
	});

	it("ignores packs belonging to a module or a world", () => {
		stub([
			pack("Arcana", []),
			pack("Homebrew", [], { packageType: "world", packageName: "my-world" }),
			pack("Extras",  [], { packageType: "module", packageName: "some-module" }),
		]);
		expect(PackVersionCheck.systemPacks().map(p => p.metadata.label)).toEqual(["Arcana"]);
	});

	it("tolerates a game with no packs collection yet", () => {
		vi.stubGlobal("game", {});
		expect(PackVersionCheck.systemPacks()).toEqual([]);
	});
});
