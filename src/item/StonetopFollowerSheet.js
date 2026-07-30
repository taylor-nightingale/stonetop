// Item sheet for authoring `npc` (follower) items — full parity with the creature + follower schema
// (creature.js). Modeled on StonetopArcanumSheet: a rendered card VIEW (with an Edit button) ⇄ a data
// EDITOR with a live preview pane. Fully featured: the creature core, the three Selection fields
// (tagList/instinct/cost), the `choices` group (Crew-style — reuses the shared choice-group editor),
// group `members`, and the animal-`companion` catalog.
//
// The rendered card + live preview use the SAME buildFollowerSnapshot + follower-card.hbs the
// character sheet uses (one render path). The V2 form's submitOnChange auto-saves `name` + scalar
// `name="system.*"` inputs; everything with a bespoke shape (Selection round-trips, whole-array
// members, whole-object companion) saves through the pure helpers in followerSelectionEdit /
// followerMemberEdit / followerCompanionEdit. A locked (compendium) follower is always view-only.

import * as CG from "../utils/choiceGroupEdit.js";
import * as SE from "../utils/followerSelectionEdit.js";
import * as ME from "../utils/followerMemberEdit.js";
import * as CE from "../utils/followerCompanionEdit.js";
import { activateChoiceGroupEditors } from "./choiceGroupEditorMixin.js";
import { activateComboBoxes } from "../utils/comboBox.js";
import { bindAll } from "../utils/bindAll.js";
import { buildFollowerSnapshot } from "../model/snapshot/character/buildFollowerSnapshot.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";
import { GrantRegistry } from "./GrantRegistry.js";
import { Selection } from "../model/data/Selection.js";

// tagList is multi-select; instinct + cost are single-select.
const SELECTION_MULTI = { tagList: true, instinct: false, cost: false };

// "Blank" = a freshly-created follower with no authored content (name is ignored — it always has a
// default). A blank follower opens straight in the editor; anything with content opens as a card.
function isFollowerBlank(sys) {
	const sel = s => (s?.options?.length ?? 0) > 0 || (s?.selected?.length ?? 0) > 0;
	const has = v => v != null && v !== "";
	return !(
		sel(sys.tagList) || sel(sys.instinct) || sel(sys.cost) ||
		has(sys.armor) || has(sys.damage) || has(sys.specialQuality) || has(sys.moves) ||
		has(sys.description) || has(sys.notes) || (sys.hp?.max) ||
		(sys.choices?.length) || (sys.members?.length) ||
		sys.companion?.enabled || (sys.companion?.catalog?.length)
	);
}

export function createStonetopFollowerSheetClass(Base) {
	return class StonetopFollowerSheet extends Base {
		static DEFAULT_OPTIONS = {
			classes: ["follower"],
			position: { width: 940, height: 760 },
			actions: {
				toggleEditMode: StonetopFollowerSheet.#onToggleEditMode,
			},
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/item/follower.hbs",
				scrollable: [""],
			},
		};

		// Edit/view toggle — only rendered when editable, so it needs no isEditable guard.
		static #onToggleEditMode(_event, target) {
			this._editMode = target.dataset.mode === "edit";
			this.render();
		}

		async _prepareContext(options) {
			const context = await super._prepareContext(options);
			context.item     = this.item;
			context.editable = this.isEditable;
			// Followers are referenced by a stable slug (playbook/arcana grants list them), so it must
			// survive a rename. Generate one once if missing (not name-derived), mirroring the other sheets.
			if (!this.item.system.slug) {
				await this.item.update({ "system.slug": `custom-follower-${foundry.utils.randomID(8)}` });
			}
			const sys = this.item.system;
			context.system = sys;

			// Selection fields — normalized to raws with their fixed multi, for the string-list editors.
			context.tagListSel  = SE.toSelectionRaw(sys.tagList,  SELECTION_MULTI.tagList);
			context.instinctSel = SE.toSelectionRaw(sys.instinct, SELECTION_MULTI.instinct);
			context.costSel     = SE.toSelectionRaw(sys.cost,     SELECTION_MULTI.cost);

			// Choices group (a follower has at most one, at system.choices.0). buildRows may be [] for an
			// empty group; hasChoices distinguishes "no group" from "empty group".
			context.hasChoices = (sys.choices?.length ?? 0) > 0;
			context.choiceRows = sys.choices?.[0] ? CG.buildRows(sys.choices[0]) : [];

			// Members render their tags/traits as comma text (from the stored multi Selection); the change
			// handler writes them back as a Selection raw.
			context.members = (sys.members ?? []).map(m => ({
				name:       m.name ?? "",
				hp:         { value: m.hp?.value ?? 0, max: m.hp?.max ?? 0 },
				tagsText:   Selection.fromStored(m.tags,   { multi: true }).values.join(", "),
				traitsText: Selection.fromStored(m.traits, { multi: true }).values.join(", "),
			}));
			context.memberSuggestions = sys.memberSuggestions ?? { names: [], tags: [], traits: [] };
			context.companion         = sys.companion ?? CE.blankCompanion();

			// Live preview — the SAME snapshot builder + follower-card.hbs the character sheet renders.
			context.preview = buildFollowerSnapshot(this.item, { loyaltyCurrent: sys.loyalty?.value ?? 0 });
			// The follower's own choice group may grant moves/followers inline; resolve them so the
			// preview's choice-row renders them (see GrantRegistry / the character's stonetop.*.bySlug).
			context.stonetop = await GrantRegistry.fromChoiceGroups(context.preview.choices ? [context.preview.choices] : []);
			await enrichRichTextTree(context.preview, this.item?.getRollData?.() ?? {});
			await enrichRichTextTree(context.stonetop, this.item?.getRollData?.() ?? {});

			// View-first: a follower with content opens as a rendered card; a blank one opens in the
			// editor. A locked (non-editable) item is always view-only.
			if (this._editMode === undefined) this._editMode = isFollowerBlank(sys);
			if (!this.isEditable) this._editMode = false;
			context.editMode = this._editMode;
			return context;
		}

		// Direct bindings to the current editor controls — re-run per render (part content is replaced).
		_onRender(context, options) {
			super._onRender(context, options);

			// The preview pane renders follower-card.hbs, whose tag/instinct/cost combo dropdowns are
			// driven by the global (document-delegated, idempotent) combobox handler. The actor sheet
			// installs it, but a follower Item opened on its own never would — so install it here too.
			activateComboBoxes();

			if (!this.isEditable) return;
			const root = this.element;
			const item = this.item;
			const numAttr = (el, name) => Number(el.dataset[name]); // one int-off-a-data-attr reader

			// ── Choices group (system.choices.0) — reuse the shared editor + lifecycle buttons ──
			activateChoiceGroupEditors(this, root);
			bindAll(root, ".follower-choices-add", "click", () => item.update({ "system.choices": [CG.newGroup(item.system.slug)] }));
			bindAll(root, ".follower-choices-remove", "click", () => item.update({ "system.choices": [] }));

			// ── Selection fields (tagList/instinct/cost): options list + default → Selection raw ──
			const multiOf  = field => !!SELECTION_MULTI[field];
			const selOf    = field => item.system[field];
			const saveSel  = (field, raw) => item.update({ [`system.${field}`]: raw });
			const selField = el => el.closest("[data-selection-field]")?.dataset.selectionField;
			const strIdx   = el => numAttr(el, "stringIndex");
			bindAll(root, ".follower-option-add", "click", ev => {
				const f = selField(ev.currentTarget); if (f) saveSel(f, SE.addOption(selOf(f), multiOf(f)));
			});
			bindAll(root, ".follower-option-remove", "click", ev => {
				const f = selField(ev.currentTarget); if (f) saveSel(f, SE.removeOption(selOf(f), strIdx(ev.currentTarget), multiOf(f)));
			});
			bindAll(root, ".follower-option-input", "change", ev => {
				const f = selField(ev.currentTarget); if (f) saveSel(f, SE.setOption(selOf(f), strIdx(ev.currentTarget), ev.currentTarget.value, multiOf(f)));
			});
			bindAll(root, ".follower-selection-selected", "change", ev => {
				const f = ev.currentTarget.dataset.selectionField;
				if (f) saveSel(f, SE.setSelected(selOf(f), SE.parseCsv(ev.currentTarget.value), multiOf(f)));
			});

			// ── Member suggestions (names/tags/traits) — plain string lists ──
			const suggKey  = el => el.closest("[data-suggest-key]")?.dataset.suggestKey;
			const suggOf   = key => [...(item.system.memberSuggestions?.[key] ?? [])];
			const saveSugg = (key, list) => item.update({ [`system.memberSuggestions.${key}`]: list });
			bindAll(root, ".follower-suggest-add", "click", ev => {
				const k = suggKey(ev.currentTarget); if (!k) return;
				const l = suggOf(k); l.push(""); saveSugg(k, l);
			});
			bindAll(root, ".follower-suggest-remove", "click", ev => {
				const k = suggKey(ev.currentTarget); if (!k) return;
				const l = suggOf(k); l.splice(strIdx(ev.currentTarget), 1); saveSugg(k, l);
			});
			bindAll(root, ".follower-suggest-input", "change", ev => {
				const k = suggKey(ev.currentTarget); if (!k) return;
				const l = suggOf(k); l[strIdx(ev.currentTarget)] = ev.currentTarget.value; saveSugg(k, l);
			});

			// ── Group members — whole-array writes via helper ──
			const members    = () => item.system.members ?? [];
			const setMembers = list => item.update({ "system.members": list });
			const idx        = ev => numAttr(ev.currentTarget, "index");
			// Adding a member makes this a group follower — write the members array AND ensure the
			// "group" tag is set on tagList (FollowerSnapshot derives isGroup from it).
			bindAll(root, ".follower-member-add", "click", () => item.update({
				"system.members": ME.addMember(members(), item.system.hp?.max ?? 0),
				"system.tagList": Selection.fromStored(item.system.tagList, { multi: true }).select("group").toRaw(),
			}));
			bindAll(root, ".follower-member-remove", "click", ev => setMembers(ME.removeMember(members(), idx(ev))));
			bindAll(root, ".follower-member-up", "click", ev => setMembers(ME.moveMember(members(), idx(ev), -1)));
			bindAll(root, ".follower-member-down", "click", ev => setMembers(ME.moveMember(members(), idx(ev), 1)));
			bindAll(root, ".follower-member-field", "change", ev => {
				const el = ev.currentTarget, field = el.dataset.field, index = numAttr(el, "index");
				// tags/traits are multi Selections (stored as raws); scalars (name, hp.*) write directly.
				if (field === "tags" || field === "traits") {
					setMembers(ME.setMemberListField(members(), { index, field, csv: el.value }));
				} else {
					const value = el.type === "number" ? (el.value ? Number(el.value) : 0) : el.value;
					setMembers(ME.setMemberField(members(), { index, field, value }));
				}
			});

			// ── Animal companion — whole-object writes via helper ──
			const companion    = () => item.system.companion ?? {};
			const setCompanion = c => item.update({ "system.companion": c });
			bindAll(root, ".follower-companion-enable", "change", ev => setCompanion(CE.setEnabled(companion(), ev.currentTarget.checked)));
			bindAll(root, ".follower-companion-add-type", "click", () => setCompanion(CE.addType(companion())));
			bindAll(root, ".follower-companion-remove-type", "click", ev => setCompanion(CE.removeType(companion(), idx(ev))));
			bindAll(root, ".follower-comp-field", "change", ev => {
				const el = ev.currentTarget;
				const value = el.type === "number" ? (el.value ? Number(el.value) : 0) : el.value;
				setCompanion(CE.setTypeField(companion(), { index: numAttr(el, "index"), field: el.dataset.field, value }));
			});
			// Companion per-type string lists (variants/options/defaults). Field from the [data-comp-field]
			// wrapper, the owning type index from data-owner-index; each mutation rewrites that list.
			const compField = el => el.closest("[data-comp-field]")?.dataset.compField;
			const compList  = (c, ti, field) => [...((c.catalog?.[ti]?.[field]) ?? [])];
			const saveComp  = (ev, mutate) => {
				const el = ev.currentTarget, field = compField(el), ti = numAttr(el, "ownerIndex");
				if (!field || Number.isNaN(ti)) return;
				const c = companion(), list = compList(c, ti, field);
				mutate(list);
				setCompanion(CE.setTypeField(c, { index: ti, field, value: list }));
			};
			bindAll(root, ".follower-comp-list-add", "click",    ev => saveComp(ev, list => list.push("")));
			bindAll(root, ".follower-comp-list-remove", "click", ev => saveComp(ev, list => list.splice(strIdx(ev.currentTarget), 1)));
			bindAll(root, ".follower-comp-list-input", "change", ev => saveComp(ev, list => { list[strIdx(ev.currentTarget)] = ev.currentTarget.value; }));
		}
	};
}
