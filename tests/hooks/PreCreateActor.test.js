import { describe, expect, it, vi } from "vitest";
import { onPreCreateActor } from "../../src/hooks/PreCreateActor.js";

// Pure dispatch: the typed actor's onPreCreate owns any pre-create defaults (tested with the typed
// actor classes — e.g. StonetopNpc's house icon).

describe("onPreCreateActor — typed-actor dispatch", () => {
	it("hands the creation data to the typed actor's onPreCreate", () => {
		const onPreCreate = vi.fn();
		const data = { img: "icons/svg/mystery-man.svg" };
		onPreCreateActor({ typedActor: { onPreCreate } }, data);
		expect(onPreCreate).toHaveBeenCalledWith(data);
	});

	it("tolerates an actor type with no typed class", () => {
		expect(() => onPreCreateActor({ typedActor: undefined }, {})).not.toThrow();
	});
});
