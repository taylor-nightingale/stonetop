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
import { BoardView } from "./BoardView.js";
import { toggleDisclosure } from "../../utils/Disclosure.js";
import { SeasonStepAddress } from "../../model/data/steading/SeasonStepAddress.js";

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
				// A line in one of the content-policy lists. The move that maintains them says
				// "update the lists", so they are lists — the free textarea they replaced could be
				// edited but never added to, which is not the same shape as the rule.
				addContentItem:   editOnly(function (ev, target) {
					return this._stonetopSteading.addContentItem(target.dataset.slug);
				}),

				// --- the reference lists, as targets ---
				// A name replaces the focused row's name; with no row focused it creates the villager
				// outright, which is how most of session zero actually goes. A trait only ever appends
				// to a row, so with nothing focused it says where to put it rather than inventing a
				// nameless person the actor sync would then skip.
				//
				// The name brings its LIST's place with it: picking off Marshedge's list is the table
				// saying this person is from Marshedge, so the Home column is filled rather than left
				// to be typed out again. A default only — a row that already says where they live
				// keeps it (Person.withHomeIfUnset) — and blank on the steading's own list, since a
				// blank Home means this steading.
				useName: editOnly(async function (ev, target) {
					const { value: name, home = "" } = target.dataset;
					const id = this.rosterFocus.id;
					if (id) return this._stonetopSteading.usePersonName(id, name, home);
					const person = await this._stonetopSteading.addPersonNamed(name, home);
					this.rosterFocus.focusOn(person.id);
				}),

				// Folding a name list away, and opening an improvement card onto its requirement
				// rows, are view state on the thing itself rather than edits — so neither is
				// edit-gated and both survive a locked sheet. The same disclosure the move rows use,
				// through the same one implementation.
				toggleFolkList:        toggleDisclosure,
				toggleImprovementCard: toggleDisclosure,
				useTrait: editOnly(function (ev, target) {
					const id = this.rosterFocus.id;
					if (!id) return void ui.notifications?.info(game.i18n.localize("stonetop.steading.folk.focusRowFirst"));
					return this._stonetopSteading.appendPersonTrait(id, target.dataset.value);
				}),

				// --- the season ---
				// Turning the wheel, and nothing else — the season's move is rolled inside the box
				// that describes it. The control lives here and nowhere else: the season is DISPLAYED
				// wherever the ratings are, but a turn-the-season click reachable from anywhere is a
				// foot-gun on a sheet six people can edit.
				//
				// It asks first, because it discards this season's checklist and gain. The question
				// names the season it brings, which is the whole of what pressing it does.
				turnSeason: editOnly(async function () {
					const next = this._stonetopSteading.season.next;
					const ok = await foundry.applications.api.DialogV2.confirm({
						window:  { title: game.i18n.localize("stonetop.steading.seasons.turnTitle") },
						content: `<p>${game.i18n.format("stonetop.steading.seasons.turnConfirm", {
							season: game.i18n.localize(next.labelKey),
						})}</p>`,
					});
					if (ok) await this._stonetopSteading.turnSeason();
				}),

				// A roll of the season's move that rolls dice of its own — winter's 1d4+Population,
				// summer's 1d4-1 Surplus, autumn's 1d4 at the harvest, and the second 1d4+Population
				// winter's 7-9 and 6- call for. Edit-gated now that it MOVES Surplus by what it rolled:
				// the card alone left the table doing the one piece of arithmetic the sheet had just
				// done for them.
				rollSeasonStep: editOnly(function (ev, target) {
					return this._stonetopSteading.rollSeasonStep(SeasonStepAddress.parse(target.dataset.step));
				}),

				// The same write with no dice in it: a step the sheet added for the steading's own gains,
				// in a season whose move generates nothing of its own. Recorded and reverted exactly as
				// a rolled step is — it is the same step, minus the roll.
				applySeasonStep: editOnly(function (ev, target) {
					return this._stonetopSteading.applySeasonStep(SeasonStepAddress.parse(target.dataset.step));
				}),

				// Give back what a step's roll took or paid. The record is season-scoped, so the offer
				// lasts as long as the season does and goes when the wheel turns — a season that is
				// over is not one you un-spend.
				revertSeasonStep: editOnly(function (ev, target) {
					return this._stonetopSteading.revertSeasonStep(SeasonStepAddress.parse(target.dataset.step));
				}),

				// The one instruction in Seasons Change that applies on every result, and the sheet
				// used to leave it entirely unsaid. Not gated on having rolled: the table decides when
				// it happened, as with everything else here.
				resetFortunes: editOnly(function () {
					return this._stonetopSteading.resetFortunes();
				}),

				// --- applying what an improvement does ---
				// One control per result, because every applied line is independently revertable BECAUSE
				// it was independently applied. Both are guarded in the domain: applying twice writes
				// nothing, and a result migrated from the old storage knows that it happened but not what
				// it wrote, so it offers no Revert rather than guessing an inverse.
				applyEffectLine: editOnly(function (ev, target) {
					return this._stonetopSteading.applyEffectLine(target.dataset.lineId);
				}),

				revertEffectLine: editOnly(function (ev, target) {
					return this._stonetopSteading.revertEffectLine(target.dataset.lineId);
				}),

				// The season's own statement, written once. Guarded in the domain rather than here, so
				// two people pressing it at the same moment still pay the season only once.
				applyTurnover: editOnly(function () {
					return this._stonetopSteading.applyTurnover();
				}),

				// A moment WITHIN the season — the harvest coming in, the hunt being led. The sheet
				// cannot know when either happened, so the table says so by pressing this. Guarded in
				// the domain on both counts: once per season, and only in a season it can occur in.
				applyMoment: editOnly(function (ev, target) {
					return this._stonetopSteading.applyMoment(target.dataset.slug);
				}),

				// --- the improvement board's own view ---
				// Narrowing the board is view state on the reader, not an edit: it writes nothing, so
				// it is not edit-gated and it works on a locked sheet. Filtering happens in the DOM
				// for the same reason the roster's search does — a document update per click would
				// put every other client through a render to answer one person's question.
				toggleBoardFilter(ev, target) {
					if (this.boardView.toggle(target.dataset.boardFilter)) this.boardView.restore(this.element);
				},

				// The same, on the axis that cuts across the states — what is owed, and what fires this
				// season. A separate action because it is a separate question, not a fourth state.
				toggleBoardFlag(ev, target) {
					if (this.boardView.toggleFlag(target.dataset.boardFlag)) this.boardView.restore(this.element);
				},

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
				removeContentItem: confirmedDelete(function (target) {
					return this._stonetopSteading.removeContentItem(target.dataset.slug, target.dataset.index);
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
		// Tabs filed by WHEN you use them rather than by which book page they came off.
		//
		// Play is open essentially the whole session, so it carries the things a steading move needs:
		// the homefront moves themselves, and the two ratings that lead evidence lists. Folk is the
		// people, Places the map, Improvements what the steading is building, Season the ritual,
		// Content the table's own agreements. The seven page-order tabs split single jobs across tabs
		// — rolling a move meant Moves, then the header, then Overview — which is the cost this pays
		// off.
		//
		// The board is its own tab, ahead of Season rather than under it. Building a mill is a
		// season-long project the table reads and ticks between turnovers, and the turnover is one
		// evening's ritual: filing them together meant scrolling past the whole wheel to reach the
		// thing being looked at far more often. Season is the ritual alone now.
		//
		// Places of interest and the neighbouring communities are ONE concept at two scales, so they
		// get one tab: the Stone and the Granary, and Marshedge and the Steplands. They sat apart only
		// because the printed playbook prints them on different pages — Book II files them together
		// itself, running Stonetop's entry as Size · Population · Prosperity · Resources · Defenses ·
		// Places, one block.
		static TABS = {
			primary: {
				tabs: [
					{ id: "play",         label: "stonetop.steading.tabs.play" },
					{ id: "folk",         label: "stonetop.steading.tabs.folk" },
					{ id: "places",       label: "stonetop.steading.tabs.places" },
					{ id: "improvements", label: "stonetop.steading.tabs.improvements" },
					{ id: "season",       label: "stonetop.steading.tabs.season" },
					{ id: "content",      label: "stonetop.steading.tabs.content" },
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
		get boardView()    { return this._boardView    ??= new BoardView(); }

		// Core rebuilds the part's DOM on every render, which takes the caret and the search with it.
		// Put back after the base's own regions, and — like them — before core measures the tree it is
		// about to restore scroll into: a filtered roster and a filtered board are both SHORTER than
		// what the template rendered.
		restoreViewState(root) {
			super.restoreViewState(root);
			this.rosterFilter.restore(root);
			this.rosterFocus.restore(root);
			this.boardView.restore(root);
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
				if (ev.target.closest?.(RosterFilter.INPUT)) {
					if (this.rosterFilter.setQuery(ev.target.value)) this.rosterFilter.apply(root);
					return;
				}
				if (ev.target.closest?.(BoardView.INPUT)) {
					if (this.boardView.setQuery(ev.target.value)) this.boardView.apply(root);
				}
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
