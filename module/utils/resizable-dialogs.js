/**
 * System convention: every window and modal should be drag-resizable.
 *
 * Our own Application subclasses set `resizable: true` in their `defaultOptions`,
 * and core actor/item/journal sheets are resizable by default. But the ad-hoc
 * `new Dialog(...)` / `Dialog.confirm(...)` / `Dialog.prompt(...)` popups we spawn
 * from sheets can't carry their own subclass, and AppV1's base `Dialog` defaults
 * to `resizable: false`. Rather than thread `{ resizable: true }` through every
 * call site — and silently miss every future one — we flip the legacy `Dialog`
 * class default once, at init.
 *
 * Foundry reads `options.resizable` while building the window frame
 * (`Application#_renderOuter` → `new Draggable(...)`), so overriding the static
 * `defaultOptions` getter is enough for the resize handle to be wired up at
 * render time. Call sites that explicitly pass `resizable: false` still win.
 *
 * Idempotent: a marker flag guards against double-wrapping on re-init.
 */
export function makeDialogsResizable() {
	// V13+ exposes the classic Dialog under foundry.appv1; V12 only has the global.
	const DialogClass = foundry?.appv1?.api?.Dialog ?? globalThis.Dialog;
	if (!DialogClass || DialogClass._stonetopResizableDefault) return;

	const baseGetter = Object.getOwnPropertyDescriptor(DialogClass, "defaultOptions")?.get;
	if (!baseGetter) return;

	Object.defineProperty(DialogClass, "defaultOptions", {
		configurable: true,
		get() {
			return foundry.utils.mergeObject(baseGetter.call(this), { resizable: true });
		},
	});
	DialogClass._stonetopResizableDefault = true;
}

/**
 * System convention: a window whose `height` option is `"auto"` must still be
 * draggable taller/shorter by its resize handle, like a fixed-height one.
 *
 * Core's `Application#setPosition` (appv1/api/application-v1.mjs) treats
 * `options.height === "auto"` as a *permanent* override: on every call it blanks
 * `el.style.height` and refits the window to its content height, discarding the
 * pixel height the resize drag asked for. So auto-height windows resize fine
 * horizontally (width is a real number) but snap straight back vertically — which
 * is most of our modals, since they default to `height: "auto"` to fit content.
 *
 * The resize drag is the one caller that passes a bare `{ width?, height? }` with
 * a finite numeric height and no `left`/`top`: every internal reflow passes the
 * full `this.position` (with `left`/`top`) or no args, and the steppers' own
 * post-render refit passes the string `{ height: "auto" }`. We key off that
 * signature — on the first manual resize we adopt the dragged pixel height (so
 * core stops refitting to content) and remember it; afterwards we drop later
 * `{ height: "auto" }` refits so the user's chosen height sticks across the many
 * `render(false)` re-renders these dialogs do.
 *
 * Patches the V1 `Application` prototype once, but the behaviour change is scoped
 * to Stonetop windows (any `stonetop`-namespaced class) — every other V1 window
 * (core sheets, third-party apps) keeps core's exact `setPosition`, so a
 * programmatic `{ width, height }` call elsewhere can't be misread as a manual
 * resize and have its height frozen. Fixed-height and non-resized windows are
 * untouched. Idempotent via an own-property marker.
 */
// True for our own windows/modals — the only ones whose auto-height should be
// drag-lockable. Keyed off the shared `stonetop` class namespace every Stonetop
// Application/Dialog carries, so the prototype patch never alters a foreign window.
function _isStonetopWindow(app) {
	const classes = app?.options?.classes;
	return Array.isArray(classes)
		&& classes.some(c => c === "stonetop" || c.startsWith("stonetop-") || c.startsWith("stonetop_"));
}

export function enableAutoHeightVerticalResize() {
	// V13+ exposes the classic Application under foundry.appv1; fall back to the global.
	const ApplicationClass = foundry?.appv1?.api?.Application ?? globalThis.Application;
	const proto = ApplicationClass?.prototype;
	if (!proto || Object.prototype.hasOwnProperty.call(proto, "_stonetopVerticalResizePatched")) return;

	const baseSetPosition = proto.setPosition;
	if (typeof baseSetPosition !== "function") return;

	proto.setPosition = function (position = {}) {
		// Only Stonetop windows opt into the auto-height resize lock; everything else
		// gets core's untouched behaviour.
		if (!_isStonetopWindow(this)) return baseSetPosition.call(this, position);

		const isAutoHeight = this.options?.height === "auto";
		// The resize drag's tell: a finite numeric height with no left/top (Draggable
		// passes only { width?, height? }); internal reflows always carry left/top.
		const isResizeDrag = Number.isFinite(position?.height)
			&& !("top" in position) && !("left" in position);

		if (isAutoHeight && isResizeDrag) {
			// First manual resize: adopt the dragged height so core honours it instead
			// of refitting to content, and flag that the user has taken over sizing.
			this.options.height = position.height;
			this._stonetopHeightLocked = true;
		} else if (this._stonetopHeightLocked && position?.height === "auto") {
			// After a manual resize, ignore later auto-refit requests so the chosen
			// height persists (some steppers re-assert height:"auto" on every render).
			position = { ...position };
			delete position.height;
		}

		return baseSetPosition.call(this, position);
	};

	proto._stonetopVerticalResizePatched = true;
}
