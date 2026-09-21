import { describe, it, expect } from "vitest";
import { createStonetopActorClass } from "../../src/actors/StonetopActor.js";

// The document-level half of the sidebar note: the Actors directory renders its rows with the ACTOR
// as the template context, so this getter is what the partial can reach. Every type answers it
// through its typed actor, which is what keeps a `switch (type)` out of the document class.
function actorWith(typedActor) {
	const Base = class {};
	const actor = new (createStonetopActorClass(Base))();
	Object.defineProperty(actor, "typedActor", { get: () => typedActor });
	return actor;
}

describe("StonetopActor.directoryNote", () => {
	it("is whatever the typed actor calls it", () => {
		expect(actorWith({ directoryNote: "The Hero" }).directoryNote).toBe("The Hero");
	});

	it("is null for a typed actor that has no note", () => {
		expect(actorWith({ directoryNote: null }).directoryNote).toBeNull();
	});

	// An actor of a type this system does not define has no typed actor at all.
	it("is null when there is no typed actor", () => {
		expect(actorWith(undefined).directoryNote).toBeNull();
	});
});
