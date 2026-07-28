import { describe, it, expect } from "vitest";
import { migrateArcanaOwnedFollowers } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeFollowerRepository } from "../fakes/FakeFollowerRepository.js";
import { Follower } from "../../src/model/data/character/Follower.js";
import { ResourceController } from "../../src/actors/character/ResourceController.js";

// The Ring's front-unlock row has NO track → an owned-by-default grant, stamped off the tab by its
// hideFromFollowersTab link. Old data granted it via a checkbox (or not at all); this back-fills it.
const RING = new Follower({
	slug: "the-ring", name: "The Ring", kind: "object",
	hp: { value: 0, max: 0 }, loyalty: { value: 0, max: 3 },
});

function ringArcanumItem() {
	return {
		_id: "ring", type: "arcanum", name: "Ring of Daagon",
		system: {
			slug: "ring-of-daagon", major: true,
			front: { unlock: { slug: "ring-of-daagon", list: [
				{ type: "entry", slug: "the-ring", content: { title: null, text: "" },
					grants: [{ type: "follower", slug: "the-ring", locations: ["inline"] }] },
			] } },
			back: {},
		},
	};
}

const resCtrl = (actor) => new ResourceController(actor);

describe("migrateArcanaOwnedFollowers", () => {
	it("embeds a never-unlocked Ring as owned, stamped off the tab", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([ringArcanumItem()]).build();
		await migrateArcanaOwnedFollowers(actor, new FakeFollowerRepository([RING]), resCtrl(actor));
		const ring = [...actor.items].find(i => i.type === "follower" && i.system?.slug === "the-ring");
		expect(ring?.system?.owned).toBe(true);
		expect(ring?.system?.showOnTab).toBe(false);
		expect(ring?.system?.kind).toBe("object");
	});

	it("fixes showOnTab on a Ring already embedded under the old checkbox path", async () => {
		const embedded = {
			_id: "the-ring", type: "follower", name: "The Ring",
			system: { slug: "the-ring", arcanaSlug: "ring-of-daagon", owned: true, showOnTab: true,
				kind: "object", hp: { value: 0, max: 0 }, loyalty: { value: 0, max: 3 } },
		};
		const actor = new FakeCharacterActorBuilder().withItems([ringArcanumItem(), embedded]).build();
		await migrateArcanaOwnedFollowers(actor, new FakeFollowerRepository([RING]), resCtrl(actor));
		const u = actor.updatedDocs.find(d => d._id === "the-ring");
		expect(u.system.showOnTab).toBe(false);
	});

	it("does nothing when the actor has no arcana", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([]).build();
		await migrateArcanaOwnedFollowers(actor, new FakeFollowerRepository([RING]), resCtrl(actor));
		expect([...actor.items].filter(i => i.type === "follower")).toHaveLength(0);
	});
});
