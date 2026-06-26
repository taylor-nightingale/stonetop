import { resolveEntry, isStonetopJournalEntry } from "./journal-spiral-bullets.js";
import { isInCompendium } from "./compendium-edit-guard.js";
import { deletionEntry } from "./foundry-compat.js";

// Make the requirement/option "check-bullet" list items in this system's journals
// tickable straight from the reading view — no edit mode, no pack rebuild. The
// checked state is stored on the owning JournalEntryPage (flags.stonetop.checks),
// so it's SHARED: everyone at the table sees the same ticks, and a user who can
// update the page (the GM / page owner) is the one who toggles them. Readers who
// can't update the page still see the checked state, just can't change it.
//
// Companion to:
//   • check-bullets.js          — tags the requirement-list <li>s `check-bullet`.
//   • journal-spiral-bullets.js — runs first on the same render hook and adds the
//                                 `.stonetop-journal-body` wrapper.
// We cover the three prose bodies a check-list can render in: the hand-authored
// prose journals (`.stonetop-journal-body`), the legacy location wrapper
// (`.stonetop-location-body`), and the bestiary/location section bodies
// (`.stonetop-monster-rich-text`) the gazetteer pages actually use.
//
// Each box is keyed by its position among its page's check-bullet items (document
// order). That's stable while the page's content isn't re-authored — fine for the
// shipped reference journals; re-authoring a checklist may shift later ticks.

const SELECTOR = [
	".stonetop-journal-body li.check-bullet",
	".stonetop-location-body li.check-bullet",
	".stonetop-monster-rich-text li.check-bullet",
	".stonetop-monster-move-description li.check-bullet",
].join(", ");
const FLAG_SCOPE = "stonetop";
const FLAG_KEY = "checks";

/** The JournalEntryPage that owns a rendered check-bullet element. */
function resolvePage(app, el) {
	const doc = app?.document ?? app?.object;
	if (doc?.documentName === "JournalEntryPage") return doc;
	// Multi-page entry sheet: each page's markup is wrapped with its id.
	const pageId = el.closest("[data-page-id]")?.dataset?.pageId;
	return pageId ? doc?.pages?.get?.(pageId) ?? null : null;
}

/** Persist one box's state on its page (absent key === unchecked, to stay lean). */
function writeCheck(page, key, checked) {
	const path = `flags.${FLAG_SCOPE}.${FLAG_KEY}`;
	if (checked) return page.update({ [`${path}.${key}`]: true });
	// Drop the key when unchecking (absent key === unchecked) using whichever delete
	// form this core understands — see deletionEntry in foundry-compat.js.
	const [updKey, val] = deletionEntry(`${path}.${key}`);
	return page.update({ [updKey]: val });
}

/** Reflect `checked` on the item (drives the read-only ::before) and its control. */
function reflect(li, control, checked) {
	li.classList.toggle("checked", checked);
	control?.setAttribute("aria-checked", checked ? "true" : "false");
}

function bindControl(control, page) {
	const toggle = () => {
		const li = control.closest("li");
		const next = control.getAttribute("aria-checked") !== "true";
		reflect(li, control, next); // optimistic; the resulting re-render re-asserts it
		Promise.resolve(writeCheck(page, control.dataset.checkKey, next)).catch(err => {
			reflect(li, control, !next); // revert if the update was refused
			console.error("Stonetop | failed to persist journal checkbox", err);
		});
	};
	control.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); toggle(); });
	control.addEventListener("keydown", ev => {
		if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); toggle(); }
	});
}

/**
 * Turn the check-bullet items of a rendered Stonetop prose journal into shared,
 * tickable checkboxes. Shows the stored state to every reader; injects a
 * focusable toggle control only when the current user can update the page.
 * Idempotent — safe on every journal render hook.
 * @param {Application} app          The journal- or page-sheet application.
 * @param {HTMLElement|jQuery} html  Its rendered root.
 */
export function applyJournalCheckboxes(app, html) {
	const root = html?.jquery ? html[0] : html;
	if (!root?.querySelectorAll) return;
	if (!isStonetopJournalEntry(resolveEntry(app))) return;

	const items = root.querySelectorAll(SELECTOR);
	if (!items.length) return;

	// Per-page running index so a box's key is the same whether its page is rendered
	// alone (page sheet) or among siblings (the whole-entry sheet).
	const counters = new Map();

	for (const li of items) {
		const page = resolvePage(app, li);
		if (!page) continue;
		const n = counters.get(page.id) ?? 0;
		counters.set(page.id, n + 1);
		const key = `c${n}`;

		// Read straight off the data, not getFlag(): "stonetop" isn't a registered
			// package id, so getFlag() rejects it as an invalid flag scope under V13. The
			// rest of the system reads its baked `flags.stonetop.*` the same direct way.
			const checked = page.flags?.[FLAG_SCOPE]?.[FLAG_KEY]?.[key] === true;

		// In a compendium the page is immutable reference content (see
		// compendium-edit-guard.js): show the stored ticks read-only, never an editable
		// control, so a click can't attempt a write that would fail or be lost.
		let control = li.querySelector(":scope > .stonetop-journal-check");
		if (!control && !isInCompendium(page) && page.canUserModify?.(game.user, "update")) {
			control = document.createElement("span");
			control.className = "stonetop-journal-check";
			control.setAttribute("role", "checkbox");
			control.setAttribute("tabindex", "0");
			control.dataset.checkKey = key;
			li.classList.add("stonetop-check-interactive");
			li.prepend(control);
			bindControl(control, page);
		}
		reflect(li, control, checked);
	}
}
