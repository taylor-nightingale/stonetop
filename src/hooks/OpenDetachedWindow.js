import { interactionWindows } from "../utils/InteractionWindows.js";

export function onOpenDetachedWindow(_id, win, windows = interactionWindows) {
	windows.watch(win);
}
