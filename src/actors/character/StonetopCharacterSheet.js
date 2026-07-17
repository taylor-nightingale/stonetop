import { FoundryPlaybookRepository } from "./repositories/FoundryPlaybookRepository.js";
import { enrichRichTextTree } from "../../utils/enrichRichText.js";
import { confirmDelete } from "../../utils/confirmDelete.js";
import { ChangeActionRouter } from "../../utils/ChangeActionRouter.js";
import { ChoiceTarget } from "./ChoiceTarget.js";
import { takeTagInputValue } from "../../utils/takeTagInputValue.js";

const ADD_ITEM_DIALOG_TEMPLATE = "systems/stonetop/templates/actor/partials/add-inventory-item-dialog.hbs";

// View adapter only (the thin-sheet rule): every handler reads values off the event/DOM and calls
// ONE named method on the typed character — routing, parsing, and pip math live on
// StonetopCharacter, tested there. Clicks go through the V2 actions map (data-action), changes
// through one ChangeActionRouter (data-change-action); nothing is hand-wired per render.
export function createStonetopCharacterSheetClass(Base) {
	return class StonetopCharacterSheet extends Base {
		_stonetopCharacter;
		_playbookRepository = new FoundryPlaybookRepository();

		constructor(...args) {
			super(...args);
			this._stonetopCharacter = this.actor.typedActor;
		}

		static DEFAULT_OPTIONS = {
			// The base supplies `stonetop sheet actor themed theme-light`.
			classes: ["pbta", "character"],
			position: { width: 1160, height: 900 },
			actions: {
				// --- view-state toggles (no actor writes, so no editability gate) ---
				toggleTop(ev, target) {
					target.closest(".sheet-wrapper")?.classList.toggle("top-collapsed");
				},
				toggleMovesOverlay(ev, target) {
					target.closest(".stonetop-sheet-layout")?.classList.toggle("moves-open");
				},
				async openBasicMove(ev, target) {
					// Once a move opens, dismiss the overlay so it doesn't cover the move sheet.
					target.closest(".stonetop-sheet-layout")?.classList.remove("moves-open");
					const { compendiumId } = target.dataset;
					if (!compendiumId) return;
					const pack = game.packs.get("stonetop.moves");
					const doc  = (pack ? await pack.getDocument(compendiumId) : null)
						?? game.items?.get(compendiumId)
						?? null;
					if (doc) doc.sheet.render(true);
				},
				toggleFollowerInventory(ev, target) {
					// Server-side expand/collapse: only the open follower renders the (large)
					// outfit catalog, and the open state survives update-triggered re-renders.
					this._openFollowerInventories ??= new Set();
					const slug = target.dataset.slug;
					if (this._openFollowerInventories.has(slug)) this._openFollowerInventories.delete(slug);
					else this._openFollowerInventories.add(slug);
					this.render();
				},

				// --- one-call domain actions ---
				selectOriginName(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.origin.selectName(target.textContent.trim());
				},
				flipArcanum(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.toggleArcanumFlip(
						target.dataset.slug, target.dataset.flipped === "true");
				},
				removeInsert(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.removeInsert(target.dataset.insertItemId);
				},
				addFollower() {
					if (!this.isEditable) return;
					return this._stonetopCharacter.addCustomFollower();
				},
				addFollowerMember(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.addFollowerMember(target.dataset.slug);
				},
				removeFollowerMember(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.removeFollowerMember(
						target.dataset.slug, Number(target.dataset.index));
				},
				toggleTag(ev, target) {
					if (!this.isEditable) return;
					return this._toggleTagFromWrap(target.closest(".stonetop-tags"), target.dataset.tag);
				},
				addInventoryItem(ev, target) {
					if (!this.isEditable) return;
					return this._onAddInventoryItem(target);
				},

				// --- resource pips (current checked state → the domain does the ±1 math) ---
				moveResourcePip(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.toggleMoveResourcePip(
						target.dataset.moveSlug, target.dataset.index, target.classList.contains("is-checked"));
				},
				possessionUsePip(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.togglePossessionUsePip(
						target.dataset.possessionSlug, target.dataset.choiceSlug ?? null,
						target.dataset.index, target.classList.contains("is-checked"));
				},
				inventoryResourcePip(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.toggleInventoryResourcePipFor(
						this._followerInvSlug(target), target.dataset.slug,
						target.dataset.index, target.classList.contains("is-checked"));
				},
				arcanumResourcePip(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.toggleArcanumResourcePip(
						target.dataset.slug, target.dataset.index, target.classList.contains("is-checked"));
				},
				backgroundResourcePip(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.toggleBackgroundResourcePip(
						target.dataset.slug, target.dataset.index, target.classList.contains("is-checked"));
				},
				followerLoyaltyPip(ev, target) {
					if (!this.isEditable) return;
					return this._stonetopCharacter.toggleFollowerLoyaltyPip(
						target.dataset.slug, target.dataset.index, target.classList.contains("is-checked"));
				},

				// --- deletes: click confirms, right-click skips the confirm (core dispatches
				//     contextmenu through the same actions pipeline via buttons: [0, 2]) ---
				deleteArcanum: { buttons: [0, 2], async handler(ev, target) {
					if (!(await this._confirmedDelete(ev, target))) return;
					await this._stonetopCharacter.removeArcanum(target.dataset.slug);
				} },
				deletePossession: { buttons: [0, 2], async handler(ev, target) {
					if (!(await this._confirmedDelete(ev, target))) return;
					await this._stonetopCharacter.deletePossession(target.dataset.slug);
				} },
				deleteFollower: { buttons: [0, 2], async handler(ev, target) {
					if (!(await this._confirmedDelete(ev, target))) return;
					await this._stonetopCharacter.removeFollower(target.dataset.slug);
				} },
				deleteOtherMove: { buttons: [0, 2], async handler(ev, target) {
					if (!(await this._confirmedDelete(ev, target))) return;
					await this._stonetopCharacter.deleteMove(target.dataset.moveSlug);
				} },
				deleteInventoryItem: { buttons: [0, 2], async handler(ev, target) {
					if (!(await this._confirmedDelete(ev, target))) return;
					await this._stonetopCharacter.removeCustomInventoryItemFor(
						this._followerInvSlug(target), target.dataset.ownedId);
				} },
			},
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/actor/character.hbs",
				// The V1 sheet preserved exactly these two scroll containers across re-renders.
				scrollable: [".sheet-body", ".stonetop-moves-sidebar"],
			},
		};

		// Core tab machinery: tabGroups seeds from `initial`, nav anchors carry data-action="tab",
		// context.tabs comes out of super._prepareContext via _prepareTabs.
		static TABS = {
			primary: {
				tabs: [
					{ id: "playbook" }, { id: "moves" }, { id: "inventory" },
					{ id: "arcana" }, { id: "followers" }, { id: "notes" },
				],
				initial: "playbook",
				labelPrefix: "stonetop.sheet.tabs",
			},
		};

		// The fixed tabs plus one tab per owned insert item — static TABS can't express those, but
		// core's _prepareTabs routes through this hook, so the dynamic tabs ride the core pipeline.
		_getTabsConfig(group) {
			const config = super._getTabsConfig(group);
			if (group !== "primary" || !config) return config;
			const insertTabs = [...this.actor.items]
				.filter(i => i.type === "insert" && i.system?.slug)
				.map(i => ({ id: `insert-${i.system.slug}`, label: i.name }));
			return { ...config, tabs: [...config.tabs, ...insertTabs] };
		}

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			context.actor    = this.actor;
			context.editable = this.isEditable;
			// Which follower inventory catalogs are expanded — sheet-instance state that survives
			// re-render, so only the open follower renders the (large) outfit catalog.
			this._openFollowerInventories ??= new Set();
			this._stonetopCharacter.setOpenFollowerInventories(this._openFollowerInventories);
			context.stonetop = await this._stonetopCharacter.buildSnapshot();
			// Single rich-text pass: enrich every RichText in the snapshot in one go.
			await enrichRichTextTree(context.stonetop, this.actor?.getRollData?.() ?? {});
			context.availablePlaybooks = await this._playbookRepository.getAllPlaybooks();
			return context;
		}

		// Root-delegated, one-time wiring — the V2 root persists across re-renders. Editability is
		// gated per event inside the router, not at wiring time.
		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			this._buildChangeRouter().attach(this.element);
		}

		// Per-element DOM decoration re-runs every render (the part content was just replaced):
		// seed the arcanum write-in blanks from storage (the @Blank enricher renders them empty).
		_onRender(context, options) {
			super._onRender(context, options);
			for (const card of this.element.querySelectorAll(".stonetop-arcanum-card")) {
				const blanks = this._stonetopCharacter.getArcanumBlanks(card.dataset.slug);
				for (const input of card.querySelectorAll("input.stonetop-arcanum-blank"))
					input.value = blanks[input.dataset.blankKey] ?? "";
			}
		}

		// Every change action writes to the actor, so each handler is wrapped in a per-event
		// editability gate (a sheet can gain or lose ownership mid-session).
		_buildChangeRouter() {
			const char = this._stonetopCharacter;
			const handlers = {
				// vitals + header
				hp:       el => char.setHP(el.value),
				maxHp:    el => char.setMaxHP(el.value),
				damage:   el => char.setDamage(el.value),
				armor:    el => char.setArmor(el.value),
				xp:       el => char.setXP(el.value),
				level:    el => char.setLevel(el.value),
				debility: el => char.setDebility(el.dataset.slug, el.checked),
				rollMode: el => char.setRollMode(el.value),

				// playbook tab
				selectPlaybook:   el => char.applyPlaybookBySlug(el.value),
				selectBackground: el => char.selectBackground(el.value),
				selectOrigin:     el => char.origin.select(el.value),
				instinctCustom:   el => char.selectCustomInstinct(el.value.trim()),

				// choice groups (shared partial rows; the ChoiceTarget owns the container routing)
				cgTrack: el => char.setChoiceTrackFor(ChoiceTarget.fromElement(el), el.dataset.cgIndex, el.checked),
				cgPick:  el => {
					this._syncInstinctBox(el);
					return char.setChoicePickFor(ChoiceTarget.fromElement(el), el.checked);
				},
				cgText:        el => char.setChoiceTextFor(ChoiceTarget.fromElement(el), el.value),
				followerCheck: el => char.setChoiceTrackFor(ChoiceTarget.fromFollowerCheck(el), el.dataset.index, el.checked),
				arcanumBlank:  el => {
					const card = el.closest(".stonetop-arcanum-card");
					if (card) return char.setArcanumBlank(card.dataset.slug, el.dataset.blankKey, el.value);
				},

				// moves
				moveCheck:        el => char.setMoveChecked(el.dataset.categoryKey, el.dataset.moveSlug, el.checked),
				moveResourceText: el => char.setMoveResourceText(el.dataset.moveSlug, el.value),

				// inventory (shared with follower inventories — the wrapper slug routes)
				inventoryItemCheck: el => char.setInventoryItemCheckedFor(this._followerInvSlug(el), el.dataset.slug, el.checked),
				outfitLoad:         el => char.setInventoryLoadLevel(el.value),
				regularPool:        el => char.toggleInventoryRegularPool(el.dataset.index, el.checked),
				smallPool:          el => char.toggleInventorySmallPool(el.dataset.index, el.checked),
				inventoryOtherItems: el => char.setInventoryOtherItems(el.value),

				// possessions
				possessionCheck:    el => char.setPossessionSelected(el.dataset.slug, el.checked),
				possessionSubCheck: el => char.setSubChoiceSelected(el.dataset.possessionSlug, el.dataset.choiceSlug, el.checked),
				possessionSubRadio: el => char.selectSubChoiceExclusive(
					el.dataset.possessionSlug, el.dataset.choiceSlug,
					el.dataset.siblingSlugsCsv ? el.dataset.siblingSlugsCsv.split(",") : []),

				// notes
				bio:       el => char.setBio(el.value),
				charNotes: el => char.setNotes(el.value),

				// followers
				followerName:    el => char.setFollowerName(el.dataset.slug, el.value),
				followerHp:      el => char.setFollowerHp(el.dataset.slug, el.value,
					el.closest(".stonetop-follower-card")?.querySelector(".stonetop-follower-hp-max")?.value ?? el.max),
				followerHpMax:   el => char.setFollowerHpMax(el.dataset.slug, Number(el.value)),
				followerArmor:   el => char.setFollowerArmor(el.dataset.slug, el.value.trim()),
				followerDamage:  el => char.setFollowerDamage(el.dataset.slug, el.value.trim()),
				followerInstinct: el => char.setFollowerInstinct(el.dataset.slug, el.value.trim()),
				companionType:   el => char.setFollowerCompanionType(el.dataset.slug, el.value.trim()),
				followerMoves:   el => char.setFollowerMoves(el.dataset.slug, el.value),
				followerCost:    el => char.setFollowerCost(el.dataset.slug, el.value.trim()),
				followerNotes:   el => char.setFollowerNotes(el.dataset.slug, el.value),
				followerSpecialQuality: el => char.setFollowerSpecialQuality(el.dataset.slug, el.value),
				followerDescription:    el => char.setFollowerDescription(el.dataset.slug, el.value),
				memberName:  el => char.setFollowerMemberName(el.dataset.slug, Number(el.dataset.index), el.value),
				memberHp:    el => char.setFollowerMemberHp(el.dataset.slug, Number(el.dataset.index), el.value),
				memberHpMax: el => char.setFollowerMemberHpMax(el.dataset.slug, Number(el.dataset.index), el.value),
				tagAdd: el => {
					const value = takeTagInputValue(el);
					if (value) return this._toggleTagFromWrap(el.closest(".stonetop-tags"), value);
				},
			};
			return new ChangeActionRouter(Object.fromEntries(
				Object.entries(handlers).map(([name, fn]) =>
					[name, (el, ev) => { if (this.isEditable) return fn(el, ev); }]),
			));
		}

		// The picked option's label mirrors into the custom-instinct box immediately (the
		// re-render refreshes it authoritatively afterwards) — pure view sync.
		_syncInstinctBox(el) {
			const label = el.dataset.displayLabel ?? "";
			const insertEl = el.closest("[data-insert-item-id]");
			if (insertEl) {
				const box = insertEl.querySelector(".stonetop-instinct-custom");
				if (box) box.value = label;
			} else if (el.dataset.cgContext === "instinct") {
				for (const box of this.element.querySelectorAll(".stonetop-instinct-custom")) box.value = label;
			}
		}

		// Tag chips/adders on a follower card, group member, or companion — the wrap's dataset
		// says which; StonetopCharacter owns the routing.
		_toggleTagFromWrap(wrap, value) {
			if (!wrap || !value) return;
			const { slug, field, memberIndex } = wrap.dataset;
			return this._stonetopCharacter.toggleFollowerTag(slug, field, memberIndex ?? null, value);
		}

		// A shared outfit item lives in the character inventory tab OR inside a follower card's
		// `.stonetop-follower-inventory` wrapper — the wrapper's data-slug routes to the follower path.
		_followerInvSlug(el) {
			return el.closest?.(".stonetop-follower-inventory")?.dataset.slug ?? null;
		}

		// Right-click skips the confirm (and suppresses the browser menu); left-click confirms.
		async _confirmedDelete(ev, target) {
			if (!this.isEditable) return false;
			ev.preventDefault();
			if (ev.type === "contextmenu" || ev.button === 2) return true;
			return confirmDelete(target.dataset.name);
		}

		// Core ActorSheetV2 ships the whole drop pipeline (never wire `drop` manually here) —
		// same-sheet drops keep core's sort behavior, everything else routes through the typed
		// character (playbooks replace, followers/moves absorb, owned arcana skip, rest embeds).
		async _onDropItem(event, item) {
			if (!this.isEditable) return null;
			if (this.actor.uuid === item.parent?.uuid) return super._onDropItem(event, item);
			await this._stonetopCharacter.applyDroppedItems([item.toObject()]);
			return null;
		}

		// A dropped NPC becomes a follower.
		async _onDropActor(event, actor) {
			if (!this.isEditable || actor?.type !== "npc") return null;
			await this._stonetopCharacter.addFollowerFromActor(actor);
			return null;
		}

		async _onAddInventoryItem(target) {
			const isRegular = target.dataset.column === "regular";
			const followerSlug = this._followerInvSlug(target);
			const content = await foundry.applications.handlebars.renderTemplate(
				ADD_ITEM_DIALOG_TEMPLATE, { isRegular });
			const result = await foundry.applications.api.DialogV2.prompt({
				window: {
					title: game.i18n.localize(isRegular ? "stonetop.inventory.addItem" : "stonetop.inventory.addSmallItem"),
				},
				content,
				ok: {
					label: game.i18n.localize("stonetop.inventory.addItemConfirm"),
					callback: (_event, button) => ({
						name:   button.form.elements.name.value.trim(),
						weight: isRegular ? (parseInt(button.form.elements.weight?.value) || 1) : 1,
					}),
				},
				rejectClose: false,
			});
			if (!result?.name) return; // dismissed or blank
			await this._stonetopCharacter.addCustomInventoryItemFor(
				followerSlug, result.name, result.weight, isRegular);
		}
	};
}
