import { describe, it, expect, beforeAll } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { ChoiceGroupDefs } from "../../src/model/data/ChoiceGroupDefs.js";

// An arcanum grants its follower(s) by SLUG — CharacterArcana.onArcanumCreated looks each one up in the
// followers pack and embeds it. A grant naming a follower that doesn't exist fails silently: the card
// renders with an empty follower slot and nothing lands on the Followers tab. These guard that wiring.

const ARCANA_DIR    = path.resolve("packs/src/arcana");
const FOLLOWERS_DIR = path.resolve("packs/src/followers");

async function readJsonTree(dir) {
	const out = [];
	for (const e of await fs.readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) out.push(...await readJsonTree(full));
		else if (e.name.endsWith(".json") && !e.name.startsWith("_")) out.push({ file: full, doc: JSON.parse(await fs.readFile(full, "utf8")) });
	}
	return out;
}

describe("Arcana follower grants resolve to real follower pack files", () => {
	let arcana, arcanaFollowers, followerSlugs;
	beforeAll(async () => {
		arcana = await readJsonTree(ARCANA_DIR);
		arcanaFollowers = await readJsonTree(path.join(FOLLOWERS_DIR, "arcana"));
		const followers = await readJsonTree(FOLLOWERS_DIR);
		followerSlugs = new Set(followers.filter(f => f.doc.type === "follower").map(f => f.doc.system?.slug));
	});

	it("loads the arcana and follower pack sources", () => {
		expect(arcana.length).toBeGreaterThan(0);
		expect(followerSlugs.size).toBeGreaterThan(0);
	});

	it("every follower grant names a follower that exists", () => {
		const missing = [];
		for (const { doc } of arcana) {
			for (const grant of ChoiceGroupDefs.grants(doc.system ?? {}, "follower")) {
				if (!followerSlugs.has(grant.slug)) missing.push(`${doc.system.slug}: grants unknown follower "${grant.slug}"`);
			}
		}
		expect(missing).toEqual([]);
	});

	// The inverse of the check above, and the one that matters for a regen: a follower can name its
	// arcanum while the arcanum has forgotten the follower. That is what a dropped follower group looks
	// like in the data — build-arcana built the group and the back-choices fold discarded it — and it is
	// invisible to every check that starts from the grant side, because there is no grant left to check.
	it("every arcanum whose follower names it grants that follower back", () => {
		const grantedBy = new Map(arcana.map(({ doc }) => [doc.system?.slug,
			new Set(ChoiceGroupDefs.grants(doc.system ?? {}, "follower").map(g => g.slug))]));
		const ungranted = arcanaFollowers
			.map(f => f.doc.system)
			.filter(sys => sys?.arcanaSlug && !grantedBy.get(sys.arcanaSlug)?.has(sys.slug))
			.map(sys => `${sys.arcanaSlug}: never grants its follower "${sys.slug}"`);
		expect(ungranted).toEqual([]);
	});

	// The Ring is the one follower printed on its card's FRONT. It must be granted exactly once — a
	// build that derives the back group from the roster without excluding front-emitted followers would
	// grant it on both sides, putting two Ring cards on one arcanum.
	it("grants each follower from exactly one side of its card", () => {
		const dupes = [];
		for (const { doc } of arcana) {
			const counts = new Map();
			for (const side of ["front", "back"]) {
				for (const g of ChoiceGroupDefs.grants(doc.system?.[side] ?? {}, "follower")) {
					counts.set(g.slug, (counts.get(g.slug) ?? 0) + 1);
				}
			}
			for (const [slug, n] of counts) if (n > 1) dupes.push(`${doc.system.slug}: grants "${slug}" ${n}×`);
		}
		expect(dupes).toEqual([]);
	});

	it("every arcana follower points back at an arcanum that exists", () => {
		const arcanaSlugs = new Set(arcana.map(a => a.doc.system?.slug));
		const orphans = arcanaFollowers
			.map(f => f.doc.system)
			.filter(sys => sys?.arcanaSlug && !arcanaSlugs.has(sys.arcanaSlug))
			.map(sys => `${sys.slug}: arcanaSlug "${sys.arcanaSlug}" is not an arcanum`);
		expect(orphans).toEqual([]);
	});
});

// The Ring of Daagon's back prints a SECOND creature — the Servant of Daagon summoned by Call Up the
// Deep Ones — plus the 5d4 builder that shapes each batch. The builder is deliberately advisory: the
// aspect rows are write-in dice, and the trait/move picks are uncapped (see "guide, don't enforce").
describe("Ring of Daagon — the Servant of Daagon and its summoning builder", () => {
	let ring, servant, callUp;
	beforeAll(async () => {
		ring    = JSON.parse(await fs.readFile(path.resolve("packs/src/arcana/major/ring-of-daagon.json"), "utf8"));
		servant = JSON.parse(await fs.readFile(path.resolve("packs/src/followers/arcana/servant-of-daagon.json"), "utf8"));
		callUp  = JSON.parse(await fs.readFile(path.resolve("packs/src/moves/arcana/call-up-the-deep-ones.json"), "utf8"));
	});

	it("grants the servant from the back, inline on the card and on the followers tab", () => {
		const grants = ChoiceGroupDefs.grants(ring.system.back, "follower");
		expect(grants.map(g => g.slug)).toEqual(["servant-of-daagon"]);
		expect(grants[0].inline).toBe(true);
		expect(grants[0].onTab).toBe(true);
	});

	it("orders the back sections moves → follower → consequences, as the card prints them", () => {
		expect(ring.system.back.choices.map(g => g.slug)).toEqual(["moves", "ring-of-daagon", "consequences"]);
	});

	it("keeps the ring's own follower on the FRONT, so the two never share a card slot", () => {
		expect(ChoiceGroupDefs.grants(ring.system.front, "follower").map(g => g.slug)).toEqual(["the-ring"]);
	});

	it("gives the servant the book's printed stat line", () => {
		expect(servant.system.tagList.selected).toEqual(["terrifying", "violent", "wretched"]);
		expect(servant.system.instinct.selected).toEqual(["to devour"]);
		expect(servant.system.arcanaSlug).toBe("ring-of-daagon");
	});

	it("carries one builder group — a follower renders choices[0] and nothing else", () => {
		expect(servant.system.choices).toHaveLength(1);
	});

	it("labels the five aspects the book prints, in order", () => {
		const subtitles = servant.system.choices[0].list.map(r => r.content?.subtitle).filter(Boolean);
		expect(subtitles).toEqual(["Tags", "No. Appearing", "Size", "Traits", "Moves"]);
	});

	it("makes Tags / No. Appearing / Size single-value picks that carry the die mapping", () => {
		const [tags, number, size] = servant.system.choices[0].list.filter(r => r.type === "pick" && r.pickCount === 1);
		expect(tags.options.map(o => o.text)).toEqual([
			"1 = *+craven*", "2 = *+ravenous*", "3 = *+cunning*",
			"4 = *+exceptional* (roll +2 for moves instead of +1)",
		]);
		expect(number.options.map(o => o.text)).toEqual([
			"1 = horde (quantity 2d6, HP 3, damage 1d6)",
			"2-3 = group (quantity 1d6+1, HP 6, damage 1d8)",
			"4 = solitary (HP 12, damage 1d10)",
		]);
		expect(size.options.map(o => o.text)).toEqual([
			"1 = small (-2 HP, -2 damage, *hand*)", "2-3 = medium (*close*)",
			"4 = large (+4 HP, +1 damage, *close*, *reach*)",
		]);
	});

	it("offers all six traits and all six moves as uncapped picks", () => {
		// pickCount is read in exactly one place (buildChoiceGroup: radio = pickCount === 1), so any value
		// above 1 renders checkboxes with no cap — "choose a number equal to the die" stays advice.
		const multi = servant.system.choices[0].list.filter(r => r.type === "pick" && r.pickCount !== 1);
		expect(multi).toHaveLength(2);
		for (const pick of multi) {
			expect(pick.options).toHaveLength(6);
			expect(pick.pickCount).toBe(pick.options.length);
			expect(new Set(pick.options.map(o => o.slug)).size).toBe(6);
		}
	});

	it("uses no write-in text boxes — every builder value is a pick", () => {
		expect(servant.system.choices[0].list.some(r => r.input)).toBe(false);
	});

	it("keeps every option slug unique across the group (one shared value store)", () => {
		const slugs = servant.system.choices[0].list.flatMap(r => (r.options ?? []).map(o => o.slug));
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it("makes Call Up the Deep Ones rollable off its 'send them back' trigger", () => {
		expect(callUp.system.rollStat).toBe("cha");
		expect(callUp.system.moveResults.success.value).toBe("they go, now");
		expect(callUp.system.moveResults.failure.value).toContain("breaks free of your control");
	});
});
