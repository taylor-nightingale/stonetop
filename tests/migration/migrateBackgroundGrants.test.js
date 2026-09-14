import { describe, expect, it } from "vitest";
import { migrateBackgroundGrants } from "../../src/migration/migrateBackgroundGrants.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeMoveRepository } from "../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../fakes/FakeCompendiumMoveBuilder.js";
import { TestPlaybookItemBuilder } from "../fakes/TestPlaybookItemBuilder.js";
import { withCategoryFields } from "../../src/actors/embeddedMoves.js";
import { GrantSource } from "../../src/model/data/ItemGrant.js";

// migrateBackgroundGrants(actor, moveRepo): re-applies what the CHOSEN background hands out — the
// playbook moves it makes acquired, and the moves it grants of its own (its `background-<slug>`
// category). Neither reaches a character who picked the background before the pack gained them.

const PLAYBOOK_SLUG = "the-ranger";
const PLAYBOOK_CATEGORY = `playbook-${PLAYBOOK_SLUG}`;

// A background that only ACQUIRES moves the playbook already owns (1.4.0 gave the ranger these).
const MIGHTY_HUNTER = {
	slug: "mighty-hunter", label: "Mighty Hunter", moves: ["expert-tracker", "stalker"],
};

// A background that GRANTS a move of its own, through a choice group (the would-be hero's Destined).
const DESTINED = {
	slug: "destined", label: "Destined",
	choices: { slug: "destined", list: [
		{ type: "entry", grants: [{ type: "move", slug: "destined", locations: ["inline"] }] },
	] },
};

const WIDE_WANDERER = { slug: "wide-wanderer", label: "Wide Wanderer", moves: ["mental-map"] };

function playbookItem(backgrounds) {
	return new TestPlaybookItemBuilder().withSlug(PLAYBOOK_SLUG).withBackgrounds(backgrounds).build();
}

// A playbook-category move item as it sits on a character who has not taken it: present, count 0.
function playbookMoveItem(slug, { instanceCount = 0, repeatMax = 1 } = {}) {
	const base = new FakeCompendiumMoveBuilder().withName(slug).withRepeatMax(repeatMax).build();
	const item = withCategoryFields(base, PLAYBOOK_CATEGORY, instanceCount > 0);
	item.system.instanceCount = instanceCount;
	return { ...item, _id: `move-${slug}` };
}

function makeActor({ backgrounds = [MIGHTY_HUNTER], selected = "mighty-hunter", items = [] } = {}) {
	return new FakeCharacterActorBuilder()
		.withPlaybook(PLAYBOOK_SLUG)
		.withBackground(selected)
		.withItems([playbookItem(backgrounds), ...items])
		.build();
}

function moveRepoWith(...slugs) {
	const repo = new FakeMoveRepository();
	for (const slug of slugs) {
		repo.addInsertMove(new FakeCompendiumMoveBuilder().withName(slug).withSlug(slug).build());
	}
	return repo;
}

function categoryItems(actor, categoryKey) {
	return [...actor.items].filter(i => i.type === "move" && i.system?.categoryKey === categoryKey);
}

function moveItem(actor, slug) {
	return [...actor.items].find(i => i.type === "move" && i.system?.slug === slug) ?? null;
}

// An item already granted under a background's category, stamped as that source's — what a character
// who chose the background while the system was running has.
function grantedBackgroundMove(slug, backgroundSlug) {
	const categoryKey = `background-${backgroundSlug}`;
	const base = new FakeCompendiumMoveBuilder().withName(slug).withSlug(slug).build();
	const item = withCategoryFields(base, categoryKey, true);
	return {
		...item,
		_id: `granted-${slug}`,
		flags: { stonetop: { grant: { source: GrantSource.forCategoryKey(categoryKey), key: `move:${slug}` } } },
	};
}

describe("migrateBackgroundGrants — bails out", () => {
	it("does nothing when the actor has no playbook item", async () => {
		const actor = new FakeCharacterActorBuilder().withBackground("mighty-hunter").build();
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(actor.createdDocs).toHaveLength(0);
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("does nothing when no background is selected", async () => {
		const actor = makeActor({ selected: "", items: [playbookMoveItem("expert-tracker")] });
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(actor.updatedDocs).toHaveLength(0);
		expect(moveItem(actor, "expert-tracker").system.acquired).toBe(false);
	});

	it("does nothing when the selected slug is not one of the playbook's backgrounds", async () => {
		const actor = makeActor({ selected: "storm-marked", items: [playbookMoveItem("expert-tracker")] });
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(actor.updatedDocs).toHaveLength(0);
		expect(moveItem(actor, "expert-tracker").system.acquired).toBe(false);
	});
});

describe("migrateBackgroundGrants — playbook moves the background acquires", () => {
	it("marks every one of the background's moves acquired", async () => {
		const actor = makeActor({ items: [playbookMoveItem("expert-tracker"), playbookMoveItem("stalker")] });
		await migrateBackgroundGrants(actor, moveRepoWith());
		for (const slug of ["expert-tracker", "stalker"]) {
			expect(moveItem(actor, slug).system.acquired).toBe(true);
			expect(moveItem(actor, slug).system.instanceCount).toBe(1);
		}
	});

	it("leaves a playbook move the background does not name alone", async () => {
		const actor = makeActor({ items: [playbookMoveItem("expert-tracker"), playbookMoveItem("naturalist")] });
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(moveItem(actor, "naturalist").system.acquired).toBe(false);
		expect(moveItem(actor, "naturalist").system.instanceCount).toBe(0);
	});

	it("is re-run safe: a second pass does not raise the count again", async () => {
		const actor = makeActor({ items: [playbookMoveItem("expert-tracker", { repeatMax: 3 })] });
		await migrateBackgroundGrants(actor, moveRepoWith());
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(moveItem(actor, "expert-tracker").system.instanceCount).toBe(1);
	});

	it("leaves a move the player has already taken more than once at its count", async () => {
		const actor = makeActor({ items: [playbookMoveItem("expert-tracker", { instanceCount: 2, repeatMax: 3 })] });
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(moveItem(actor, "expert-tracker").system.instanceCount).toBe(2);
	});

	it("skips a named move the character has no item for", async () => {
		const actor = makeActor({ items: [playbookMoveItem("expert-tracker")] });
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(moveItem(actor, "stalker")).toBeNull();
		expect(moveItem(actor, "expert-tracker").system.acquired).toBe(true);
	});

	it("does not reach a move filed under another category", async () => {
		const stray = playbookMoveItem("stalker");
		stray.system.categoryKey = "basic";
		const actor = makeActor({ items: [stray] });
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(moveItem(actor, "stalker").system.acquired).toBe(false);
	});
});

describe("migrateBackgroundGrants — the background's own move category", () => {
	it("creates the background-<slug> category from the choice group's move grants", async () => {
		const actor = makeActor({ backgrounds: [DESTINED], selected: "destined" });
		await migrateBackgroundGrants(actor, moveRepoWith("destined"));
		const granted = categoryItems(actor, "background-destined");
		expect(granted).toHaveLength(1);
		expect(granted[0].system.slug).toBe("destined");
		expect(granted[0].system.acquired).toBe(true);
	});

	it("is re-run safe: a second pass adds no duplicate item", async () => {
		const actor = makeActor({ backgrounds: [DESTINED], selected: "destined" });
		await migrateBackgroundGrants(actor, moveRepoWith("destined"));
		await migrateBackgroundGrants(actor, moveRepoWith("destined"));
		expect(categoryItems(actor, "background-destined")).toHaveLength(1);
	});

	it("creates nothing for a background whose choice group grants no move", async () => {
		const actor = makeActor({ items: [playbookMoveItem("expert-tracker")] });
		await migrateBackgroundGrants(actor, moveRepoWith("destined"));
		expect(actor.createdDocs).toHaveLength(0);
	});

	it("creates nothing when the granted move slug does not resolve", async () => {
		const actor = makeActor({ backgrounds: [DESTINED], selected: "destined" });
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(categoryItems(actor, "background-destined")).toHaveLength(0);
	});

	it("does both halves for a background that acquires and grants", async () => {
		const both = { ...DESTINED, moves: ["expert-tracker"] };
		const actor = makeActor({
			backgrounds: [both], selected: "destined", items: [playbookMoveItem("expert-tracker")],
		});
		await migrateBackgroundGrants(actor, moveRepoWith("destined"));
		expect(moveItem(actor, "expert-tracker").system.acquired).toBe(true);
		expect(categoryItems(actor, "background-destined")).toHaveLength(1);
	});
});

describe("migrateBackgroundGrants — backgrounds the character did not choose", () => {
	it("takes back a category left behind by a background that is not the chosen one", async () => {
		const actor = makeActor({
			backgrounds: [MIGHTY_HUNTER, WIDE_WANDERER],
			selected:    "mighty-hunter",
			items:       [grantedBackgroundMove("mental-map", "wide-wanderer")],
		});
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(categoryItems(actor, "background-wide-wanderer")).toHaveLength(0);
	});

	it("keeps the chosen background's own category", async () => {
		const actor = makeActor({
			backgrounds: [DESTINED, WIDE_WANDERER],
			selected:    "destined",
			items:       [grantedBackgroundMove("destined", "destined")],
		});
		await migrateBackgroundGrants(actor, moveRepoWith("destined"));
		expect(categoryItems(actor, "background-destined")).toHaveLength(1);
	});

	it("never takes back a move nobody granted, whatever category it sits in", async () => {
		const handAdded = grantedBackgroundMove("mental-map", "wide-wanderer");
		delete handAdded.flags;
		const actor = makeActor({
			backgrounds: [MIGHTY_HUNTER, WIDE_WANDERER],
			selected:    "mighty-hunter",
			items:       [handAdded],
		});
		await migrateBackgroundGrants(actor, moveRepoWith());
		expect(categoryItems(actor, "background-wide-wanderer")).toHaveLength(1);
	});
});
