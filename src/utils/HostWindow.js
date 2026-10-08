import { interactionWindows } from "./InteractionWindows.js";

/**
 * The window a new app should open in: the popped-out window the player is working in, so a dialog
 * asked from a detached sheet appears over it rather than back in the main workspace. v13 has no
 * detached windows, and the main workspace is Foundry's default — both leave the choice to Foundry.
 */
export class HostWindow {
	constructor({
		detached     = globalThis.foundry?.applications?.detached,
		interactions = interactionWindows,
	} = {}) {
		this._detached     = detached;
		this._interactions = interactions;
	}

	renderOptions() {
		const win = this._interactions.last;
		return win && this._detached?.windows.has(win.id)
			? { window: { windowId: win.id } }
			: {};
	}
}
