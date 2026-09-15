import { describe, it, expect } from "vitest";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { SteadingData } from "../../../src/data/SteadingData.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";
import { applyDocumentUpdate } from "../../fakes/foundry/applyDocumentUpdate.js";

/**
 * A steading survives a reload with everything it was given.
 *
 * The failure this exists for cost a table their session's work and could not have been caught
 * anywhere else. `SteadingData.migrateData` assigned `source.assets` unconditionally, so EVERY update
 * diff it migrated came back carrying an `assets: undefined` key its caller never wrote — and a diff
 * carrying an explicit undefined for a SchemaField is a diff that resets it. Editing the notes
 * cleared the resource list. Nothing showed at the time, because the sheet renders from the model
 * already in memory; the loss only appeared on the next reload, when the model was rebuilt from what
 * had actually been stored.
 *
 * So the round trip is the test, and both halves of it have to be real: the edits go through the real
 * typed steading, and the WRITE goes through the real `SteadingData` — its migrateData on the diff,
 * then a rebuild from the merged source, which is what a page refresh does. A fake that merges
 * updates and stops there is exactly the harness that let this ship: it never re-migrates, so a key
 * injected into the diff has nowhere to do harm.
 */
class World {
	constructor(source) {
		this._stored = structuredClone(source);
	}

	/** One steading actor, live, as this world currently holds it. */
	get actor() {
		const world = this;
		const actor = new FakeSteadingBuilder().build();
		actor.system = new SteadingData(structuredClone(this._stored)).toObject();
		actor.update = async data => { world._write(data); actor.system = new SteadingData(structuredClone(world._stored)).toObject(); };
		return actor;
	}

	steading() {
		return new StonetopSteading(this.actor, steadingRepos());
	}

	/** Everything this world would hand back after a page refresh. */
	reload() {
		return new SteadingData(structuredClone(this._stored)).toObject();
	}

	// What the server keeps: the diff, migrated the way Foundry migrates it, merged into the source.
	_write(data) {
		const staged = {};
		applyDocumentUpdate(staged, data);
		const migrated = SteadingData.migrateData(staged.system ?? {});
		applyDocumentUpdate(this._stored, { ...migrated });
	}
}

function stonetop() {
	const seeded = new FakeSteadingBuilder().build().system;
	return new World({
		...seeded,
		assets: {
			...seeded.assets,
			resources:      ["Farming (beans, potatoes, oats, barley)", "Distilling (whisky)"],
			fortifications: ["The Ringwall (low, stone)", "Three watchtowers"],
		},
	});
}

const resources      = system => system.assets.resources;
const fortifications = system => system.assets.fortifications;

describe("a steading survives a reload (integration)", () => {
	it("keeps its resources and fortifications when nothing has been edited at all", () => {
		const world = stonetop();
		expect(resources(world.reload())).toHaveLength(2);
		expect(fortifications(world.reload())).toHaveLength(2);
	});

	// The one that bit: an edit that says nothing about the asset lists must not touch them.
	it("keeps them through an edit to something else entirely", async () => {
		const world = stonetop();
		await world.steading().setNotes("The harvest came in early.");

		const after = world.reload();
		expect(resources(after), "editing the notes cleared the resources").toHaveLength(2);
		expect(fortifications(after), "editing the notes cleared the fortifications").toHaveLength(2);
		expect(after.notes).toBe("The harvest came in early.");
	});

	// Every edit surface on the sheet, because the defect was in the write path they all share: any
	// one of them was enough to lose the lists, and a test that covered only one would have let the
	// next one through.
	const edits = {
		"a rating":        s => s.setAttribute("population", 2),
		"fortunes":        s => s.setFortunes(3),
		"a debility":      s => s.setDebility("lacking", true),
		"the roll mode":   s => s.setRollMode("advantage"),
		"a villager":      s => s.addPerson(),
		"a place":         s => s.addPlace(),
		"an asset":        s => s.addAssetItem(),
		"a content entry": s => s.addContentItem("excluded"),
	};

	for (const [what, edit] of Object.entries(edits)) {
		it(`keeps them through editing ${what}`, async () => {
			const world = stonetop();
			await edit(world.steading());

			const after = world.reload();
			expect(resources(after), `editing ${what} cleared the resources`).toHaveLength(2);
			expect(fortifications(after), `editing ${what} cleared the fortifications`).toHaveLength(2);
		});
	}

	it("keeps them across a whole session of edits, one after another", async () => {
		const world = stonetop();
		await world.steading().setNotes("Session one.");
		await world.steading().setAttribute("prosperity", 1);
		await world.steading().addPerson();
		await world.steading().setDebility("diminished", true);

		const after = world.reload();
		expect(resources(after)).toEqual([
			"Farming (beans, potatoes, oats, barley)", "Distilling (whisky)"]);
		expect(fortifications(after)).toEqual([
			"The Ringwall (low, stone)", "Three watchtowers"]);
	});

	// The lists are still editable, which is the other half of "survives": a write that DOES name
	// them has to land, and land alone.
	it("stores an edit to the resources without disturbing the fortifications", async () => {
		const world = stonetop();
		await world.steading().addAttributeItem("prosperity");

		const after = world.reload();
		expect(resources(after)).toHaveLength(3);
		expect(fortifications(after)).toHaveLength(2);
	});

	it("stores an edit to the fortifications without disturbing the resources", async () => {
		const world = stonetop();
		await world.steading().addAttributeItem("defenses");

		const after = world.reload();
		expect(fortifications(after)).toHaveLength(3);
		expect(resources(after)).toHaveLength(2);
	});
});
