import { describe, it, expect, beforeAll } from "vitest";
import {
	buildMonsterRefIndex,
	getMonsterRefRegex,
	lookupMonsterRef,
	invalidateMonsterRefIndex,
	creatureDisplayName,
} from "../../module/bestiary/monster-ref-index.js";

// Minimal fakes for the compendium index + world actors the builder reads.
const COMPENDIUM = [
	{ _id: "aaaaaaaaaaaaaaa1", uuid: "Compendium.x.Actor.aaaaaaaaaaaaaaa1", type: "monster", name: "Crinwin",            system: { concept: "Small gray vermin." } },
	{ _id: "aaaaaaaaaaaaaaa3", uuid: "Compendium.x.Actor.aaaaaaaaaaaaaaa3", type: "monster", name: "The Bear of Winter", system: { concept: "A house-sized fae bear-lord." } },
	{ _id: "aaaaaaaaaaaaaaa4", uuid: "Compendium.x.Actor.aaaaaaaaaaaaaaa4", type: "monster", name: "The Suileach", system: { concept: "The Wurm with Two-Hundred Eyes." } },
	{ _id: "aaaaaaaaaaaaaaa5", uuid: "Compendium.x.Actor.aaaaaaaaaaaaaaa5", type: "monster", name: "Tcaventes, Shackle and Key", system: { concept: "A mad archon." } },
	{ _id: "aaaaaaaaaaaaaaa6", uuid: "Compendium.x.Actor.aaaaaaaaaaaaaaa6", type: "monster", name: "Wolf", system: { concept: "Pack hunters." } },
];

function setGame(actors = []) {
	globalThis.game = {
		packs: {
			get: (id) => id === "stonetop.stonetop-bestiary"
				? { collection: "x", getIndex: async () => COMPENDIUM }
				: null,
		},
		actors,
	};
}

function matchAll(text) {
	const re = getMonsterRefRegex();
	re.lastIndex = 0;
	const out = [];
	let m;
	while ((m = re.exec(text)) !== null) out.push({ text: m[0], name: m[1], rec: lookupMonsterRef(m[1]) });
	return out;
}

describe("creatureDisplayName", () => {
	it("strips the (Bestiary) suffix", () => {
		expect(creatureDisplayName("Crinwin (Bestiary)")).toBe("Crinwin");
		expect(creatureDisplayName("Wolf")).toBe("Wolf");
	});
});

describe("monster reference index", () => {
	beforeAll(async () => {
		invalidateMonsterRefIndex();
		setGame([
			// A world copy of the Wolf monster — should win over the compendium copy.
			{ uuid: "Actor.world-wolf", type: "monster", name: "Wolf", system: { concept: "Your wolves." } },
		]);
		await buildMonsterRefIndex();
	});

	it("prefers a world actor over the compendium copy", () => {
		expect(lookupMonsterRef("Wolf").uuid).toBe("Actor.world-wolf");
		expect(lookupMonsterRef("Wolf").concept).toBe("Your wolves.");
	});

	it("matches names case-insensitively and as simple plurals", () => {
		const hits = matchAll("Two crinwin, then a pack of Crinwins, scattered.");
		expect(hits.map(h => h.text)).toEqual(["crinwin", "Crinwins"]);
		expect(hits.every(h => h.rec?.uuid === "Compendium.x.Actor.aaaaaaaaaaaaaaa1")).toBe(true);
	});

	it("matches a leading-'The' name with or without the article", () => {
		expect(matchAll("the Suileach lurks").map(h => h.text)).toEqual(["the Suileach"]);
		expect(matchAll("a Suileach lurks").map(h => h.text)).toEqual(["Suileach"]);
	});

	it("prefers the longest name (Bear of Winter, not Bear)", () => {
		const hits = matchAll("The Bear of Winter approaches.");
		expect(hits).toHaveLength(1);
		expect(hits[0].rec.uuid).toBe("Compendium.x.Actor.aaaaaaaaaaaaaaa3");
	});

	it("matches a comma-prefix short form (Tcaventes)", () => {
		expect(matchAll("Beware Tcaventes.").map(h => h.rec?.uuid))
			.toEqual(["Compendium.x.Actor.aaaaaaaaaaaaaaa5"]);
	});

	it("does not match a word fragment inside a larger word", () => {
		// "Wolfsbane" / "Crinwinkle" must not produce links.
		expect(matchAll("Wolfsbane grows where the Crinwinkle blooms.")).toEqual([]);
	});

	it("does not match ordinary words that aren't creatures", () => {
		expect(matchAll("It comes from below the hill.")).toEqual([]);
	});

	it("invalidate() forces a rebuild that sees newly added world actors", async () => {
		invalidateMonsterRefIndex();
		setGame([{ uuid: "Actor.new-thing", type: "monster", name: "Grochslon", system: { concept: "Eyeless cave predator." } }]);
		await buildMonsterRefIndex();
		expect(lookupMonsterRef("Grochslon")?.uuid).toBe("Actor.new-thing");
	});
});
