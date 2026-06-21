import {PossessionUseButton} from "./elements/possession-use-button.js";
import { FoundryPlaybookRepository } from "./repositories/FoundryPlaybookRepository.js";

export function createStonetopCharacterSheetClass(Base) {
	return class StonetopCharacterSheet extends Base {
		_stonetopCharacter;
		_playbookRepository = new FoundryPlaybookRepository();

		constructor(...args) {
			super(...args);
			this._stonetopCharacter = this.actor.typedActor;
		}

		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["pbta", "stonetop", "sheet", "actor", "character"],
				tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "playbook" }],
				dragDrop: [{ dragSelector: ".items-list .item" }],
			});
		}

		get template() {
			return "systems/stonetop/templates/actor/character.hbs";
		}

		async getData() {
			const context = await super.getData();
			// Which follower inventory catalogs are expanded — sheet-instance state that survives
			// re-render, so only the open follower renders the (large) outfit catalog.
			this._openFollowerInventories ??= new Set();
			this._stonetopCharacter.setOpenFollowerInventories(this._openFollowerInventories);
			context.stonetop = await this._stonetopCharacter.buildSnapshot();
			context.availablePlaybooks = await this._playbookRepository.getAllPlaybooks();
			return context;
		}

		activateListeners(html) {
			super.activateListeners(html);
			html[0].addEventListener("dragover", (ev) => ev.preventDefault());
			html[0].addEventListener("drop", (ev) => {
				ev.stopImmediatePropagation();
				const data = TextEditor.getDragEventData(ev);
				if (data?.type === "Item")  this._onDropItem(ev, data);
				if (data?.type === "Actor") this._onDropActor(ev, data);
			}, true);
			if (!this.isEditable) return;

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-hp");
				if (!input) return;
				this._stonetopCharacter.setHP(input.value);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-max-hp");
				if (!input) return;
				this._stonetopCharacter.setMaxHP(input.value);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-damage");
				if (!input) return;
				this._stonetopCharacter.setDamage(input.value);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-armor");
				if (!input) return;
				this._stonetopCharacter.setArmor(input.value);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-xp");
				if (!input) return;
				this._stonetopCharacter.setXP(input.value);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-level");
				if (!input) return;
				this._stonetopCharacter.setLevel(input.value);
			}, true);

			html.find("[name=stonetop-roll-mode]").on("change", ev => {
				this._stonetopCharacter.setRollMode(ev.currentTarget.value);
			});

			html[0].addEventListener("change", ev => {
				const el = ev.target.closest(".stonetop-debility-check");
				if (!el) return;
				ev.stopImmediatePropagation();
				ev.stopPropagation();
				this._stonetopCharacter.setDebility(el.dataset.slug, el.checked);
			}, true);
			html.find(".stonetop-playbook-select").on("change", this._onSelectPlaybook.bind(this));
			html.find("[name=stonetop-background]").on("change", this._onBackgroundChange.bind(this));
			html.find(".stonetop-instinct-custom").on("change", ev =>
				this._stonetopCharacter.instinct.selectCustom(ev.currentTarget.value.trim())
			);
			html.find("[name=stonetop-origin]").on("change", ev =>
				this._stonetopCharacter.origin.select(ev.currentTarget.value)
			);
			html.find(".stonetop-origin-name").on("click", this._onOriginNameClick.bind(this));
			html.find(".stonetop-move-check, .stonetop-repeat-check").on("change", this._onMoveCheck.bind(this));
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-item-resource-check");
				if (!btn) return;
				ev.stopPropagation();
				ev.stopImmediatePropagation();
				if (btn.dataset.moveSlug !== undefined) {
					this._onMoveResourceChange({ currentTarget: btn });
				} else {
					this._onPossessionUseChange({ currentTarget: btn });
				}
			}, true);
			html.find(".stonetop-inventory-item-check").on("change", this._onInventoryItemCheck.bind(this));
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-inventory-resource-btn");
				if (!btn) return;
				this._onInventoryResource({ currentTarget: btn });
			}, true);
			html.find(".stonetop-inv-add-btn").on("click", this._onAddInventoryItem.bind(this));
			html.find(".stonetop-inv-delete").on("click", this._onDeleteCustomInventoryItem.bind(this));
			html.find(".stonetop-outfit-load-radio").on("change", this._onOutfitLoad.bind(this));
			html.find(".stonetop-possession-check").on("change", this._onPossessionCheck.bind(this));
			html.find(".stonetop-possession-delete").on("click", this._onDeletePossession.bind(this));
			html.find(".stonetop-possession-sub-check").on("change", this._onPossessionSubCheck.bind(this));
			html.find(".stonetop-possession-sub-radio").on("change", this._onPossessionSubRadio.bind(this));
			html.find(".stonetop-regular-pool-btn").on("change", this._onRegularPool.bind(this));
			html.find(".stonetop-small-pool-btn").on("change", this._onSmallPool.bind(this));
			html.find(".stonetop-notes").on("change", async ev => {
				await this._stonetopCharacter.setInventoryOtherItems(ev.currentTarget.value);
			});
			html.find(".stonetop-char-bio").on("change", async ev => {
				await this._stonetopCharacter.setBio(ev.currentTarget.value);
			});
			html.find(".stonetop-char-notes").on("change", async ev => {
				await this._stonetopCharacter.setNotes(ev.currentTarget.value);
			});
			// Narrow-layout moves sidebar: toggle the slide-over overlay.
			html.find(".stonetop-moves-toggle").on("click", ev => {
				ev.currentTarget.closest(".stonetop-sheet-layout")?.classList.toggle("moves-open");
			});
			// Collapse the header + stats/portrait so the tabbed content fills the sheet.
			html.find(".stonetop-top-toggle").on("click", ev => {
				ev.currentTarget.closest(".sheet-wrapper")?.classList.toggle("top-collapsed");
			});
			html.find(".stonetop-basic-move-open").on("click", async ev => {
				const { compendiumId } = ev.currentTarget.dataset;
				// Once a move opens, dismiss the overlay so it doesn't cover the move sheet.
				ev.currentTarget.closest(".stonetop-sheet-layout")?.classList.remove("moves-open");
				if (!compendiumId) return;
				const pack = game.packs.get("stonetop.moves");
				const doc  = (pack ? await pack.getDocument(compendiumId) : null)
					?? game.items?.get(compendiumId)
					?? null;
				if (doc) doc.sheet.render(true);
			});
			html.find(".stonetop-other-move-delete").on("click", async ev => {
				const { moveSlug } = ev.currentTarget.dataset;
				await this._stonetopCharacter.deleteMove(moveSlug);
			});

			html[0].addEventListener("click", async ev => {
				const btn = ev.target.closest(".stonetop-arcanum-flip-btn");
				if (!btn) return;
				ev.stopPropagation();
				const { slug, flipped } = btn.dataset;
				if (flipped === "true") {
					await this._stonetopCharacter.unflipArcanum(slug);
				} else {
					await this._stonetopCharacter.flipArcanum(slug);
				}
			}, true);

			html[0].addEventListener("click", async ev => {
				const btn = ev.target.closest(".stonetop-arcanum-resource-btn");
				if (!btn) return;
				ev.stopPropagation();
				const { slug, index } = btn.dataset;
				const isChecked = btn.classList.contains("is-checked");
				const newVal = isChecked ? Number(index) : Number(index) + 1;
				await this._stonetopCharacter.setArcanumResource(slug, newVal);
			}, true);

			html[0].addEventListener("click", async ev => {
				const btn = ev.target.closest(".stonetop-background-resource-btn");
				if (!btn) return;
				ev.stopPropagation();
				const { slug, index } = btn.dataset;
				const isChecked = btn.classList.contains("is-checked");
				const newVal = isChecked ? Number(index) : Number(index) + 1;
				await this._stonetopCharacter.setBackgroundResource(slug, newVal);
			}, true);

			html[0].addEventListener("click", async ev => {
				const btn = ev.target.closest(".stonetop-arcanum-delete");
				if (!btn) return;
				ev.stopPropagation();
				const { slug } = btn.dataset;
				await this._stonetopCharacter.removeArcanum(slug);
			}, true);

			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-cg-track");
				if (!el) return;
				const { cgContext, cgGroup, cgOption, cgIndex } = el.dataset;
				const count = el.checked ? Number(cgIndex) + 1 : Number(cgIndex);
				const possEl = el.closest("[data-possession-slug]");
				if (possEl) {
					await this._stonetopCharacter.setPossessionChoiceValue(
						possEl.dataset.possessionSlug, cgOption, count);
					return;
				}
				const insertEl = el.closest("[data-insert-item-id]");
				if (insertEl) {
					await this._stonetopCharacter.setInsertChoiceCount(
						insertEl.dataset.insertItemId, cgGroup, cgOption, count);
					return;
				}
				this._stonetopCharacter.setChoiceCount(cgContext, cgGroup, cgOption, count);
			}, true);

			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-cg-pick");
				if (!el?.dataset.cgContext) return;
				const { cgContext, cgGroup, cgOption, cgSiblings, displayLabel } = el.dataset;
				const insertEl = el.closest("[data-insert-item-id]");
				if (insertEl) {
					insertEl.querySelector(".stonetop-instinct-custom").value = displayLabel ?? "";
					await this._stonetopCharacter.setInsertChoicePick(
						insertEl.dataset.insertItemId, cgGroup, cgOption, cgSiblings ?? null);
					return;
				}
				if (cgContext === "instinct") {
					html.find(".stonetop-instinct-custom").val(displayLabel ?? "");
				}
				this._stonetopCharacter.setChoicePick(cgContext, cgGroup, cgOption, cgSiblings ?? null, el.checked);
			}, true);

			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-cg-text");
				if (!el) return;
				const possEl = el.closest("[data-possession-slug]");
				if (possEl) {
					await this._stonetopCharacter.setPossessionChoiceValue(
						possEl.dataset.possessionSlug, el.dataset.cgOption, el.value);
					return;
				}
				if (!el.dataset.cgContext) return;
				const { cgContext, cgGroup, cgOption } = el.dataset;
				const insertEl = el.closest("[data-insert-item-id]");
				if (insertEl) {
					await this._stonetopCharacter.setInsertChoiceText(
						insertEl.dataset.insertItemId, cgGroup, cgOption, el.value);
					return;
				}
				this._stonetopCharacter.setChoiceText(cgContext, cgGroup, cgOption, el.value);
			}, true);

			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-arcanum-follower-check");
				if (!el) return;
				const { cgContext, slug: groupSlug, option: optionSlug, index } = el.dataset;
				const count = el.checked ? Number(index) + 1 : Number(index);
				if (cgContext === "arcana-back") {
					await this._stonetopCharacter.setArcanumBackChoiceValue(groupSlug, optionSlug, count);
				} else if (cgContext === "background") {
					await this._stonetopCharacter.setChoiceCount(cgContext, groupSlug, optionSlug, count);
				}
			}, true);

			html[0].addEventListener("click", async ev => {
				const btn = ev.target.closest(".stonetop-insert-remove");
				if (!btn) return;
				ev.stopPropagation();
				await this._stonetopCharacter.removeInsert(btn.dataset.insertItemId);
			}, true);

			html[0].addEventListener("click", async ev => {
				const btn = ev.target.closest(".stonetop-follower-add");
				if (!btn) return;
				await this._stonetopCharacter.addCustomFollower();
			}, true);

			html[0].addEventListener("click", async ev => {
				const btn = ev.target.closest(".stonetop-follower-delete");
				if (!btn) return;
				ev.stopPropagation();
				await this._stonetopCharacter.removeFollower(btn.dataset.slug);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-hp");
				if (!input) return;
				const card = ev.target.closest(".stonetop-follower-card");
				const hpMax = Number(card?.querySelector(".stonetop-follower-hp-max")?.value ?? input.max);
				const hp = Math.max(0, Math.min(Number(input.value), hpMax));
				this._stonetopCharacter.setFollowerHp(input.dataset.slug, hp);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-hp-max");
				if (!input) return;
				this._stonetopCharacter.setFollowerHpMax(input.dataset.slug, Number(input.value));
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-name-input");
				if (!input) return;
				this._stonetopCharacter.setFollowerName(input.dataset.slug, input.value);
			}, true);

			html[0].addEventListener("click", ev => {
				const chip = ev.target.closest(".stonetop-tag-chip");
				if (!chip) return;
				const wrap = chip.closest(".stonetop-tags");
				this._toggleTag(wrap, chip.dataset.tag);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-tag-add");
				if (!input?.value.trim()) return;
				this._toggleTag(input.closest(".stonetop-tags"), input.value.trim());
				input.value = "";
			}, true);

			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-follower-loyalty-btn");
				if (!btn) return;
				ev.stopPropagation();
				const { slug, index } = btn.dataset;
				const isChecked = btn.classList.contains("is-checked");
				const newVal = isChecked ? Number(index) : Number(index) + 1;
				this._stonetopCharacter.setFollowerLoyalty(slug, newVal);
			}, true);


			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-armor");
				if (!input) return;
				this._stonetopCharacter.setFollowerArmor(input.dataset.slug, input.value.trim());
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-damage");
				if (!input) return;
				this._stonetopCharacter.setFollowerDamage(input.dataset.slug, input.value.trim());
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-instinct");
				if (!input) return;
				this._stonetopCharacter.setFollowerInstinct(input.dataset.slug, input.value.trim());
			}, true);

			// Expand/collapse a follower's inventory catalog. Server-side toggle (re-render) so only
			// the open follower carries the full outfit list, and the open state survives the
			// re-render that checking an item triggers.
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-follower-inv-toggle");
				if (!btn) return;
				ev.preventDefault();
				const slug = btn.dataset.slug;
				this._openFollowerInventories ??= new Set();
				if (this._openFollowerInventories.has(slug)) this._openFollowerInventories.delete(slug);
				else this._openFollowerInventories.add(slug);
				this.render(false);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-companion-type");
				if (!input) return;
				this._stonetopCharacter.setFollowerCompanionType(input.dataset.slug, input.value.trim());
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-moves");
				if (!input) return;
				this._stonetopCharacter.setFollowerMoves(input.dataset.slug, input.value);
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-cost");
				if (!input) return;
				this._stonetopCharacter.setFollowerCost(input.dataset.slug, input.value.trim());
			}, true);

			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-follower-notes");
				if (!input) return;
				this._stonetopCharacter.setFollowerNotes(input.dataset.slug, input.value);
			}, true);

			// Group members (per-member name + HP, add/remove)
			html[0].addEventListener("change", ev => {
				const name = ev.target.closest(".stonetop-member-name");
				if (name) return void this._stonetopCharacter.setFollowerMemberName(name.dataset.slug, Number(name.dataset.index), name.value);
				const hp = ev.target.closest(".stonetop-member-hp-value");
				if (hp) return void this._stonetopCharacter.setFollowerMemberHp(hp.dataset.slug, Number(hp.dataset.index), hp.value);
				const max = ev.target.closest(".stonetop-member-hp-max");
				if (max) return void this._stonetopCharacter.setFollowerMemberHpMax(max.dataset.slug, Number(max.dataset.index), max.value);
			}, true);

			html[0].addEventListener("click", ev => {
				const add = ev.target.closest(".stonetop-member-add");
				if (add) return void this._stonetopCharacter.addFollowerMember(add.dataset.slug);
				const remove = ev.target.closest(".stonetop-member-remove");
				if (remove) return void this._stonetopCharacter.removeFollowerMember(remove.dataset.slug, Number(remove.dataset.index));
			}, true);
		}

		// Toggle a tag/trait on a follower, or on one of its group members when the chip wrap
		// carries data-member-index. Shared by the chip-click and add-dropdown handlers.
		_toggleTag(wrap, value) {
			if (!wrap || !value) return;
			const { slug, field, memberIndex } = wrap.dataset;
			if (memberIndex !== undefined) {
				this._stonetopCharacter.toggleFollowerMemberSelection(slug, Number(memberIndex), field, value);
			} else if (field === "companionOptions") {
				// companion options live nested in the atomic `companion` object, not a top-level field
				this._stonetopCharacter.toggleFollowerCompanionOption(slug, value);
			} else {
				this._stonetopCharacter.toggleFollowerSelection(slug, field, value);
			}
		}

		async _onDropActor(ev, data) {
			const actor = await fromUuid(data.uuid);
			if (!actor || actor.type !== "npc") return;
			await this._stonetopCharacter.addFollowerFromActor(actor);
		}

		async _onDropItemCreate(itemData) {
			const items = Array.isArray(itemData) ? itemData : [itemData];
			// Arcana: let Foundry embed natively with correct system data; skip already-owned
			const ownedArcanaSlugs = this._stonetopCharacter.ownedArcanaSlugs;
			const newArcana = items.filter(
				i => i.type === "arcanum" && !ownedArcanaSlugs.has(i.system?.slug),
			);
			const nonArcana = items.filter(i => i.type !== "arcanum");
			const { others } = await this._stonetopCharacter.onDropItems(nonArcana);
			const toEmbed = [...newArcana, ...others];
			if (toEmbed.length) await super._onDropItemCreate(toEmbed);
		}

		async _onSelectPlaybook(ev) {
			const slug = ev.currentTarget.value;
			if (!slug) return;
			const pack = game.packs.get("stonetop.playbooks");
			if (pack) {
				const entry = pack.index.find(e => e.system?.slug === slug);
				if (entry) {
					const doc = await pack.getDocument(entry._id);
					if (doc) { await this._onDropItemCreate([doc.toObject()]); return; }
				}
			}
			const worldDoc = (game.items?.contents ?? [])
				.find(i => i.type === "playbook" && i.system?.slug === slug);
			if (worldDoc) await this._onDropItemCreate([worldDoc.toObject()]);
		}

		async _onBackgroundChange(ev) {
			await this._stonetopCharacter.selectBackground(ev.currentTarget.value);
		}

		async _onOriginNameClick(ev) {
			await this._stonetopCharacter.origin.selectName(ev.currentTarget.textContent.trim());
		}

		async _onMoveCheck(ev) {
			const el = ev.currentTarget;
			const { categoryKey, moveSlug } = el.dataset;
			if (el.checked) {
				await this._stonetopCharacter.incrementMove(categoryKey, moveSlug);
			} else {
				await this._stonetopCharacter.decrementMove(categoryKey, moveSlug);
			}
		}

		async _onMoveResourceChange(ev) {
			const { moveSlug, index } = ev.currentTarget.dataset;
			const isChecked = ev.currentTarget.classList.contains("is-checked");
			const current = isChecked ? Number(index) : Number(index) + 1;
			await this._stonetopCharacter.setMoveResourceCurrent(moveSlug, current);
		}

		async _onPossessionCheck(ev) {
			const { slug } = ev.currentTarget.dataset;
			if (ev.currentTarget.checked) {
				await this._stonetopCharacter.selectPossession(slug);
			} else {
				await this._stonetopCharacter.deselectPossession(slug);
			}
		}

		async _onDeletePossession(ev) {
			await this._stonetopCharacter.deletePossession(ev.currentTarget.dataset.slug);
		}

		async _onPossessionUseChange(ev) {
			const btn = new PossessionUseButton(ev);
			const newVal = btn.isChecked() ? btn.index : btn.index + 1;
			if (btn.choiceSlug) {
				await this._stonetopCharacter.setSubChoiceUses(btn.possessionSlug, btn.choiceSlug, newVal);
			} else {
				await this._stonetopCharacter.setPossessionUses(btn.possessionSlug, newVal);
			}
		}

		async _onPossessionSubCheck(ev) {
			const { possessionSlug, choiceSlug } = ev.currentTarget.dataset;
			if (ev.currentTarget.checked) {
				await this._stonetopCharacter.selectSubChoice(possessionSlug, choiceSlug);
			} else {
				await this._stonetopCharacter.deselectSubChoice(possessionSlug, choiceSlug);
			}
		}

		async _onPossessionSubRadio(ev) {
			const { possessionSlug, choiceSlug, siblingSlugsCsv } = ev.currentTarget.dataset;
			const exclusiveSlugs = siblingSlugsCsv ? siblingSlugsCsv.split(",") : [];
			await this._stonetopCharacter.selectSubChoiceExclusive(possessionSlug, choiceSlug, exclusiveSlugs);
		}

		// A shared outfit item lives in the character inventory tab OR inside a follower card's
		// `.stonetop-follower-inventory` wrapper — the wrapper's data-slug routes to the follower path.
		_followerInvSlug(el) {
			return el.closest?.(".stonetop-follower-inventory")?.dataset.slug ?? null;
		}

		async _onInventoryItemCheck(ev) {
			const el = ev.currentTarget;
			const fSlug = this._followerInvSlug(el);
			if (fSlug) return this._stonetopCharacter.setFollowerInvItemChecked(fSlug, el.dataset.slug, el.checked);
			await this._stonetopCharacter.setInventoryItemChecked(el.dataset.slug, el.checked);
		}

		async _onInventoryResource(ev) {
			const el = ev.currentTarget;
			const { slug, index } = el.dataset;
			const isChecked = el.classList.contains("is-checked");
			const newVal = isChecked ? Number(index) : Number(index) + 1;
			const fSlug = this._followerInvSlug(el);
			if (fSlug) return this._stonetopCharacter.setFollowerInvResource(fSlug, slug, newVal);
			await this._stonetopCharacter.setInventoryResource(slug, newVal);
		}

		async _onAddInventoryItem(ev) {
			const column = ev.currentTarget.dataset.column;
			const isRegular = column === "regular";
			const fSlug = this._followerInvSlug(ev.currentTarget);
			const content = isRegular
				? `<div style="display:grid;gap:6px;padding:6px">
					<label>${game.i18n.localize("stonetop.inventory.addItemName")} <input name="name" type="text" style="width:100%"></label>
					<label>${game.i18n.localize("stonetop.inventory.addItemWeight")} <input name="weight" type="number" min="1" value="1" style="width:60px"></label>
				   </div>`
				: `<div style="padding:6px"><label>${game.i18n.localize("stonetop.inventory.addItemName")} <input name="name" type="text" style="width:100%"></label></div>`;
			new Dialog({
				title: isRegular ? game.i18n.localize("stonetop.inventory.addItem") : game.i18n.localize("stonetop.inventory.addSmallItem"),
				content,
				buttons: {
					add: {
						label: game.i18n.localize("stonetop.inventory.addItemConfirm"),
						callback: html => {
							const name = html.find("[name=name]").val().trim();
							if (!name) return;
							const weight = isRegular ? (parseInt(html.find("[name=weight]").val()) || 1) : 1;
							if (fSlug) {
								this._stonetopCharacter.addFollowerInvCustomItem(fSlug, name, weight);
							} else if (isRegular) {
								this._stonetopCharacter.addCustomInventoryItem(name, weight);
							} else {
								this._stonetopCharacter.addCustomSmallItem(name);
							}
						},
					},
					cancel: { label: game.i18n.localize("Cancel") },
				},
				default: "add",
			}).render(true);
		}

		async _onOutfitLoad(ev) {
			await this._stonetopCharacter.setInventoryLoadLevel(ev.currentTarget.value);
		}

		async _onRegularPool(ev) {
			const idx = Number(ev.currentTarget.dataset.index);
			await this._stonetopCharacter.setInventoryRegularPool(
				ev.currentTarget.checked ? idx + 1 : idx
			);
		}

		async _onSmallPool(ev) {
			const idx = Number(ev.currentTarget.dataset.index);
			await this._stonetopCharacter.setInventorySmallPool(
				ev.currentTarget.checked ? idx + 1 : idx
			);
		}

		async _onDeleteCustomInventoryItem(ev) {
			const el = ev.currentTarget;
			const fSlug = this._followerInvSlug(el);
			if (fSlug) return this._stonetopCharacter.removeFollowerInvCustomItem(fSlug, el.dataset.ownedId);
			await this._stonetopCharacter.removeCustomInventoryItem(el.dataset.ownedId);
		}
	};
}

