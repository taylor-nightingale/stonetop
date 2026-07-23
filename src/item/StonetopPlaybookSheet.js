// Item sheet for authoring `playbook` items — full parity with PlaybookData, laid out as tabs so a
// complex model stays constructable. Tabs: Basics · Backgrounds · Instinct & Appearance · Choices ·
// Possessions · Moves · Followers & Inserts · Introductions (native ApplicationV2 `static TABS`,
// same machinery StonetopCharacterSheet uses — nav anchors carry data-action="tab", context.tabs
// comes out of super._prepareContext).
//
// Reuse over reinvention:
//   • choice groups (appearance, each choices[] group, backgrounds[].choices, intro step4/step6) run
//     through the shared choice-group-editor partial + activateChoiceGroupEditors mixin.
//   • instinct is stored as a choice group but edited as a plain string list (the insert pattern).
//   • references (moves/startingMoves, followers, inserts, background moves, special possessions) use
//     a dialog picker resolving/creating slugs — the insert sheet's move-reference flow, generalised.
// The non-choice-group structures (backgrounds, origin, specialPossessions) are edited through the
// pure helpers in playbookEdit.js. The V2 form's submitOnChange auto-saves the name/system.* inputs
// (Basics scalars + the <prose-mirror> description); everything else writes via explicit handlers.

import * as CG from "../utils/choiceGroupEdit.js";
import * as PE from "../utils/playbookEdit.js";
import { activateChoiceGroupEditors } from "./choiceGroupEditorMixin.js";
import { bindAll } from "../utils/bindAll.js";
import { itemDescriptionRich } from "./itemDescriptionRich.js";
import { enrichRichTextTree } from "../utils/enrichRichText.js";
import { FoundryMoveRepository } from "../actors/character/repositories/FoundryMoveRepository.js";
import { FoundryFollowerRepository } from "../actors/character/repositories/FoundryFollowerRepository.js";
import { FoundryInsertRepository } from "../actors/character/repositories/FoundryInsertRepository.js";
import { FoundryPossessionRepository } from "../actors/character/repositories/FoundryPossessionRepository.js";

export function createStonetopPlaybookSheetClass(Base) {
	return class StonetopPlaybookSheet extends Base {
		static DEFAULT_OPTIONS = {
			classes: ["playbook"],
			position: { width: 820, height: 820 },
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/item/playbook.hbs",
				scrollable: [""],
			},
		};

		// Native ApplicationV2 tabs (see StonetopCharacterSheet). labelPrefix → stonetop.playbook.tabs.*
		static TABS = {
			primary: {
				tabs: [
					{ id: "basics" }, { id: "backgrounds" }, { id: "traits" }, { id: "choices" },
					{ id: "possessions" }, { id: "moves" }, { id: "grants" }, { id: "introductions" },
				],
				initial: "basics",
				labelPrefix: "stonetop.playbook.tabs",
			},
		};

		async _prepareContext(options) {
			const context = await super._prepareContext(options);

			// One-time init: a stable slug (playbook moves/inserts are tagged with it, so it must
			// survive a rename) and an introductions object so its nested edits have a merge target.
			const init = {};
			if (this.isEditable && !this.item.system.slug)          init["system.slug"] = `custom-playbook-${foundry.utils.randomID(8)}`;
			if (this.isEditable && this.item.system.introductions == null) init["system.introductions"] = { step3: "" };
			if (Object.keys(init).length) await this.item.update(init);

			const sys = this.item.system;
			context.item     = this.item;
			context.editable = this.isEditable;
			context.system   = sys;

			// Resolve every referenced slug to a display name once (compendium + world).
			const [moveIndex, followerSummaries, insertSummaries, possessionSummaries] = await Promise.all([
				new FoundryMoveRepository().buildSlugIndex(),
				new FoundryFollowerRepository().listSummaries(),
				new FoundryInsertRepository().listSummaries(),
				new FoundryPossessionRepository().listSummaries(),
			]);
			const nameOfMove = s => moveIndex.get(s)?.name ?? null;
			const nameFrom   = (list, s) => list.find(e => e.slug === s)?.name ?? null;

			const refRow = (slug, name) => ({ slug, name: name ?? slug, missing: name == null });

			// -- Basics --------------------------------------------------------------
			context.rich = itemDescriptionRich(sys);

			// -- Backgrounds ---------------------------------------------------------
			context.backgrounds = (sys.backgrounds ?? []).map((bg, i) => ({
				index: i,
				slug: bg.slug ?? "",
				label: bg.label ?? "",
				description: bg.description ?? "",
				moves: (bg.moves ?? []).map(s => refRow(s, nameOfMove(s))),
				hasChoices: bg.choices != null,
				cgPath: `system.backgrounds.${i}.choices`,
				choiceRows: bg.choices ? CG.buildRows(bg.choices) : [],
			}));

			// -- Origin --------------------------------------------------------------
			context.origin = (sys.origin ?? []).map((o, i) => ({
				index: i, region: o.region ?? "", names: (o.names ?? []).join("\n"),
			}));

			// -- Instinct (string list) & Appearance (choice group) -----------------
			context.instinctStrings = CG.instinctOptions(sys.instinct);
			context.hasAppearance   = sys.appearance != null;
			context.appearanceRows  = sys.appearance ? CG.buildRows(sys.appearance) : [];

			// -- Choices[] -----------------------------------------------------------
			context.choicesGroups = (sys.choices ?? []).map((grp, i) => ({
				index: i, slug: grp?.slug, cgPath: `system.choices.${i}`, rows: CG.buildRows(grp),
			}));

			// -- Special possessions -------------------------------------------------
			const sp = sys.specialPossessions ?? null;
			const preselected = new Set(sp?.preselected ?? []);
			context.hasPossessions = sp != null;
			context.possessions = {
				pickNote:  sp?.pickNote  ?? "",
				pickCount: sp?.pickCount ?? 0,
				items: (sp?.slugs ?? []).map(s => ({ ...refRow(s, nameFrom(possessionSummaries, s)), preselected: preselected.has(s) })),
			};

			// -- Moves / starting moves ---------------------------------------------
			const starting = new Set(sys.startingMoves ?? []);
			context.playbookMoves = (sys.moves ?? []).map(s => ({ ...refRow(s, nameOfMove(s)), starting: starting.has(s) }));

			// -- Grants: followers + inserts ----------------------------------------
			context.followers = (sys.followers ?? []).map(s => refRow(s, nameFrom(followerSummaries, s)));
			context.inserts   = (sys.inserts   ?? []).map(s => refRow(s, nameFrom(insertSummaries,   s)));

			// -- Introductions -------------------------------------------------------
			const intro = sys.introductions ?? {};
			context.introductions = {
				step3: intro.step3 ?? "",
				hasStep4: intro.step4 != null,
				hasStep6: intro.step6 != null,
				step4Rows: intro.step4 ? CG.buildRows(intro.step4) : [],
				step6Rows: intro.step6 ? CG.buildRows(intro.step6) : [],
			};

			await enrichRichTextTree(context.rich, this.item?.getRollData?.() ?? {});
			return context;
		}

		// Direct bindings to the current editor controls — re-run per render (part content is replaced).
		_onRender(context, options) {
			super._onRender(context, options);
			if (!this.isEditable) return;
			const root = this.element;
			const item = this.item;

			// All choice-group editors on the page (appearance, choices[], backgrounds[].choices,
			// intro step4/step6) — routed by their data-cg-path.
			activateChoiceGroupEditors(this, root);

			// ── Instinct (string list, round-tripped through the choice group) ──────
			const setInstinct = strings => item.update({ "system.instinct": CG.instinctFromStrings(strings) });
			bindAll(root, ".playbook-instinct-add", "click", () => {
				const s = CG.instinctOptions(item.system.instinct); s.push(""); setInstinct(s);
			});
			bindAll(root, ".playbook-instinct-remove", "click", ev => {
				const s = CG.instinctOptions(item.system.instinct); s.splice(Number(ev.currentTarget.dataset.index), 1); setInstinct(s);
			});
			bindAll(root, ".playbook-instinct-string", "change", ev => {
				const s = CG.instinctOptions(item.system.instinct); s[Number(ev.currentTarget.dataset.index)] = ev.currentTarget.value; setInstinct(s);
			});

			// ── Optional choice-group lifecycles (appearance, intro step4/step6) ────
			const toggleGroup = (path, slug) => {
				const has = foundry.utils.getProperty(item, path) != null;
				return item.update({ [path]: has ? null : CG.newGroup(slug) });
			};
			bindAll(root, ".playbook-group-toggle", "click", ev =>
				toggleGroup(ev.currentTarget.dataset.path, ev.currentTarget.dataset.slug || item.system.slug));

			// ── Choices[] group lifecycle ───────────────────────────────────────────
			bindAll(root, ".playbook-choices-add-group", "click", () => {
				const choices = foundry.utils.deepClone(item.system.choices ?? []);
				choices.push(CG.newGroup(`choices-${choices.length}`));
				item.update({ "system.choices": choices });
			});
			bindAll(root, ".playbook-choices-remove-group", "click", ev => {
				const choices = foundry.utils.deepClone(item.system.choices ?? []);
				choices.splice(Number(ev.currentTarget.dataset.index), 1);
				item.update({ "system.choices": choices });
			});

			// ── Backgrounds ─────────────────────────────────────────────────────────
			const backgrounds = () => item.system.backgrounds ?? [];
			const setBackgrounds = list => item.update({ "system.backgrounds": list });
			const bgIndex = ev => Number(ev.currentTarget.dataset.index);
			bindAll(root, ".playbook-background-add", "click",    ()  => setBackgrounds(PE.addBackground(backgrounds())));
			bindAll(root, ".playbook-background-remove", "click", ev  => setBackgrounds(PE.removeBackground(backgrounds(), bgIndex(ev))));
			bindAll(root, ".playbook-background-up", "click",     ev  => setBackgrounds(PE.moveBackground(backgrounds(), bgIndex(ev), -1)));
			bindAll(root, ".playbook-background-down", "click",   ev  => setBackgrounds(PE.moveBackground(backgrounds(), bgIndex(ev), 1)));
			bindAll(root, ".playbook-background-field", "change", ev  => {
				const el = ev.currentTarget;
				setBackgrounds(PE.setBackgroundField(backgrounds(), Number(el.dataset.index), el.dataset.field, el.value));
			});
			bindAll(root, ".playbook-background-toggle-choices", "click", ev => {
				const i = bgIndex(ev);
				const list = foundry.utils.deepClone(backgrounds());
				if (!list[i]) return;
				list[i].choices = list[i].choices ? null : CG.newGroup(list[i].slug || `background-${i}`);
				setBackgrounds(list);
			});
			bindAll(root, ".playbook-background-move-add", "click", ev => {
				const i = bgIndex(ev); // capture before the async picker (ev.currentTarget clears after the handler)
				this._pickReference("move", slug => setBackgrounds(PE.addBackgroundMove(backgrounds(), i, slug)));
			});
			bindAll(root, ".playbook-background-move-remove", "click", ev =>
				setBackgrounds(PE.removeBackgroundMove(backgrounds(), Number(ev.currentTarget.dataset.index), ev.currentTarget.dataset.slug)));

			// ── Origin ───────────────────────────────────────────────────────────────
			const origin = () => item.system.origin ?? [];
			const setOrigin = list => item.update({ "system.origin": list });
			const oIndex = ev => Number(ev.currentTarget.dataset.index);
			bindAll(root, ".playbook-origin-add", "click",    ()  => setOrigin(PE.addOrigin(origin())));
			bindAll(root, ".playbook-origin-remove", "click", ev  => setOrigin(PE.removeOrigin(origin(), oIndex(ev))));
			bindAll(root, ".playbook-origin-up", "click",     ev  => setOrigin(PE.moveOrigin(origin(), oIndex(ev), -1)));
			bindAll(root, ".playbook-origin-down", "click",   ev  => setOrigin(PE.moveOrigin(origin(), oIndex(ev), 1)));
			bindAll(root, ".playbook-origin-region", "change", ev => setOrigin(PE.setOriginRegion(origin(), oIndex(ev), ev.currentTarget.value)));
			bindAll(root, ".playbook-origin-names", "change", ev => {
				const names = ev.currentTarget.value.split("\n").map(s => s.trim()).filter(Boolean);
				setOrigin(PE.setOriginNames(origin(), oIndex(ev), names));
			});

			// ── Special possessions ───────────────────────────────────────────────────
			const sp = () => item.system.specialPossessions ?? null;
			const setSp = value => item.update({ "system.specialPossessions": value });
			bindAll(root, ".playbook-possessions-toggle", "click", () =>
				setSp(sp() ? null : PE.blankSpecialPossessions()));
			bindAll(root, ".playbook-possessions-field", "change", ev => {
				const el = ev.currentTarget;
				const value = el.type === "number" ? (el.value ? Number(el.value) : 0) : el.value;
				setSp(PE.setSpecialPossessionsField(sp(), el.dataset.field, value));
			});
			bindAll(root, ".playbook-possessions-add", "click", () =>
				this._pickReference("possession", slug => setSp(PE.addPossession(sp(), slug))));
			bindAll(root, ".playbook-possessions-remove", "click", ev =>
				setSp(PE.removePossession(sp(), ev.currentTarget.dataset.slug)));
			bindAll(root, ".playbook-possessions-preselected", "change", ev =>
				setSp(PE.togglePreselected(sp(), ev.currentTarget.dataset.slug, ev.currentTarget.checked)));

			// ── Moves / starting moves ─────────────────────────────────────────────────
			bindAll(root, ".playbook-moves-add", "click", () =>
				this._pickReference("move", slug => item.update({ "system.moves": PE.addRef(item.system.moves, slug) })));
			bindAll(root, ".playbook-move-remove", "click", ev => {
				const slug = ev.currentTarget.dataset.slug;
				item.update({
					"system.moves":         PE.removeRef(item.system.moves, slug),
					"system.startingMoves": PE.removeRef(item.system.startingMoves, slug),
				});
			});
			bindAll(root, ".playbook-move-starting", "change", ev =>
				item.update({ "system.startingMoves": PE.toggleInSet(item.system.startingMoves, ev.currentTarget.dataset.slug, ev.currentTarget.checked) }));
			bindAll(root, ".playbook-ref-open", "click", ev => this._openReference(ev.currentTarget.dataset.kind, ev.currentTarget.dataset.slug));

			// ── Grants: followers + inserts ────────────────────────────────────────────
			bindAll(root, ".playbook-followers-add", "click", () =>
				this._pickReference("follower", slug => item.update({ "system.followers": PE.addRef(item.system.followers, slug) })));
			bindAll(root, ".playbook-follower-remove", "click", ev =>
				item.update({ "system.followers": PE.removeRef(item.system.followers, ev.currentTarget.dataset.slug) }));
			bindAll(root, ".playbook-inserts-add", "click", () =>
				this._pickReference("insert", slug => item.update({ "system.inserts": PE.addRef(item.system.inserts, slug) })));
			bindAll(root, ".playbook-insert-remove", "click", ev =>
				item.update({ "system.inserts": PE.removeRef(item.system.inserts, ev.currentTarget.dataset.slug) }));

			// ── Introductions ──────────────────────────────────────────────────────────
			// step3 is a plain string (name-bound textarea via submitOnChange); step4/step6 groups
			// toggle through .playbook-group-toggle above.
		}

		// -- Reference resolution / picker --------------------------------------------

		// Config per reference kind: which repo lists it, and how to create + open a new one.
		static #KINDS = {
			move:       { type: "move",       pack: "stonetop.moves",       title: "Add move",       prefix: "custom-move" },
			follower:   { type: "follower",   pack: "stonetop.followers",   title: "Add follower",   prefix: "custom-follower" },
			insert:     { type: "insert",     pack: "stonetop.inserts",     title: "Add insert",     prefix: "custom-insert" },
			possession: { type: "possession", pack: "stonetop.possessions", title: "Add possession", prefix: "custom-possession" },
		};

		async _summariesFor(kind) {
			if (kind === "move") {
				const index = await new FoundryMoveRepository().buildSlugIndex();
				return [...index.values()].map(m => ({ slug: m.slug, name: m.name }))
					.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
			}
			const repo = kind === "follower"   ? new FoundryFollowerRepository()
			           : kind === "insert"     ? new FoundryInsertRepository()
			           : new FoundryPossessionRepository();
			return repo.listSummaries();
		}

		// DialogV2: pick an existing item by slug, or create a new one. Calls `onPick(slug)` with the
		// chosen/created slug; a dismissed dialog is a no-op.
		async _pickReference(kind, onPick) {
			const cfg       = StonetopPlaybookSheet.#KINDS[kind];
			const summaries = await this._summariesFor(kind);
			const esc       = s => foundry.utils.escapeHTML?.(s ?? "") ?? (s ?? "");
			const options   = summaries.map(m => `<option value="${esc(m.slug)}">${esc(m.name)}</option>`).join("");
			const content   = `
				<p>${esc(cfg.title)}:</p>
				<select name="ref" style="width:100%">
					<option value="">— Create new —</option>
					${options}
				</select>`;
			const slug = await foundry.applications.api.DialogV2.prompt({
				window: { title: cfg.title },
				content,
				ok: { label: "Add", callback: (_event, button) => button.form.elements.ref?.value ?? "" },
				rejectClose: false,
			});
			if (slug === null || slug === undefined) return;   // dismissed
			if (slug) return onPick(slug);
			const created = await this._createReference(kind);
			if (created) await onPick(created);
		}

		// Create a world item of the kind, stamp a slug, open its sheet, and return the slug.
		async _createReference(kind) {
			const cfg  = StonetopPlaybookSheet.#KINDS[kind];
			const slug = `${cfg.prefix}-${foundry.utils.randomID(8)}`;
			const doc  = await Item.create({ name: `New ${cfg.type}`, type: cfg.type, system: { slug } });
			if (!doc) return null;
			doc.sheet?.render(true);
			return slug;
		}

		// Open the referenced item's sheet (compendium or world) — moves resolve via the move repo;
		// the others via their pack/world stores.
		async _openReference(kind, slug) {
			if (!slug) return;
			if (kind === "move") {
				const repo = new FoundryMoveRepository();
				const m    = (await repo.buildSlugIndex()).get(slug);
				if (m) (await repo.getReferencedMoveDocument(m.id))?.sheet?.render(true);
				return;
			}
			const repo = kind === "follower"   ? new FoundryFollowerRepository()
			           : kind === "insert"     ? new FoundryInsertRepository()
			           : new FoundryPossessionRepository();
			const doc = await repo.findBySlug?.(slug);
			doc?.sheet?.render?.(true);
		}
	};
}
