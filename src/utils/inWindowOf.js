/**
 * Render options that open a dialog in `app`'s window, so one asked from a popped-out sheet appears
 * over it. Core's renderChild does this for an app it is handed; DialogV2's confirm/prompt/wait build
 * their own, so they take it as `renderOptions`.
 */
export function inWindowOf(app) {
	const windowId = app?.window?.windowId;
	return windowId ? { window: { windowId } } : {};
}
