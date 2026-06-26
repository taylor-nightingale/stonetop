import {resolvedFlagProperty} from "../actors/character/StonetopFlags.js";
import {escHtml} from "./strings.js";

export function getStonetopSteadingActor() {
	return game.actors?.find(a => a.type === "stonetop" || a.system?.customType === "stonetop") ?? null;
}

// Like getStonetopSteadingActor, but warns (and returns null) when no steading exists
// yet — the one home for the "not found" wording, shared by the jump-to-steading
// shortcut and the Seasons Change hotbar macro (see hooks/Ready.js).
export function getStonetopSteadingActorOrWarn() {
	const steading = getStonetopSteadingActor();
	if (!steading) ui.notifications?.warn?.("No Stonetop steading was found in this world yet.");
	return steading;
}

// Open the shared Stonetop steading actor's sheet (focused), or warn if none exists
// yet. Backs the "Stonetop" header shortcut on the session-zero dialogs (Welcome,
// Introductions) — mirrors the steading button on the character sheet header.
export function openStonetopSteading() {
	getStonetopSteadingActorOrWarn()?.sheet.render(true, { focus: true });
}

// The one "Stonetop" steading-shortcut descriptor — label (the steading's name, or
// "Stonetop" when unset), marker icon, unset-state class, and the open-or-warn click.
// Shared by every place that offers the jump: the Welcome/Introductions
// _getHeaderButtons overrides (which push this object) and addStonetopSteadingButton
// (which builds an <a> from its fields for stock Dialogs that can't override).
export function stonetopSteadingHeaderButton() {
	const steading = getStonetopSteadingActor();
	return {
		label:   steading?.name || "Stonetop",
		class:   "stonetop-open-steading" + (steading ? "" : " stonetop-open-steading--unset"),
		icon:    "fas fa-map-marker-alt",
		onclick: openStonetopSteading,
	};
}

// Inject the "Stonetop" button into a stock Dialog's window header (which can't override
// _getHeaderButtons), mirroring the steading button on the character sheet header. Pass
// the render-callback `html` (the dialog content); we walk up to the header and slot the
// button before Close. Built from the shared descriptor; idempotent per render.
export function addStonetopSteadingButton(html) {
	const content = html?.jquery ? html[0] : (html?.[0] ?? html);
	const header  = content?.closest?.(".window-app, .app")?.querySelector?.(".window-header");
	if (!header || header.querySelector(".stonetop-open-steading")) return;

	const { label, class: cls, icon, onclick } = stonetopSteadingHeaderButton();
	const btn = document.createElement("a");
	btn.className = "header-button control " + cls;
	btn.innerHTML = `<i class="${icon}"></i> ${escHtml(label)}`;
	btn.addEventListener("click", ev => { ev.preventDefault(); onclick(); });

	header.insertBefore(btn, header.querySelector(".header-button.close, a.close"));
}

export function getStonetopProsperity() {
	const actor = getStonetopSteadingActor();
	if (!actor) return null;
	return resolvedFlagProperty(actor, "steading.system.attributes.prosperity.value")
		?? actor.system?.attributes?.prosperity?.value
		?? null;
}
