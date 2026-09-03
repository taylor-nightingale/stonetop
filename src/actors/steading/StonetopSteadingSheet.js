import { loadAllSteadfasts } from "./applySteadfast.js";
import { editOnly, confirmedDelete, confirmedUnlink } from "../../utils/sheetActions.js";
import { steadingChangeHandlers } from "./steadingChangeHandlers.js";
import { RosterActorCreation } from "./RosterActorCreation.js";
import { ChoiceGroupWiring } from "../../utils/ChoiceGroupWiring.js";
import { ChangeActionRouter } from "../../utils/ChangeActionRouter.js";
import { activateTablistKeys } from "../../utils/tablistKeyboard.js";
import { RAIL_ACTIONS } from "../../utils/SheetRail.js";
import { MOVE_ROW_ACTIONS, moveRowChangeHandlers } from "../moveRowHandlers.js";
import { RosterFocus } from "./RosterFocus.js";
import { RosterFilter } from "./RosterFilter.js";

export function createStonetopSteadingSheetClass(Base) {
	return class StonetopSteadingSheet extends Base {
		get _stonetopSteading() {
			return this.typedActor;
		}

		static DEFAULT_OPTIONS = {
			// The base supplies `stonetop sheet actor`; add the steading class.
			classes: ["steading"],
			position: { width: 1180, height: 760 },
			actions: {
				...MOVE_ROW_ACTIONS,
				// The rail's drawer toggle, below the layout's breakpoint. Shared with the character
				// sheet — same component, opposite edge.
				...RAIL_ACTIONS,

				// --- adds ---
				// Adding also clears the focused row, so the next name clicked in the reference column
				// creates someone rather than renaming whoever was last edited.
				addPerson:        editOnly(function () {
					this.rosterFocus.clear();
					return this._stonetopSteading.addPerson();
				}),
				addPlace:         editOnly(function () { return this._stonetopSteading.addPlace(); }),
				addAssetItem:     editOnly(function () { return this._stonetopSteading.addAssetItem(); }),
				addAttributeItem: editOnly(function (ev, target) {
					return this._stonetopSteading.addAttributeItem(target.dataset.attr);
				}),

				// --- the reference lists, as targets ---
				// A name replaces the focused row's name; with no row focused it creates the villager
				// outright, which is how most of session zero actually goes. A trait only ever appends
				// to a row, so with nothing focused it says where to put it rather than inventing a
				// nameless person the actor sync would then skip.
				useName: editOnly(async function (ev, target) {
					const name = target.dataset.value;
					const id = this.rosterFocus.id;
					if (id) return this._stonetopSteading.updatePersonName(id, name);
					const person = await this._stonetopSteading.addPersonNamed(name);
					this.rosterFocus.focusOn(person.id);
				}),
				useTrait: editOnly(function (ev, target) {
					const id = this.rosterFocus.id;
					if (!id) return void ui.notifications?.info(game.i18n.localize("stonetop.steading.folk.focusRowFirst"));
					return this._stonetopSteading.appendPersonTrait(id, target.dataset.value);
				}),

				// --- NPC actors for the roster (GM-only control; the automatic path is a hook) ---
				createFolkActors: editOnly(function () {
					return RosterActorCreation.forFolk(this._stonetopSteading).run();
				}),

				// --- unlinks (drop the linked document, keep the row; click confirms, right-click skips) ---
				unlinkPerson: confirmedUnlink(function (target) {
					return this._stonetopSteading.unlinkPerson(target.dataset.id);
				}),
				unlinkPlace: confirmedUnlink(function (target) {
					return this._stonetopSteading.unlinkPlace(parseInt(target.dataset.index));
				}),

				// --- deletes (click confirms, right-click skips) ---
				removePerson: confirmedDelete(function (target) {
					return this._stonetopSteading.removePerson(target.dataset.id);
				}),
				removeAssetItem: confirmedDelete(function (target) {
					return this._stonetopSteading.removeAssetItem(parseInt(target.dataset.index));
				}),
				removeAttributeItem: confirmedDelete(function (target) {
					return this._stonetopSteading.removeAttributeItem(target.dataset.attr, target.dataset.index);
				}),
				// Granting an improvement is drag-drop (_onDropItem); this revokes one.
				revokeImprovement: confirmedDelete(function (target) {
					return this._stonetopSteading.revokeImprovement(target.dataset.slug);
				}),
			},
		};

		// Core tab machinery end to end: tabGroups seeds from `initial`, the nav buttons carry
		// data-action="tab" (core's built-in action → changeTab), and context.tabs comes out of
		// super._prepareContext via _prepareTabs.
		//
		// Four tabs, filed by WHEN you use them rather than by which book page they came off.
		//
		// Play is open essentially the whole session, so it carries the things a steading move needs:
		// the homefront moves themselves, and the two ratings that lead evidence lists. Folk is the
		// people, Season the ritual, Chronicle the record. The seven page-order tabs split single jobs
		// across tabs — rolling a move meant Moves, then the header, then Overview — which is the cost
		// this pays off.
		static TABS = {
			primary: {
				tabs: [
					{ id: "play",      label: "stonetop.steading.tabs.play" },
					{ id: "folk",      label: "stonetop.steading.tabs.folk" },
					{ id: "season",    label: "stonetop.steading.tabs.season" },
					{ id: "chronicle", label: "stonetop.steading.tabs.chronicle" },
				],
				initial: "play",
			},
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/actor/steading.hbs",
				// The TAB scrolls, not the sheet. Scrolling used to live on .window-content, which
				// took the ledger line and the tab strip with it — and the line exists precisely so a
				// rating, a condition and the roll mode are readable without going to find them. A
				// tall Play tab would have reintroduced the scroll-to-the-header step the line was
				// built to remove. Same arrangement the character sheet uses, for the same reason.
				scrollable: [".sheet-body", ".stonetop-rail"],
			},
		};

		async _prepareContext(options) {
			// Independent of the snapshot, so it is started first and overlaps the base's build.
			const steadfasts = loadAllSteadfasts();
			const ctx = await super._prepareContext(options);
			// The steadfast picker at the top of the sheet: every steadfast + the one this steading uses.
			// The list is stashed so the name combobox's change handler can resolve a picked/typed name.
			ctx.availableSteadfasts = this._availableSteadfasts = await steadfasts;
			ctx.currentSteadfast    = this.actor.system.steadfast;
			// Creating actors and folders is GM work, so the controls that do it only render for one.
			ctx.isGM                = globalThis.game?.user?.isGM ?? false;
			return ctx;
		}

		// A steadfast or move dropped on the steading is handled by the typed steading (re-seed the
		// definition / join the homefront list); anything else embeds through core's default
		// pipeline. Core ActorSheetV2 wires the drop listeners itself — never wire `drop` manually
		// here, or every drop is handled twice.
		async _onDropItem(event, item) {
			if (!this.isEditable) return null;
			if (await this._stonetopSteading.applyDroppedItem(item)) return null;
			return super._onDropItem(event, item);
		}

		// Core routes every resolved drop through _onDropDocument (→ _onDropActor/_onDropItem/…). Any
		// document (actor, journal, item…) dropped onto a roster or place row links there as a bare
		// UUID, rendered as a clickable content link. Off any linkable row, the drop falls through to
		// core's routing (steadfast/move handling, item embed, …).
		async _onDropDocument(event, document) {
			if (this.isEditable && document?.uuid) {
				const s = this._stonetopSteading;
				const personRow = event.target.closest?.(RosterFocus.ROW);
				if (personRow) return void await s.linkPerson(personRow.dataset.id, document.uuid);
				const placeRow = event.target.closest?.(".stonetop-places-row");
				if (placeRow) return void await s.linkPlace(Number(placeRow.dataset.index), document.uuid);
			}
			return super._onDropDocument(event, document);
		}

		/**
		 * The roster row this reader is working on, and what they have searched for.
		 *
		 * On the sheet INSTANCE and never on the actor: which row you are editing and what you have
		 * typed into a search box are facts about you, not about the steading — stored on the document
		 * they would move everyone's caret at the table. Same reason, same shape as openMoveRows.
		 */
		get rosterFocus()  { return this._rosterFocus  ??= new RosterFocus(); }
		get rosterFilter() { return this._rosterFilter ??= new RosterFilter(); }

		// Core rebuilds the part's DOM on every render, which takes the caret and the search with it.
		// Restored here, after the base has put the open move rows back.
		_onRender(context, options) {
			super._onRender(context, options);
			this.rosterFilter.restore(this.element);
			this.rosterFocus.restore(this.element);
		}

		// Root-delegated, one-time wiring — the V2 root persists across re-renders. Editability is
		// checked per event, not at wiring time, so a sheet that becomes editable later just works.
		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			const root = this.element;

			// Arrow keys / Home / End across the tab row — core ships the clicks, not the keyboard model.
			activateTablistKeys(root);

			// The roster's caret follows the caret: whichever row you put the cursor in is the row a
			// click in the reference column lands on, so nothing extra has to be clicked to say
			// "this one". Escape steps back out, which is how you get "create someone new" again.
			root.addEventListener("focusin", ev => {
				this.rosterFocus.noteFocus(ev.target);
				this.rosterFocus.restore(root);
			});
			root.addEventListener("keydown", ev => {
				if (ev.key !== "Escape" || !ev.target.closest?.(RosterFocus.ROSTER)) return;
				this.rosterFocus.clear();
				this.rosterFocus.restore(root);
			});

			// The search filters rows in place. No actor write and no render — a document update per
			// keystroke would put every other client's sheet through a render to answer one person's
			// typing — so it is not a data-change-action and is deliberately NOT gated on isEditable:
			// reading a locked steading's roster is still reading.
			root.addEventListener("input", ev => {
				if (!ev.target.closest?.(RosterFilter.INPUT)) return;
				if (this.rosterFilter.setQuery(ev.target.value)) this.rosterFilter.apply(root);
			});

			// Every choice row on the sheet — improvement tracks, seasonal gains — through the one
			// shared description of how a choice row behaves.
			new ChoiceGroupWiring(this._stonetopSteading, { when: () => this.isEditable }).attach(root);

			// Every change control on the sheet — its own fields and the move rows it shares with
			// the character sheet — through one delegated router.
			new ChangeActionRouter({
				...moveRowChangeHandlers(this._stonetopSteading),
				...steadingChangeHandlers(this._stonetopSteading, {
					availableSteadfasts: () => this._availableSteadfasts ?? [],
				}),
			}, {
				when: () => this.isEditable,
				ignore: ChoiceGroupWiring.CHANGE_ACTIONS,
			}).attach(root);
		}
	};
}
