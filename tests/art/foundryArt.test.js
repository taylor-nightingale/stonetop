import { describe, it, expect } from "vitest";
import { beforeEach } from "vitest";
import { isArtInstalled, hasArtFile, clearArtFileCache } from "../../src/art/foundryArt.js";

describe("isArtInstalled", () => {
	it("is true when the wonders folder has files", async () => {
		const picker = { browse: async () => ({ files: ["stonetop-art/wonders/x.png"], dirs: [] }) };
		expect(await isArtInstalled(picker)).toBe(true);
	});
	it("is false when the folder is empty", async () => {
		const picker = { browse: async () => ({ files: [], dirs: [] }) };
		expect(await isArtInstalled(picker)).toBe(false);
	});
	it("is false when the folder does not exist (browse throws)", async () => {
		const picker = { browse: async () => { throw new Error("does not exist"); } };
		expect(await isArtInstalled(picker)).toBe(false);
	});
});

// `isArtInstalled` answers "did the user run the installer"; this answers "did THIS file come out of
// it". They differ: Book I is optional, so a world can hold wonders art and no steading art — and a
// sheet that linked a missing plate would 404 on every single render.
describe("hasArtFile", () => {
	beforeEach(() => clearArtFileCache());

	const pickerWith = (...files) => ({ browse: async () => ({ files, dirs: [] }) });

	it("is true when the directory holds the file", async () => {
		const picker = pickerWith("stonetop-art/steading/residents.png", "stonetop-art/steading/seasons.png");
		expect(await hasArtFile("stonetop-art/steading/seasons.png", picker)).toBe(true);
	});

	it("is false when the directory holds other files but not that one", async () => {
		const picker = pickerWith("stonetop-art/steading/residents.png");
		expect(await hasArtFile("stonetop-art/steading/seasons.png", picker)).toBe(false);
	});

	it("is false when the directory does not exist (browse throws)", async () => {
		const picker = { browse: async () => { throw new Error("does not exist"); } };
		expect(await hasArtFile("stonetop-art/steading/seasons.png", picker)).toBe(false);
	});

	// A sheet asks on every render; the answer only changes when the installer runs.
	it("browses once per path and reuses the answer", async () => {
		let calls = 0;
		const picker = { browse: async () => { calls++; return { files: ["stonetop-art/steading/seasons.png"] }; } };
		await hasArtFile("stonetop-art/steading/seasons.png", picker);
		await hasArtFile("stonetop-art/steading/seasons.png", picker);
		expect(calls).toBe(1);
	});

	it("caches concurrent probes as one browse", async () => {
		let calls = 0;
		const picker = { browse: async () => { calls++; return { files: [] }; } };
		await Promise.all([
			hasArtFile("stonetop-art/steading/seasons.png", picker),
			hasArtFile("stonetop-art/steading/seasons.png", picker),
		]);
		expect(calls).toBe(1);
	});
});
