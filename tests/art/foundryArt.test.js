import { describe, it, expect } from "vitest";
import { isArtInstalled } from "../../src/art/foundryArt.js";

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
