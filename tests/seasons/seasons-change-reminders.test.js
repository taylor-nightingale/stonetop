import { describe, expect, it } from "vitest";
import {
	collectSeasonalReminders,
	remindersForActor,
	seasonsReminderCard,
} from "../../module/seasons/seasons-change-reminders.js";

// A minimal stand-in for a character actor: `move` names become embedded move
// Items, and `possessions` become the selected special-possession slugs (the
// flags.stonetop.possessions.selected array the production flag reads).
function fakeCharacter({ name = "Test PC", moves = [], possessions = [], type = "character" } = {}) {
	return {
		name,
		type,
		items: moves.map(name => ({ type: "move", name })),
		getFlag: (scope, key) =>
			scope === "stonetop" && key === "possessions.selected" ? possessions : undefined,
	};
}

const names = list => list.map(r => r.label ?? r.name);

describe("remindersForActor", () => {
	it("matches a seasonal playbook move by name", () => {
		const actor = fakeCharacter({ moves: ["Rites of the Land", "Consecrated Ground"] });
		expect(names(remindersForActor(actor))).toEqual(["Rites of the Land"]);
	});

	it("matches seasonal possessions by selected slug", () => {
		const actor = fakeCharacter({ possessions: ["collected-offerings", "goat-herd", "apiary"] });
		expect(names(remindersForActor(actor)).sort()).toEqual(["Collected offerings", "Goat herd"]);
	});

	it("matches The Lightbearer's Holy relics possession", () => {
		const actor = fakeCharacter({ possessions: ["holy-relics"] });
		expect(names(remindersForActor(actor))).toEqual(["Holy relics"]);
	});

	it("combines a move and a possession on the same character", () => {
		const actor = fakeCharacter({ moves: ["Rites of the Land"], possessions: ["goat-herd"] });
		expect(names(remindersForActor(actor)).sort()).toEqual(["Goat herd", "Rites of the Land"]);
	});

	it("returns nothing for a character with no seasonal upkeep", () => {
		const actor = fakeCharacter({ moves: ["Consecrated Ground"], possessions: ["apiary"] });
		expect(remindersForActor(actor)).toEqual([]);
	});

	it("ignores non-character actors", () => {
		const actor = fakeCharacter({ moves: ["Rites of the Land"], type: "stonetop" });
		expect(remindersForActor(actor)).toEqual([]);
	});

	it("tolerates a character with no selected-possessions flag", () => {
		const actor = { type: "character", items: [], getFlag: () => undefined };
		expect(remindersForActor(actor)).toEqual([]);
	});
});

describe("collectSeasonalReminders", () => {
	it("tags each matched reminder with its owning character", () => {
		const reminders = collectSeasonalReminders([
			fakeCharacter({ name: "Brother Hale", moves: ["Rites of the Land"], possessions: ["collected-offerings"] }),
			fakeCharacter({ name: "Mira", possessions: ["holy-relics"] }),
		]);
		expect(reminders).toEqual([
			expect.objectContaining({ character: "Brother Hale", name: "Rites of the Land" }),
			expect.objectContaining({ character: "Brother Hale", name: "Collected offerings" }),
			expect.objectContaining({ character: "Mira", name: "Holy relics" }),
		]);
	});

	it("skips characters with no seasonal upkeep", () => {
		const reminders = collectSeasonalReminders([
			fakeCharacter({ name: "Eaglewise", moves: ["Consecrated Ground"], possessions: ["apiary"] }),
		]);
		expect(reminders).toEqual([]);
	});
});

describe("seasonsReminderCard", () => {
	it("renders the season hero and one item per reminder", () => {
		const html = seasonsReminderCard("autumn", collectSeasonalReminders([
			fakeCharacter({ name: "Brother Hale", possessions: ["collected-offerings"] }),
		]));
		expect(html).toContain("The Seasons Change");
		expect(html).toContain("Autumn");
		expect(html).toContain("fall_icon.svg"); // autumn maps to the "fall" art
		expect(html).toContain("Brother Hale");
		expect(html).toContain("Collected offerings");
		expect(html).toContain("Restore 1 use this season");
	});
});
