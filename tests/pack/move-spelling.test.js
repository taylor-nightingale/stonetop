import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const read = async file => JSON.parse(await fs.readFile(path.resolve(file), "utf8"));

describe("Death's Door", () => {
	it("is spelt as the book spells it", async () => {
		expect((await read("packs/src/moves/special/deaths-door.json")).name).toBe("Death's Door");
	});
});

describe("Strengthen Your Bond", () => {
	let text;
	beforeAll(async () => {
		text = (await read("packs/src/moves/follower/strengthen-your-bond.json")).system.description;
	});

	it("pays the follower's cost", () => {
		expect(text).toContain("When you **_pay your follower's cost_**");
	});

	it("spends the follower's Loyalty", () => {
		expect(text).toContain("Spend your follower's Loyalty 1-for-1");
	});

	it("spells abhorrent", () => {
		expect(text).toContain("so long as it's not abhorrent or suicidal");
	});
});
