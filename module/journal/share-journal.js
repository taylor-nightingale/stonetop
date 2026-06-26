// A GM-only "Share with Players" control on the journal entry sheet header.
//
// Stonetop ships most of its lore/locations/bestiary journals GM-only (ownership
// default NONE) so players can be surprised by what they discover. When the GM
// decides a journal is fair game, the usual path is the Ownership config dialog —
// fiddly and easy to miss. This adds a single eye button to the journal's header
// bar (GMs only) that opens a focused modal: do you want your players to see this
// journal, and should they get read-only Observer access or full Ownership?
//
// We drive `ownership.default`, the baseline level every un-listed player gets:
//   NONE (hidden) → OBSERVER (can read) → OWNER (can edit).
// Per-user grants the GM set by hand are left untouched — default is only the
// floor, so this never clobbers an intentional one-off share.

import { FrontOnOpen } from "../utils/front-on-open.js";

// Looked up lazily (not at module load) so the file imports cleanly outside
// Foundry — e.g. under the unit tests — and never races the global's setup.
const levels = () => CONST.DOCUMENT_OWNERSHIP_LEVELS;

/**
 * The `ownership.default` level the two checkboxes map to: hidden when players
 * can't see it, full OWNER when they can and the upgrade is ticked, read-only
 * OBSERVER otherwise.
 * @param {boolean} visible  Players may see the journal at all.
 * @param {boolean} owner    Upgrade them from Observer to Owner.
 */
export function shareLevelFor(visible, owner) {
	const O = levels();
	if (!visible) return O.NONE;
	return owner ? O.OWNER : O.OBSERVER;
}

/**
 * Render-hook handler for the journal entry sheet (AppV1 `renderJournalSheet` on
 * v12, AppV2 `renderJournalEntrySheet` on v13+). Adds — once — a GM-only eye
 * button to the window header that opens {@link ShareJournalDialog}. No-op for
 * players and for the per-page sheets (we want whole-entry visibility only).
 */
export function addJournalShareButton(app) {
	if (!game.user?.isGM) return;
	const journal = app?.document ?? app?.object;
	if (!(journal instanceof JournalEntry)) return;

	const root = app.element?.jquery ? app.element[0] : app.element;
	const header = root?.querySelector?.(".window-header");
	if (!header) return;

	const existing = header.querySelector(".stonetop-share-journal");
	if (existing) {
		_refreshShareButton(existing, journal);
		return;
	}

	// v12 sheets use <a.header-button>; v13+ AppV2 sheets use icon-only
	// <button.header-control>. Match whichever the surrounding header uses so the
	// new control looks native.
	const isAppV1 = !!header.querySelector("a.header-button");
	const btn = isAppV1 ? _makeV1Button() : _makeV2Button();
	_refreshShareButton(btn, journal);
	btn.addEventListener("click", ev => {
		ev.preventDefault();
		ev.stopPropagation();
		new ShareJournalDialog(journal).render(true);
	});

	// Sit leftmost of the header controls, just before the config/close cluster.
	const firstControl = header.querySelector(isAppV1 ? "a.header-button" : "button.header-control");
	if (firstControl) header.insertBefore(btn, firstControl);
	else header.appendChild(btn);
}

function _makeV1Button() {
	const a = document.createElement("a");
	a.className = "header-button control stonetop-share-journal";
	a.innerHTML = `<i class="fas fa-eye"></i> Share`;
	return a;
}

function _makeV2Button() {
	const btn = document.createElement("button");
	btn.type = "button";
	// AppV2 header controls take their glyph from a Font Awesome class on the
	// button itself; the eye/eye-slash is set in _refreshShareButton.
	btn.className = "header-control icon stonetop-share-journal";
	return btn;
}

/** Sync a header button's icon, tooltip, and shared-tint to the journal's state. */
function _refreshShareButton(btn, journal) {
	const O = levels();
	const shared = (journal?.ownership?.default ?? O.NONE) >= O.OBSERVER;
	const tip = shared
		? "Players can see this journal — click to change"
		: "Hidden from players — click to share";
	btn.classList.toggle("is-shared", shared);
	btn.setAttribute("data-tooltip", tip);
	btn.setAttribute("aria-label", tip);

	const icon = btn.querySelector("i");
	if (icon) {
		// v12 <a> button: swap the inner <i>.
		icon.classList.toggle("fa-eye", shared);
		icon.classList.toggle("fa-eye-slash", !shared);
	} else {
		// v13+ icon-only <button>: the glyph lives on the button's own classes.
		btn.classList.add("fa-solid");
		btn.classList.toggle("fa-eye", shared);
		btn.classList.toggle("fa-eye-slash", !shared);
	}
}

/**
 * The "Share with Players" modal. One checkbox decides whether players can see
 * the journal at all; a second upgrades them from read-only Observer to full
 * Ownership. Saving writes the matching `ownership.default` level.
 */
export class ShareJournalDialog extends Application {
	constructor(journal, options = {}) {
		super(options);
		this.journal = journal;
		this._frontOnOpen = new FrontOnOpen(this);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-share-journal-dialog",
			title:     "Share With Players",
			template:  "systems/stonetop/templates/dialogs/share-journal.hbs",
			width:     440,
			height:    "auto",
			resizable: true,
			classes:   ["stonetop", "stonetop-share-dialog"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	getData() {
		const O = levels();
		const level = this.journal?.ownership?.default ?? O.NONE;
		return {
			name:    this.journal?.name ?? "this journal",
			visible: level >= O.OBSERVER,
			owner:   level >= O.OWNER,
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();

		const visibleCb = html.find(".stonetop-share-visible");
		const ownerRow  = html.find(".stonetop-share-owner-row");
		const ownerCb   = html.find(".stonetop-share-owner");

		// The Ownership upgrade only makes sense once players can see the journal;
		// dim and disable it (clearing it) whenever visibility is off.
		const sync = () => {
			const on = visibleCb.prop("checked");
			ownerRow.toggleClass("is-disabled", !on);
			ownerCb.prop("disabled", !on);
			if (!on) ownerCb.prop("checked", false);
		};
		visibleCb.on("change", sync);
		sync();

		html.find(".stonetop-share-cancel").on("click", () => this.close());
		html.find(".stonetop-share-save").on("click", () => this._save(html));
	}

	async _save(html) {
		const visible = html.find(".stonetop-share-visible").prop("checked");
		const owner   = html.find(".stonetop-share-owner").prop("checked");
		const level   = shareLevelFor(visible, owner);
		const name    = this.journal?.name ?? "this journal";

		try {
			await this.journal.update({ "ownership.default": level });
			const msg = !visible
				? `“${name}” is now hidden from players.`
				: owner
					? `Players can now edit “${name}”.`
					: `Players can now view “${name}”.`;
			ui.notifications?.info(msg);
		} catch (err) {
			console.error("Stonetop | Failed to update journal sharing:", err);
			ui.notifications?.error("Couldn't update this journal's player access.");
		}
		this.close();
	}
}
