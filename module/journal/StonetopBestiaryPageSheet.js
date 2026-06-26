import { isDefaultImg } from "../utils/strings.js";
import { applyJournalCheckboxes } from "../utils/journal-checkboxes.js";
import { applyJournalRollTables } from "../utils/journal-roll-tables.js";
import { markValueTooltips } from "../utils/value-tooltips.js";
import { buildCodexContext, onCodexClick, onCodexChange, codexUpdateRichField, hasText, CODEX_RICH_FIELDS, CODEX_GROUP_FIELDS } from "../actors/bestiary/codex.js";
import { isInCompendium, blockCompendiumEdit } from "../utils/compendium-edit-guard.js";

// Edit affordances on the bestiary page (section pencils + codex add/remove controls);
// clicking any of these in a compendium gets the immutable-journal dialog.
const BESTIARY_EDIT_SELECTOR = ".stonetop-section-edit, .stonetop-section-done, .stonetop-entry-add-line, .stonetop-entry-add-qa, .stonetop-entry-remove-qa, .stonetop-discovery-add-group, .stonetop-discovery-remove-group";

// Dangers is a structured group field on the page (unlike the actor sheet, where
// it's rich text), so it's pulled out of the rich-field path and added as a group.
const PAGE_RICH_FIELDS = CODEX_RICH_FIELDS.filter(f => f.key !== "dangers");
const PAGE_GROUP_FIELDS = [...CODEX_GROUP_FIELDS, { key: "dangers", outKey: "dangerGroups" }];

// Sections that fall under the "In Play" act banner (Concept/Description/nests stay
// in the unbannered opening block). Drives whether the banner renders at all.
const IN_PLAY_KEYS = ["questions", "lore", "hooks", "origins", "discoveries", "dangers", "statBlocks", "notes"];

// Prototype: a bestiary "codex" rendered as a JournalEntryPage instead of an
// actor. Reuses the actor sheet's shared codex engine wholesale.
//
// Two ways to edit:
//   • Inline per-section — the embedded (read-only) page shows a pencil on each
//     section header; clicking it flips just that section into edit fields. This
//     is the primary flow, so a GM can fix one paragraph without the whole form.
//   • Whole-page popout — the journal's page edit-pencil opens this sheet as a
//     window with every section editable at once (isEditable === true).
//
// A section renders its edit markup when `editing[key]` is true, which is
// `isEditable` (popout) OR `_editingSections.has(key)` (inline toggle).
export function createStonetopBestiaryPageSheetClass(Base) {
	return class StonetopBestiaryPageSheet extends Base {
		_editingSections = new Set();

		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "journal-entry-page", "stonetop-bestiary-page"],
				width:   720,
				height:  800,
				submitOnChange: true,
				closeOnSubmit:  false,
			});
		}

		// Let the shared codex dispatchers operate on the page document. `_editMode`
		// must be true while any inline section is open, or codex add/remove bail.
		get actor() { return this.document; }
		get _editMode() { return this.isEditable || this._editingSections.size > 0; }

		// Compendium journals are immutable reference content — never editable in place,
		// regardless of the pack's lock state. Edit attempts are redirected to a dialog
		// (see activateListeners) pointing the user at the world copy.
		get isEditable() { return super.isEditable && !isInCompendium(this.document); }

		get template() {
			return "systems/stonetop/templates/journal/bestiary.hbs";
		}

		// The journal renders the inline page view with `editable: false`, which makes
		// FormApplication readonly/disable every field via `_disableFields`. We gate
		// editability per section in the template instead (read markup has no inputs;
		// only an opened section renders fields), so suppress the blanket lock-down —
		// otherwise the per-section inputs are present but uneditable.
		_disableFields(_form) {}

		async getData(options = {}) {
			const context = super.getData(options);
			const system = context.system = this.document.system;
			const owner = this.document.isOwner;
			const editable = this.isEditable;        // popout = edit everything
			const st = context.stonetop = {};
			st.isEditable = editable;
			st.owner = owner;
			st.inlineOwner = owner && !editable;     // show per-section pencils inline only

			// One codex context with all data present; the template filters empties
			// in read markup and shows everything in edit markup.
			Object.assign(st, await buildCodexContext(system, true, {
				richFields: PAGE_RICH_FIELDS,
				groupFields: PAGE_GROUP_FIELDS,
			}));
			st.statBlocks = await this._resolveStatBlocks(system?.statBlocks);

			const has = {
				concept:     hasText(system?.concept),
				description: hasText(system?.description),
				questions:   (system?.questions ?? []).some(p => p?.prompt || p?.answer),
				lore:        (system?.lore ?? []).some(p => p?.prompt || p?.answer),
				hooks:       hasText(system?.hooks) || hasText(system?.hooksIntro),
				origins:     hasText(system?.origins) || hasText(system?.originsIntro),
				discoveries: (system?.discoveries ?? []).some(g => g?.heading || g?.body || (g?.items ?? []).length),
				nests:       hasText(system?.nests),
				dangers:     (system?.dangers ?? []).some(g => g?.heading || g?.body || (g?.items ?? []).length),
				statBlocks:  st.statBlocks.length > 0,
				notes:       hasText(system?.notes),
			};
			const open = {}, editing = {}, visible = {};
			for (const key of Object.keys(has)) {
				open[key]    = this._editingSections.has(key);
				editing[key] = editable || open[key];
				visible[key] = owner || has[key];   // non-owners only see filled sections
			}
			// Stat blocks are read-only references to the monster actors — never an
			// editable section, and pointless to show empty.
			visible.statBlocks = has.statBlocks;
			st.open = open;
			st.editing = editing;
			st.visible = visible;

			// An "In Play" act banner heads the GM-facing during-play sections (Questions
			// onward), mirroring the location/lore pages' act headers so the bestiary's
			// journal TOC nests the same anchor. The opening identity block (Concept,
			// Description, Lair & Habitat) gets no banner — it sits under the page name,
			// as "At a Glance" does on location pages. Suppress the banner when none of
			// its sections render, so a non-owner never sees it orphaned over nothing.
			st.showInPlayBanner = IN_PLAY_KEYS.some(key => visible[key] || editing[key]);

			return context;
		}

		async _resolveStatBlocks(uuids) {
			const list = Array.isArray(uuids) ? uuids : [];
			const docs = await Promise.all(list.map(uuid => fromUuid(uuid).catch(() => null)));
			const textEditor = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
			const blocks = docs
				.map((doc, i) => ({ doc, uuid: list[i] }))
				.filter(({ doc }) => doc?.type === "monster");
			return Promise.all(blocks.map(async ({ doc, uuid }) => {
				const hp = doc.system?.attributes?.hp ?? {};
				return {
					uuid,
					name: doc.name,
					img: doc.img,
					hasImg: !isDefaultImg(doc.img),
					hpValue: hp.value ?? "",
					hpMax: hp.max ?? "",
					organization: doc.system?.organization ?? "",
					link: await textEditor.enrichHTML(`@UUID[${uuid}]{${doc.name}}`, {}),
				};
			}));
		}

		/**
		 * Re-render just this page. Inline, that means re-rendering this one page view
		 * inside the journal (cheap); in the popout, re-render the window. Used for the
		 * section pencil/done toggles, which change `_editingSections` without touching
		 * the document (codex edits persist via update, which auto-re-renders).
		 */
		async _refresh() {
			if (this.isEditable) return this.render(false);
			const journal = this.document.parent?.sheet;
			if (journal?.rendered) return journal.render({ parts: [this.document.id] });
		}

		/**
		 * Make each stat-block card draggable as its monster Actor, so a GM can drag
		 * it straight from the bestiary page onto a scene to place a token. Foundry's
		 * canvas drop handler imports the (compendium) actor and creates the token.
		 */
		_bindStatBlockDrag(root) {
			for (const card of root.querySelectorAll(".stonetop-entry-statblock[data-statblock-uuid]")) {
				card.addEventListener("dragstart", ev => {
					const uuid = card.dataset.statblockUuid;
					if (!uuid) return;
					ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Actor", uuid }));
					ev.dataTransfer.effectAllowed = "copy";
				});
			}
		}

		activateListeners(html) {
			super.activateListeners(html);
			// The embedded view sheet is rendered by the journal, which never sets
			// `_element`; the codex dispatchers read `sheet.element[0]`, so point it here.
			this._element = html;
			const root = html[0];
			if (!root) return;

			// Stat-block cards drag onto a scene to drop a token. Available to anyone
			// viewing the page; Foundry enforces the actual token-creation permission.
			this._bindStatBlockDrag(root);

			// Make the requirement/option check-lists tickable in view mode. This sheet
			// fires `renderStonetopBestiaryPageSheet`, not the journal render hooks that
			// drive checkboxes elsewhere, so run the pass here. Before the owner gate so
			// non-owners still see the shared checked state.
			applyJournalCheckboxes(this, html);
			// Roll the random tables from their "Roll" header (this custom sheet fires its
			// own render event, so the generic journal hook never reaches it — run it here).
			applyJournalRollTables(this, html);
			// Hover tooltips on "Value N" trade-tier mentions (loot, treasure). Same reason
			// as above — the generic journal render pass never reaches this custom sheet.
			markValueTooltips(root);

			if (!this.document.isOwner) return;

			root.addEventListener("click", async ev => {
				const t = ev.target;

				// Immutable compendium copy: redirect any edit click to the explainer dialog.
				if (blockCompendiumEdit(this.document, ev, BESTIARY_EDIT_SELECTOR)) return;

				// Per-section edit/done toggles.
				const edit = t.closest(".stonetop-section-edit");
				if (edit) { this._editingSections.add(edit.dataset.section); return this._refresh(); }
				const done = t.closest(".stonetop-section-done");
				if (done) {
					// Always-active rich editors only save via toolbar/Ctrl+S, not on
					// blur, so flush their live content before closing the section.
					const section = done.closest("[data-section]");
					for (const ed of section?.querySelectorAll(".stonetop-entry-rich-editor") ?? []) {
						if (ed.dataset.field) await codexUpdateRichField(this.document, ed.dataset.field, ed.value);
					}
					this._editingSections.delete(done.dataset.section);
					return this._refresh();
				}

				// Codex add/remove (structural; the document update re-renders the page).
				await onCodexClick(this, ev);
			});

			root.addEventListener("change", async ev => {
				const field = ev.target.closest("[data-doc-field]")?.dataset?.docField;
				if (field) { await this.document.update({ [`system.${field}`]: ev.target.value }); return; }
				await onCodexChange(this, ev);
			});
		}
	};
}
