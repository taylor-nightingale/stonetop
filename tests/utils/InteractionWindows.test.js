// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { InteractionWindows } from "../../src/utils/InteractionWindows.js";

const fakeWindow = id => Object.assign(new EventTarget(), { id });

describe("InteractionWindows", () => {
	it("knows no window before the player has done anything", () => {
		expect(new InteractionWindows().last).toBeNull();
	});

	it.each(["pointerdown", "keydown"])("takes the window the player last used, by %s", type => {
		const windows = new InteractionWindows();
		const main    = fakeWindow(undefined);
		const popped  = fakeWindow("stonetop-character-abc");
		windows.watch(main);
		windows.watch(popped);

		popped.dispatchEvent(new Event(type));
		expect(windows.last).toBe(popped);
		main.dispatchEvent(new Event(type));
		expect(windows.last).toBe(main);
	});

	// A sheet handler that stops the event must not hide where it happened.
	it("hears the interaction even when the target stops it", () => {
		const windows = new InteractionWindows();
		windows.watch(window);
		const button = document.createElement("button");
		document.body.replaceChildren(button);
		button.addEventListener("pointerdown", event => event.stopPropagation());

		button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
		expect(windows.last).toBe(window);
	});

	it("ignores a window it was never given", () => {
		const windows = new InteractionWindows();
		fakeWindow("elsewhere").dispatchEvent(new Event("pointerdown"));
		expect(windows.last).toBeNull();
	});
});
