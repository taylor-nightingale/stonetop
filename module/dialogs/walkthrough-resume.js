import { getSetting, setSetting } from "../settings.js";

// ── Walkthrough reload-resume ──────────────────────────────────────────────────
// The session-zero walkthroughs (Character Introductions, Let Spring Burst Forth)
// are plain Applications that don't survive a browser refresh. Each one records, in
// a single client-scoped setting, where it is and whether it's currently open; a
// browser reload never runs the dialog's close(), so an `open: true` left behind
// means it was open when the page unloaded. hooks/Ready.js calls
// reopenOpenWalkthroughs() to bring those back at the page they were on. See
// settings.js for the stored shape.

const SETTING = "walkthroughResume";
// Which session-zero walkthroughs THIS world has finished. World-scoped (see
// settings.js) so completion resets in a fresh world rather than leaking across every
// world opened in the same browser the way the client-scoped resume above does.
const DONE_SETTING = "sessionZeroDone";

// One walkthrough's record ({ open, … }), or null if nothing's stored yet.
export function getWalkthroughResume(key) {
	return getSetting(SETTING)?.[key] ?? null;
}

// Merge `patch` into one walkthrough's record (creating it if absent), or drop the
// record entirely with `patch === null`. Returns the settings-write promise.
export function patchWalkthroughResume(key, patch) {
	const all = { ...(getSetting(SETTING) ?? {}) };
	if (patch === null) delete all[key];
	else all[key] = { ...(all[key] ?? {}), ...patch };
	return setSetting(SETTING, all);
}

// Record that a walkthrough was finished via its final button. Two writes: the client
// resume record is closed (open:false) and its saved position dropped — `positionKeys`
// names those fields ("phase"/"pcIndex", or "step") — so a later manual reopen starts
// fresh rather than resuming a finished run; and the completion itself is flagged in the
// world-scoped `sessionZeroDone` setting, which is what stops the first-session Welcome
// guide once both walkthroughs are complete (see sessionZeroComplete / hooks/Ready.js).
// Only the GM ever finishes a walkthrough (and only the GM can write world settings), so
// guard the world write against a stray player-side call.
export function markWalkthroughDone(key, positionKeys = []) {
	const patch = { open: false };
	for (const k of positionKeys) patch[k] = null;
	const resumeWrite = patchWalkthroughResume(key, patch);
	if (!game.user?.isGM) return resumeWrite;
	const done = { ...(getSetting(DONE_SETTING) ?? {}), [key]: true };
	return Promise.all([resumeWrite, setSetting(DONE_SETTING, done)]);
}

// True once both session-zero walkthroughs — Character Introductions and Let Spring
// Burst Forth — have been finished via their final button (each marked with
// markWalkthroughDone). World-scoped, so a fresh world starts session zero over again
// instead of inheriting completion from another world opened in the same browser.
export function sessionZeroComplete() {
	const done = getSetting(DONE_SETTING) ?? {};
	return !!(done.introductions && done.springBurst);
}

// Open an app and resolve once it has actually rendered. The v1 Application render()
// is fire-and-forget (it returns `this`, not the render promise), so we listen for
// its `render<ClassName>` hook; a safety timeout resolves anyway so the chain can
// never hang if a render fails to fire.
function openThenRendered(open, renderHook) {
	return new Promise(resolve => {
		let settled = false;
		let hookId  = null;
		const finish = () => {
			if (settled) return;
			settled = true;
			if (hookId !== null) Hooks.off(renderHook, hookId);
			clearTimeout(timer);
			resolve();
		};
		hookId = Hooks.once(renderHook, finish);
		const timer = setTimeout(finish, 3000);
		Promise.resolve(open()).catch(() => finish());
	});
}

// Reopen any walkthrough that was open when the page last unloaded, each at the page
// it was on (the dialogs restore their own position on open). We let one fully render
// before opening the next so the last — Spring Burst, if it was open on top of
// Introductions — lands frontmost instead of being buried by a slower-rendering
// sibling. Called from ready (after the Welcome guide renders; see hooks/Ready.js).
export async function reopenOpenWalkthroughs() {
	const resume = getSetting(SETTING) ?? {};
	if (resume.introductions?.open) {
		await openThenRendered(() => game.stonetop?.openIntroductions?.(), "renderIntroductionsDialog");
	}
	if (resume.springBurst?.open) {
		await openThenRendered(() => game.stonetop?.openSpringBurst?.(), "renderSpringBurstDialog");
	}
}
