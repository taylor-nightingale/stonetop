/**
 * Brings a Foundry Application to the front *once, as it opens*, using Foundry's
 * own window stacking (`bringToTop`). This means a sheet-spawned dialog opens
 * above the sheet that spawned it, but — unlike a forced, static high z-index, or
 * an observer that re-raises it — it does NOT stay on top: it participates in
 * normal stacking afterward, so any window the user brings forward later (e.g. the
 * Settings dialog, or the parent sheet) can sit over it.
 *
 * Extracted from CharacterOnboardingDialog's behavior so other sheet-spawned
 * dialogs (LevelUpDialog, DeathsDoorDialog, etc.) can share it.
 */
export class FrontOnOpen {
	/** @param {Application} app */
	constructor(app) {
		this._app = app;
	}

	/** Float the window on top once, via Foundry's native window stacking. */
	apply() {
		const app = this._app;
		const el = app?.element?.jquery ? app.element[0] : app?.element;
		if (!el) return;
		(app.bringToTop ?? app.bringToFront)?.call(app);
	}

	start() {
		// One-time positioning: float the window on top as it appears. We do NOT
		// attach event/MutationObserver guards, so the window is free to fall
		// behind other windows the user subsequently brings forward.
		this.apply();
	}

	stop() {
		// Nothing to tear down — native stacking needs no cleanup.
	}
}

/**
 * Wires FrontOnOpen into an arbitrary Application/Dialog instance by wrapping
 * its _render/activateListeners/close methods. Useful for ad-hoc `new Dialog(...)`
 * popups spawned from sheets, which can't be given their own subclass.
 * Safe to call before or after the app's first render.
 */
export function attachFrontOnOpen(app) {
	if (app._frontOnOpen) return app._frontOnOpen;
	const frontOnOpen = new FrontOnOpen(app);
	app._frontOnOpen = frontOnOpen;

	const baseRender = app._render.bind(app);
	app._render = async function (force, opts) {
		await baseRender(force, opts);
		frontOnOpen.apply();
	};

	const baseActivateListeners = app.activateListeners.bind(app);
	app.activateListeners = function (html) {
		baseActivateListeners(html);
		frontOnOpen.start();
	};

	const baseClose = app.close.bind(app);
	app.close = async function (opts) {
		frontOnOpen.stop();
		return baseClose(opts);
	};

	if (app.rendered) {
		frontOnOpen.apply();
		frontOnOpen.start();
	}

	return frontOnOpen;
}

/**
 * Render-callback hook for `new Dialog(...)`/`Dialog.confirm`/`Dialog.wait`
 * configs, none of which expose the Application instance directly. Resolves
 * it from the rendered html via the window app's data-appid, then attaches
 * FrontOnOpen to it. Pass directly as `render`, or call from an existing one.
 */
export function bringDialogToFront(html) {
	const el = html?.closest?.(".window-app")?.[0];
	const appId = el?.dataset?.appid;
	const app = appId ? globalThis.ui?.windows?.[appId] : null;
	if (app) attachFrontOnOpen(app);
}

/**
 * Open a journal(-page) sheet from a host dialog and float it on top. With
 * native window stacking a sheet opened after the host naturally lands above
 * it, so we simply render it and bring it to front once shown. The `childClass`
 * marker is still applied for any styling/identification that relies on it.
 *
 * Listens for both the v12 (`renderJournalSheet`) and v13 (`renderJournalEntrySheet`)
 * hook names and removes BOTH once either fires; a safety timeout removes them even
 * if the sheet never renders, so a cancelled/errored open can't leak the listeners.
 *
 * @param {Application} sheet                The journal- or page-sheet to open.
 * @param {object}      opts
 * @param {string}      opts.childClass      Marker class applied to the opened sheet.
 * @param {object}      [opts.renderOptions] Extra render options (e.g. `{ pageId }`).
 */
export function openJournalSheetAsChild(sheet, { childClass, renderOptions = {} } = {}) {
	if (!sheet) return;
	const bringToFront = (app) => {
		const el = app?.element?.jquery ? app.element[0] : app?.element;
		if (childClass) el?.classList?.add(childClass);
		(app.bringToTop ?? app.bringToFront)?.call(app);
	};
	if (sheet.rendered) {
		bringToFront(sheet);
		return;
	}
	let done = false;
	const cleanup = () => {
		if (done) return;
		done = true;
		Hooks.off("renderJournalSheet", onRender);
		Hooks.off("renderJournalEntrySheet", onRender);
	};
	const onRender = (app) => {
		if (app !== sheet) return;
		cleanup();
		bringToFront(app);
	};
	Hooks.on("renderJournalSheet", onRender);
	Hooks.on("renderJournalEntrySheet", onRender);
	// Safety net: never leak the listeners if the sheet never renders.
	setTimeout(cleanup, 10000);
	sheet.render(true, renderOptions);
}
