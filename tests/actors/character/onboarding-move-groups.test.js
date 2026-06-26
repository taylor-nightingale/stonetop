import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import {
	ONBOARDING_MOVE_GROUPS,
	moveGroupsForPlaybook,
	moveGroupKeys,
} from "../../../module/actors/character/dialogs/onboarding-move-groups.js";

// The onboarding "Starting Moves" step shows three per-playbook filter chips, each
// backed by a hand-curated list of move names in onboarding-move-groups.js. Those
// names must match real move items exactly — a rename in the pack would silently
// drop a move from its chip. Read the playbook-moves source and hold the data to
// that contract.

const MOVES_DIR = path.resolve("packs/src/stonetop-items/playbook-moves");

// "The Blessed" → "the-blessed", "The Would-Be Hero" → "the-would-be-hero".
const folderFor = name => name.toLowerCase().replace(/\s+/g, "-");

async function movesInPlaybook(playbookName) {
	const dir = path.join(MOVES_DIR, folderFor(playbookName));
	const files = (await fs.readdir(dir)).filter(f => f.endsWith(".json"));
	const names = await Promise.all(files.map(async f => {
		const doc = JSON.parse(await fs.readFile(path.join(dir, f), "utf-8"));
		return doc.name;
	}));
	return new Set(names);
}

describe("ONBOARDING_MOVE_GROUPS", () => {
	const playbooks = Object.keys(ONBOARDING_MOVE_GROUPS);

	it("covers every playbook with a moves source folder", async () => {
		const folders = (await fs.readdir(MOVES_DIR, { withFileTypes: true }))
			.filter(e => e.isDirectory()).map(e => e.name).sort();
		expect(playbooks.map(folderFor).sort()).toEqual(folders);
	});

	for (const playbook of Object.keys(ONBOARDING_MOVE_GROUPS)) {
		describe(playbook, () => {
			const groups = ONBOARDING_MOVE_GROUPS[playbook];

			it("defines exactly three chips with unique keys and labels", () => {
				expect(groups).toHaveLength(3);
				expect(new Set(groups.map(g => g.key)).size).toBe(3);
				for (const g of groups) {
					expect(g.label.length).toBeGreaterThan(0);
					expect(g.moves.length).toBeGreaterThan(0);
				}
			});

			it("lists each move in at most one group (clean partition)", () => {
				const all = groups.flatMap(g => g.moves);
				expect(new Set(all).size).toBe(all.length);
			});

			it("references only real move names from the pack", async () => {
				const actual = await movesInPlaybook(playbook);
				for (const g of groups) {
					for (const name of g.moves) {
						expect(actual, `${playbook} / ${g.key}: "${name}"`).toContain(name);
					}
				}
			});
		});
	}

	it("helpers resolve chips and per-move group keys", () => {
		expect(moveGroupsForPlaybook("The Blessed")).toEqual([
			{ key: "spirits", label: "Spirits" },
			{ key: "nature", label: "Nature" },
			{ key: "wards", label: "Wards" },
		]);
		expect(moveGroupKeys("The Blessed", "Call the Spirits")).toEqual(["spirits"]);
		expect(moveGroupKeys("The Blessed", "Improved Stat")).toEqual([]); // unassigned
		expect(moveGroupsForPlaybook("Not A Playbook")).toEqual([]);
		expect(moveGroupKeys("Not A Playbook", "Whatever")).toEqual([]);
	});
});
