import { describe, it, expect } from "vitest";
import { onOpenDetachedWindow } from "../../src/hooks/OpenDetachedWindow.js";
import { InteractionWindows } from "../../src/utils/InteractionWindows.js";

describe("onOpenDetachedWindow", () => {
	// A sheet popped out after load is a window like any other: what the player does in it counts.
	it("watches the window Foundry just opened", () => {
		const windows = new InteractionWindows();
		const popped  = Object.assign(new EventTarget(), { id: "stonetop-character-abc" });
		onOpenDetachedWindow(popped.id, popped, windows);

		popped.dispatchEvent(new Event("pointerdown"));
		expect(windows.last).toBe(popped);
	});
});
