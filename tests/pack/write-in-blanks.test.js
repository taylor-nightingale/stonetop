import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const read = async file => JSON.parse(await fs.readFile(path.resolve(file), "utf8"));

// The book asks for an answer these prompts give nowhere to write.

describe("Tethered", () => {
	let move;
	beforeAll(async () => { move = await read("packs/src/moves/post-death/ghost/tethered.json"); });

	it("offers a blank for what the Ghost is bound to", () => {
		const [entry] = move.system.choices.list;
		expect(move.system.choices.slug).toBe("choices");
		expect(entry.slug).toBe("tether");
		expect(entry.content.text).toMatch(/^Choose something to which you are bound: your mortal remains/);
		expect(entry.input).toEqual({ type: "inline" });
	});

	it("says the prompt once, in the entry rather than the description", () => {
		expect(move.system.description).not.toContain("Choose something to which you are bound");
		expect(move.system.description).toMatch(/^When you \*\*_are reduced to 0 HP,_\*\*/);
	});
});

// Each Terrible Purpose opens "Name the person or persons…" / "Name the task…"; every trigger after
// it is about whoever was named. The Thrall's master already has the shape: an inline input on the
// entry — here drawn straight after the "Name…" sentence it answers.
describe.each(["ghost", "revenant", "thrall"])("the %s's Terrible Purpose", insert => {
	let purpose;
	beforeAll(async () => {
		const doc = await read(`packs/src/inserts/${insert}.json`);
		purpose = doc.system.choices.find(g => g.slug === "terrible-purpose");
	});

	it.each(["longing", "vengeance", "duty"])("gives %s a blank beside its box, after the sentence it answers", slug => {
		const entry = purpose.list.find(r => r.slug === slug);
		expect(entry.track).toEqual({ max: 1 });
		expect(entry.input).toEqual({ type: "inline", follows: "lead" });
	});
});
