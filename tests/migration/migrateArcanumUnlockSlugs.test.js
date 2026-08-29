import { describe, it, expect } from "vitest";
import { migrateArcanumUnlockSlugs, renamedUnlockValues } from "../../src/migration/migrateArcanumUnlockSlugs.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";

// An arcanum's stored ticks live under `choiceValues[<arcanum slug>][<row slug>]` — both namespaces
// are the arcanum's own slug (ArcanumData).
const makeArcanumItem = (slug, group) => ({
	_id: slug, type: "arcanum", name: slug,
	system: { slug, front: {}, back: {}, flipped: false, choiceValues: group === undefined ? {} : { [slug]: group } },
});

describe("renamedUnlockValues", () => {
	it("moves a ticked legacy row onto its new slug and deletes the old key", () => {
		expect(renamedUnlockValues({
			slug: "disturbing-mask",
			choiceValues: { "disturbing-mask": { "tell-mask-anothers-secret": { track: 1 } } },
		})).toEqual({ "disturbing-mask": { "tell-mask-another": { track: 1 }, "-=tell-mask-anothers-secret": null } });
	});

	it("renames the oversized crown's row too", () => {
		expect(renamedUnlockValues({
			slug: "oversized-crown",
			choiceValues: { "oversized-crown": { "learn-words-of-unbeing": { track: 1 } } },
		})).toEqual({ "oversized-crown": { "learn-words-unbeing": { track: 1 }, "-=learn-words-of-unbeing": null } });
	});

	it("leaves a value already stored under the new slug alone, and still clears the old one", () => {
		expect(renamedUnlockValues({
			slug: "disturbing-mask",
			choiceValues: { "disturbing-mask": { "tell-mask-anothers-secret": { track: 1 }, "tell-mask-another": { track: 0 } } },
		})).toEqual({ "disturbing-mask": { "-=tell-mask-anothers-secret": null } });
	});

	it("leaves other rows in the group alone", () => {
		const out = renamedUnlockValues({
			slug: "disturbing-mask",
			choiceValues: { "disturbing-mask": { "tell-mask-anothers-secret": { track: 1 }, marks: { track: 2 } } },
		});
		expect(out["disturbing-mask"]).not.toHaveProperty("marks");
	});

	it("returns null when the legacy row was never ticked", () => {
		expect(renamedUnlockValues({ slug: "disturbing-mask", choiceValues: { "disturbing-mask": { marks: { track: 1 } } } })).toBeNull();
	});

	it("returns null for an arcanum with no renames and for empty values", () => {
		expect(renamedUnlockValues({ slug: "mindgem", choiceValues: { mindgem: { "tell-mask-anothers-secret": { track: 1 } } } })).toBeNull();
		expect(renamedUnlockValues({ slug: "disturbing-mask", choiceValues: {} })).toBeNull();
		expect(renamedUnlockValues()).toBeNull();
	});
});

describe("migrateArcanumUnlockSlugs", () => {
	it("updates every owned arcanum that carries a legacy row", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([
			makeArcanumItem("disturbing-mask", { "tell-mask-anothers-secret": { track: 1 } }),
			makeArcanumItem("oversized-crown", { "learn-words-of-unbeing": { track: 1 } }),
		]).build();
		expect(await migrateArcanumUnlockSlugs(actor)).toBe(2);
		expect(actor.updatedDocs.find(d => d._id === "disturbing-mask").system.choiceValues)
			.toEqual({ "disturbing-mask": { "tell-mask-another": { track: 1 }, "-=tell-mask-anothers-secret": null } });
	});

	it("renames the apostrophe-split slugs too", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([
			makeArcanumItem("old-scroll-case", { "ll-take": { track: 1 }, "ll-use": { track: 1 } }),
		]).build();
		expect(await migrateArcanumUnlockSlugs(actor)).toBe(1);
		expect(actor.updatedDocs[0].system.choiceValues["old-scroll-case"]).toEqual({
			"itll-take": { track: 1 }, "youll-use": { track: 1 }, "-=ll-take": null, "-=ll-use": null,
		});
	});

	it("does nothing for an actor with no legacy rows, and is idempotent", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([
			makeArcanumItem("disturbing-mask", { "tell-mask-another": { track: 1 } }),
			{ _id: "m", type: "move", name: "m", system: { slug: "m" } },
		]).build();
		expect(await migrateArcanumUnlockSlugs(actor)).toBe(0);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});
