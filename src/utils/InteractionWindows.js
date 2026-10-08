/**
 * The window the player last clicked or typed in. Focus can't answer this: with a sheet popped out,
 * the main window still reports `document.hasFocus()` while the player works in the popped-out one.
 * Listening in the capture phase on the window hears every interaction before a handler can stop it.
 */
export class InteractionWindows {
	constructor() {
		this._last = null;
	}

	watch(win) {
		const mark = () => { this._last = win; };
		win.addEventListener("pointerdown", mark, true);
		win.addEventListener("keydown", mark, true);
	}

	get last() {
		return this._last;
	}
}

export const interactionWindows = new InteractionWindows();
