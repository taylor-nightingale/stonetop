import { qaPairs, hasText, enrichQaPairs } from "../actors/bestiary/codex.js";
import { applyJournalCheckboxes } from "../utils/journal-checkboxes.js";
import { bindSteadingImprovementDrag } from "./steading-improvement-cards.js";
import { applyJournalRollTables } from "../utils/journal-roll-tables.js";
import { markValueTooltips } from "../utils/value-tooltips.js";
import { isInCompendium, blockCompendiumEdit } from "../utils/compendium-edit-guard.js";

// Edit affordances on the location page; clicking any of these in a compendium gets
// the immutable-journal dialog instead of mutating the read-only document.
const LOCATION_EDIT_SELECTOR = ".stonetop-section-edit, .stonetop-section-done, .stonetop-entry-add-qa, .stonetop-entry-remove-qa, .stonetop-entry-add-group, .stonetop-entry-remove-group";

// Display labels for the three section "acts" (see gazetteer.mjs `groupFor`).
// Rendered as an h2 above each act's sections so every journal's TOC nests the
// same three anchors. Keyed by the section's stored `group` slug.
const GROUP_LABELS = { glance: "At a Glance", place: "The Place", details: "Details", inplay: "In Play" };

// A gazetteer place rendered as a structured JournalEntryPage (subtype
// "location"), the locations counterpart of StonetopBestiaryPageSheet. The page
// holds an ordered `system.sections[]` (see LocationPageModel); each section is
// either rich `prose` or a `qa` prompt/answer list, and each gets its own inline
// edit pencil. Sections are addressed by their array INDEX (locations are
// heterogeneous, so there's no fixed field name to key on).
//
// Two ways to edit, mirroring the bestiary page:
//   • Inline per-section — the embedded read-only page shows a pencil on each
//     section header; clicking flips just that section into edit fields.
//   • Whole-page popout — the journal's page edit-pencil opens this sheet as a
//     window with every section editable at once (isEditable === true).
export function createStonetopLocationPageSheetClass(Base) {
	return class StonetopLocationPageSheet extends Base {
		_editingSections = new Set();

		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "journal-entry-page", "stonetop-bestiary-page", "stonetop-location-page"],
				width:   720,
				height:  800,
				submitOnChange: true,
				closeOnSubmit:  false,
			});
		}

		get _editMode() { return this.isEditable || this._editingSections.size > 0; }

		// Compendium journals are immutable reference content — never editable in place,
		// regardless of the pack's lock state. Edit attempts are redirected to a dialog
		// (see activateListeners) pointing the user at the world copy.
		get isEditable() { return super.isEditable && !isInCompendium(this.document); }

		get template() {
			return "systems/stonetop/templates/journal/location.hbs";
		}

		// The embedded page view renders with `editable: false`, which makes
		// FormApplication readonly every field. We gate editability per section in
		// the template (read markup has no inputs), so suppress the blanket lockdown.
		_disableFields(_form) {}

		async getData(options = {}) {
			const context = super.getData(options);
			const system = context.system = this.document.system;
			const owner = this.document.isOwner;
			const editable = this.isEditable; // popout = edit everything
			const st = context.stonetop = {};
			st.isEditable = editable;
			st.owner = owner;
			st.inlineOwner = owner && !editable; // per-section pencils inline only

			const textEditor = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
			const enrich = value => textEditor?.enrichHTML ? textEditor.enrichHTML(value ?? "", {}) : Promise.resolve(value ?? "");

			st.sections = await Promise.all((system.sections ?? []).map(async (s, index) => {
				const open = this._editingSections.has(index);
				const editing = editable || open;
				const isQa = s.kind === "qa";
				const isGroups = s.kind === "groups";
				const filled =
					isQa     ? (s.pairs ?? []).some(p => p?.prompt || p?.answer) :
					isGroups ? (s.groups ?? []).some(g => g?.heading || hasText(g?.body)) :
					           hasText(s.body);
				// In read mode, enrich each prompt/answer so baked @UUID cross-links (e.g. a
				// place name linked in a Questions section) resolve and become clickable —
				// the same enrichment the prose sections get. Edit mode shows the raw value
				// in an input, so it's left unenriched.
				let pairs = isQa ? qaPairs(s.pairs, editing) : [];
				if (isQa && !editing) pairs = await enrichQaPairs(pairs, enrich);
				// Grouped (Dangers) entries: each carries a raw body for the per-entry
				// ProseMirror editor AND an enriched body for read-only display (links,
				// lists, and any nested roll tables resolve there, like prose sections).
				const groups = isGroups
					? await Promise.all((s.groups ?? []).map(async g => ({
						heading: g.heading ?? "",
						body: g.body ?? "",
						enrichedBody: await enrich(g.body),
					})))
					: [];
				return {
					index,
					kind: s.kind,
					heading: s.heading,
					group: s.group, // schema-guaranteed non-blank act slug (initial "place")
					danger: !!s.danger,
					isQa,
					isGroups,
					open,
					editing,
					visible: owner || filled, // non-owners only see filled sections
					body: (isQa || isGroups) ? "" : (s.body ?? ""),      // raw source for the editor's `value`
					enrichedBody: (isQa || isGroups) ? "" : await enrich(s.body), // enriched for read-only display
					pairs,
					groups,
				};
			}));

			// Mark the first RENDERED section of each act so the template can emit the
			// act header (an h2 above the section h3s). Tracking only sections that
			// actually render keeps the header from appearing over an empty act when a
			// non-owner sees no filled sections in it.
			let lastGroup = null;
			for (const s of st.sections) {
				if (!(s.visible || s.editing)) continue;
				if (s.group === lastGroup) continue;
				lastGroup = s.group;
				// The opening "At a Glance" act gets NO banner — its sections (Overview,
				// Impressions, …) sit directly beneath the journal's name, which already
				// heads them. The remaining acts keep their dividers.
				if (s.group === "glance") continue;
				s.groupStart = true;
				s.groupLabel = GROUP_LABELS[s.group] ?? "";
			}

			return context;
		}

		/**
		 * Re-render just this page. Inline, re-render this one page view inside the
		 * journal (cheap); in the popout, re-render the window. Used for the section
		 * pencil/done toggles, which change `_editingSections` without touching the
		 * document (content edits persist via update, which auto-re-renders).
		 */
		async _refresh() {
			if (this.isEditable) return this.render(false);
			const journal = this.document.parent?.sheet;
			if (journal?.rendered) return journal.render({ parts: [this.document.id] });
		}

		// Replace one section with `{...section, ...patch}`, persisting the whole
		// sections array (ArrayField updates are whole-array).
		async _patchSection(index, patch) {
			const sections = foundry.utils.deepClone(this.document.system.sections ?? []);
			if (!sections[index]) return;
			Object.assign(sections[index], patch);
			await this.document.update({ "system.sections": sections });
		}

		// Rebuild a repeatable-row section's entries from its live edit inputs: walk the
		// section's indexed rows, reading each field selector's value into its named key.
		_readRows(root, index, rowSelector, fieldSelectors) {
			const section = root.querySelector(`[data-section-index="${index}"]`);
			if (!section) return [];
			return Array.from(section.querySelectorAll(rowSelector)).map(row =>
				Object.fromEntries(Object.entries(fieldSelectors)
					.map(([key, sel]) => [key, row.querySelector(sel)?.value ?? ""])));
		}

		// Rebuild a `qa` section's pairs from its current edit inputs.
		_readPairs(root, index) {
			return this._readRows(root, index, "[data-qa-index]", {
				prompt: ".stonetop-entry-qa-prompt",
				answer: ".stonetop-entry-qa-answer",
			});
		}

		// Rebuild a `groups` (Dangers) section's entries from its current edit inputs:
		// each row's title field + the live HTML of its always-active ProseMirror body.
		_readGroups(root, index) {
			return this._readRows(root, index, "[data-group-index]", {
				heading: ".stonetop-entry-group-heading",
				body:    ".stonetop-entry-group-body",
			});
		}

		activateListeners(html) {
			super.activateListeners(html);
			// The embedded view sheet is rendered by the journal, which never sets
			// `_element`; point it at our root so queries work in both modes.
			this._element = html;
			const root = html[0];
			// Make the requirement/option check-lists tickable in view mode. The custom
			// page sheet fires `renderStonetopLocationPageSheet`, not the journal render
			// hooks that drive this elsewhere, so run the pass here. Before the owner
			// gate: non-owners still see the shared checked state (they just can't edit).
			applyJournalCheckboxes(this, html);
			// Roll the random tables from their "Roll" header (this custom sheet fires its
			// own render event, so the generic journal hook never reaches it — run it here).
			applyJournalRollTables(this, html);
			// Baked steading-improvement cards drag onto the Stonetop sheet (any viewer).
			bindSteadingImprovementDrag(html);
			// Hover tooltips on "Value N" trade-tier mentions (treasure tables, valuables).
			// Same reason as above — the generic journal render pass never reaches this sheet.
			markValueTooltips(root);
			if (!root || !this.document.isOwner) return;

			root.addEventListener("click", async ev => {
				const t = ev.target;

				// Immutable compendium copy: redirect any edit click to the explainer dialog.
				if (blockCompendiumEdit(this.document, ev, LOCATION_EDIT_SELECTOR)) return;

				// Per-section edit/done toggles.
				const edit = t.closest(".stonetop-section-edit");
				if (edit) { this._editingSections.add(Number(edit.dataset.section)); return this._refresh(); }

				const done = t.closest(".stonetop-section-done");
				if (done) {
					const index = Number(done.dataset.section);
					const section = done.closest("[data-section-index]");
					// Always-active rich editors only save via toolbar/Ctrl+S, not on
					// blur, so flush their live content before closing the section. A
					// `groups` (Dangers) section flushes every entry's title + body at once.
					if (section?.querySelector("[data-group-index]")) {
						await this._patchSection(index, { groups: this._readGroups(root, index) });
					} else {
						const editor = section?.querySelector(".stonetop-entry-rich-editor");
						if (editor) await this._patchSection(index, { body: editor.value });
					}
					this._editingSections.delete(index);
					return this._refresh();
				}

				// Q&A add/remove (structural; the document update re-renders the page).
				const add = t.closest(".stonetop-entry-add-qa");
				if (add) {
					if (!this._editMode) return;
					const index = Number(add.closest("[data-section-index]")?.dataset?.sectionIndex);
					const pairs = this._readPairs(root, index);
					pairs.push({ prompt: "", answer: "" });
					return this._patchSection(index, { pairs });
				}
				const remove = t.closest(".stonetop-entry-remove-qa");
				if (remove) {
					if (!this._editMode) return;
					const section = remove.closest("[data-section-index]");
					const index = Number(section?.dataset?.sectionIndex);
					const j = Number(remove.closest("[data-qa-index]")?.dataset?.qaIndex);
					const pairs = this._readPairs(root, index);
					if (!Number.isNaN(j)) pairs.splice(j, 1);
					return this._patchSection(index, { pairs });
				}

				// Grouped (Dangers) entry add/remove — mirrors the Q&A add/remove above.
				const addGroup = t.closest(".stonetop-entry-add-group");
				if (addGroup) {
					if (!this._editMode) return;
					const index = Number(addGroup.closest("[data-section-index]")?.dataset?.sectionIndex);
					const groups = this._readGroups(root, index);
					groups.push({ heading: "", body: "" });
					return this._patchSection(index, { groups });
				}
				const removeGroup = t.closest(".stonetop-entry-remove-group");
				if (removeGroup) {
					if (!this._editMode) return;
					const section = removeGroup.closest("[data-section-index]");
					const index = Number(section?.dataset?.sectionIndex);
					const j = Number(removeGroup.closest("[data-group-index]")?.dataset?.groupIndex);
					const groups = this._readGroups(root, index);
					if (!Number.isNaN(j)) groups.splice(j, 1);
					return this._patchSection(index, { groups });
				}
			});

			root.addEventListener("change", async ev => {
				if (!this._editMode) return;
				const t = ev.target;

				const editor = t.closest(".stonetop-entry-rich-editor");
				if (editor) {
					const index = Number(editor.dataset.sectionIndex);
					// A grouped (Dangers) body editor carries data-group-index; persist the
					// whole entry list so the matching title field rides along. A plain prose
					// editor has no group index, so it patches the section body directly.
					if (editor.dataset.groupIndex !== undefined) {
						return this._patchSection(index, { groups: this._readGroups(root, index) });
					}
					return this._patchSection(index, { body: editor.value });
				}
				const qaInput = t.closest(".stonetop-entry-qa-input");
				if (qaInput) {
					const index = Number(qaInput.closest("[data-section-index]")?.dataset?.sectionIndex);
					return this._patchSection(index, { pairs: this._readPairs(root, index) });
				}
				const groupHeading = t.closest(".stonetop-entry-group-heading");
				if (groupHeading) {
					const index = Number(groupHeading.closest("[data-section-index]")?.dataset?.sectionIndex);
					return this._patchSection(index, { groups: this._readGroups(root, index) });
				}
			});
		}
	};
}
