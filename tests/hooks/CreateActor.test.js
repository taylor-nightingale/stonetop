import { afterEach, describe, expect, it, vi } from "vitest";
import { onCreateActor } from "../../src/hooks/CreateActor.js";

// The create hook is pure dispatch: on the creating client it hands off to the typed actor's
// onCreate, which owns that type's creation logic (tested with the typed actor classes). No type
// checks live here.

function stubGame(userId = "u1") {
	vi.stubGlobal("game", { user: { id: userId } });
}

describe("onCreateActor — typed-actor dispatch", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("runs the typed actor's onCreate on the creating client", async () => {
		stubGame("u1");
		const onCreate = vi.fn(async () => {});
		await onCreateActor({ typedActor: { onCreate } }, {}, "u1");
		expect(onCreate).toHaveBeenCalledOnce();
	});

	it("does nothing when a different client created the actor", async () => {
		stubGame("u1");
		const onCreate = vi.fn(async () => {});
		await onCreateActor({ typedActor: { onCreate } }, {}, "someone-else");
		expect(onCreate).not.toHaveBeenCalled();
	});

	it("tolerates an actor type with no typed class", async () => {
		stubGame("u1");
		await expect(onCreateActor({ typedActor: undefined }, {}, "u1")).resolves.toBeUndefined();
	});
});
