import { interactionWindows } from "../../src/utils/InteractionWindows.js";

/** A window the player has just clicked in, as the shared tracker saw it. No id is the main window. */
export function clickedIn(id) {
	const win = Object.assign(new EventTarget(), { id });
	interactionWindows.watch(win);
	win.dispatchEvent(new Event("pointerdown"));
	return win;
}
