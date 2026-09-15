import { describe, it, expect, beforeEach, vi } from "vitest";

// The picker is the only Foundry surface these paths touch; `hasArtFile` takes one, so the module's
// own default-picker lookup never runs.
vi.mock("../../../../src/art/foundryArt.js", async importOriginal => {
	const actual = await importOriginal();
	// `artFileUrl` routes the stored path for this install; stubbed with the shape a route prefix
	// gives, so the repository's contract — a URL, not the raw path — is what the tests assert.
	return { ...actual, hasArtFile: vi.fn(), artFileUrl: vi.fn(p => `/${p}`) };
});

import { FoundrySteadingArtRepository } from "../../../../src/actors/steading/repositories/FoundrySteadingArtRepository.js";
import { hasArtFile, artFileUrl } from "../../../../src/art/foundryArt.js";

const SEASONS   = "stonetop-art/steading/seasons.png";
const RESOURCES = "stonetop-art/wonders/35054ea8d15b39521589bc2cab68c9f309301fe645948ac9fd0ed37d920da6c7.png";
const RESIDENTS = "stonetop-art/steading/residents.png";

beforeEach(() => { hasArtFile.mockReset(); artFileUrl.mockClear(); });

describe("FoundrySteadingArtRepository", () => {
	// The ROUTED url, not the stored path: the seasons plate is handed to `shape-outside`, and a
	// relative url() in CSS resolves against the stylesheet, not the document — which 404'd and left
	// the text wrapping to the plate's plain box for as long as it was relative.
	it("gives the seasons plate's routed url when this world installed it", async () => {
		hasArtFile.mockResolvedValue(true);
		expect(await new FoundrySteadingArtRepository().seasonsPlate()).toBe(`/${SEASONS}`);
		expect(hasArtFile).toHaveBeenCalledWith(SEASONS);
		expect(artFileUrl).toHaveBeenCalledWith(SEASONS);
	});

	it("gives the resources plate's routed url when this world installed it", async () => {
		hasArtFile.mockResolvedValue(true);
		expect(await new FoundrySteadingArtRepository().resourcesPlate()).toBe(`/${RESOURCES}`);
		expect(hasArtFile).toHaveBeenCalledWith(RESOURCES);
	});

	it("gives the residents plate's routed url when this world installed it", async () => {
		hasArtFile.mockResolvedValue(true);
		expect(await new FoundrySteadingArtRepository().residentsPlate()).toBe(`/${RESIDENTS}`);
		expect(hasArtFile).toHaveBeenCalledWith(RESIDENTS);
	});

	// Book I is optional and the installer may never have been run at all, so "not installed" is an
	// ordinary answer — null, which is what stops the sheet linking a path that 404s on every render.
	it("answers null for a plate this world has not installed", async () => {
		hasArtFile.mockResolvedValue(false);
		const repo = new FoundrySteadingArtRepository();
		expect(await repo.seasonsPlate()).toBeNull();
		expect(await repo.resourcesPlate()).toBeNull();
		expect(await repo.residentsPlate()).toBeNull();
	});

	it("answers each plate independently — a world can have one and not the other", async () => {
		hasArtFile.mockImplementation(async path => path === RESOURCES);
		const repo = new FoundrySteadingArtRepository();
		expect(await repo.seasonsPlate()).toBeNull();
		expect(await repo.residentsPlate()).toBeNull();
		expect(await repo.resourcesPlate()).toBe(`/${RESOURCES}`);
	});
});
