import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// One renderer for every resource track. The move row used to hand-roll its own pips, and the extra
// wrapper it emitted broke each label onto a line below its pip — a difference no test could see,
// because every other surface (inventory, possessions, backgrounds, arcana, follower loyalty) went
// through the shared partial. These make that the only way to draw a pip.

const root = process.cwd();
const read = rel => readFileSync(path.resolve(root, rel), "utf8");

function hbsFiles(dir, found = []) {
	for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
		const rel = path.join(dir, entry.name);
		if (entry.isDirectory()) hbsFiles(rel, found);
		else if (entry.name.endsWith(".hbs")) found.push(rel);
	}
	return found;
}

const TRACK = "templates/actor/partials/resource-track.hbs";
const PIP_ACTIONS = [
	"moveResourcePip", "inventoryResourcePip", "possessionUsePip",
	"backgroundResourcePip", "arcanumResourcePip", "followerLoyaltyPip",
];

describe("resource track rendering", () => {
	it("is the only template that stamps a pip's action and label", () => {
		for (const file of hbsFiles("templates")) {
			if (file === TRACK) continue;
			const source = read(file);
			for (const action of PIP_ACTIONS)
				expect(`${file}: ${source.includes(`data-action="${action}"`)}`).toBe(`${file}: false`);
			expect(`${file}: ${source.includes("stonetop-resource-label")}`).toBe(`${file}: false`);
		}
	});

	// Each surface differs only in the button class, the action, and which slug the handler reads.
	it("is what every resource surface calls", () => {
		const callers = hbsFiles("templates").filter(f => read(f).includes('{{> "stonetop.resource-track"'));
		expect(callers.length).toBeGreaterThanOrEqual(6);
		expect(callers).toContain("templates/actor/partials/move-item.hbs");
	});

	// The sidebar's reference moves (Defend's Readiness) used to be the one move surface that did NOT
	// go through move-item — it hand-rolled a compact row, so it had to call the track itself, and it
	// had already drifted from the row the rest of the sheet draws. It renders through move-group now,
	// like the steading's rail, so the sheet has no move markup of its own left to keep in step.
	it("is not called by the character sheet, whose moves all go through move-item", () => {
		expect(read("templates/actor/character.hbs")).not.toContain('{{> "stonetop.resource-track"');
	});

	// The move row's handler reads data-move-slug, so the shared track has to be able to stamp it.
	it("stamps whichever slug attribute the caller's handler reads", () => {
		const track = read(TRACK);
		for (const attr of ["data-slug", "data-move-slug", "data-possession-slug", "data-choice-slug"])
			expect(track).toContain(attr);
	});

	it("keeps a label beside its pip rather than under it", () => {
		expect(read("styles/stonetop.css")).toContain(".stonetop-resource-label {");
	});
});
