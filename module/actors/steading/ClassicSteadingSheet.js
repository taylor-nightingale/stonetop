// "Classic" steading sheet — a PORT of Taylor Nightingale's actual steading sheet (his vendored
// template at templates/classic/actor/steading.hbs + his scoped panel-frame CSS in styles/classic.css),
// wired to THIS fork's data via an adapter. Same architecture as ClassicCharacterSheet: override the
// template, build HIS SteadingSnapshot shape from fork data in getData, and port his interaction
// handlers in activateListeners (capture-phase delegated, bound to his vendored data-* contract,
// calling the fork write API directly). Selected per-actor or as the world default ("classic" style).
//
// getData strategy: the fork base StonetopSteadingSheet.getData() builds the FORK steading snapshot
// onto ctx.stonetop (and sets ctx.stonetop.rollMode). His template reads a DIFFERENT, non-overlapping
// shape (fortunes.options[], attributes.{size,…}.options[], assets.coinage[], neighbors.people[],
// residents[].id, improvementColumns, content[], placesOfInterest[].key/value/index). We reshape the
// fork snapshot into his shape; sections with no fork source (content, neighbor places, resident
// names/traits, homefront moves) render as render-safe empty states (deferred follow-ups).
import { enrichRichTokens } from "../../classic/classic-support.js";
import { activateSteppers } from "../../classic/classic-ui.js";

const CLASSIC_STEADING_TEMPLATE = "systems/stonetop/templates/classic/actor/steading.hbs";
const FLAG_SCOPE = "stonetop";

// His rating tables (from SteadingDefaults). The classic template renders these option LABELS and
// stores the selected INDEX; his bonus stats use bonuses [-1,0,1,2,3] so the index == value + 1.
const BONUS_LABELS = ["-1", "+0", "+1", "+2", "+3"];
const DEFENSE_LABELS = [
	"-1 <em>feeble</em>", "+0 <em>mediocre</em>", "+1 <em>strong</em>",
	"+2 <em>formidable</em>", "+3 <em>legendary</em>",
];
const SIZE_LABELS = [
	"<em>hamlet</em> (&lt;50 people)", "<em>village</em> (150–350 people)",
	"<em>town</em> (500–1500 people)", "<em>city</em> (2500+ people)",
];
const SIZE_ORDER = ["hamlet", "village", "town", "city"];
const NOTES = {
	fortunes:   "Starts at +1",
	surplus:    "Starts at 1",
	size:       "Starts at <em>village</em>",
	population: "Starts at +0",
	prosperity: "Starts at +0",
	defenses:   "Starts at +0",
};
const DEBILITY_TEXT = [
	{ slug: "diminished", description: "<em>diminished</em>, by injury/sickness/doubt", note: "disadvantage to Deploy, Muster, or Pull Together" },
	{ slug: "lacking",    description: "<em>lacking</em>, due to shortages/hoarding/distrust", note: "treat Prosperity as if it's 1 lower than it is" },
	{ slug: "malcontent", description: "<em>malcontent</em>, from fear/anger/despair", note: "Fortunes reset to +0 each season, not +1; folks need Persuading more often than usual" },
];
// Flag list keys his inline-edit add/remove/rename controls operate on, by his data-attr value.
const ATTR_LIST_KEY = { prosperity: "resources", defenses: "fortifications" };

const normalizeRollMode = m => (["adv", "dis"].includes(m) ? m : "normal");

// Reproduce SteadingSnapshot's derived-field column splitter (his ctor computes npcTraitColumns).
function splitIntoColumns(items, columnCount) {
	const rowsPerColumn = Math.ceil(items.length / columnCount) || 1;
	return Array.from({ length: columnCount }, (_, i) =>
		items.slice(i * rowsPerColumn, (i + 1) * rowsPerColumn));
}

// His improvements tab lays the groups out across three columns (SteadingSnapshot.splitIntoImprovementColumns).
function splitIntoImprovementColumns(items) {
	const third = Math.ceil(items.length / 3);
	return { left: items.slice(0, third), middle: items.slice(third, third * 2), right: items.slice(third * 2) };
}

export function createClassicSteadingSheetClass(StonetopSteadingSheet) {
	return class ClassicSteadingSheet extends StonetopSteadingSheet {
		static get defaultOptions() {
			const opts = super.defaultOptions;
			return foundry.utils.mergeObject(opts, {
				// Drop the fork's CSS-hook classes so stonetop.css / pbta CSS don't bleed onto the Classic
				// sheet; classic.css styles it solely via `:scope.steading` under the `.stonetop-classic` root.
				classes: [...opts.classes.filter(c => c !== "stonetop" && c !== "pbta"), "stonetop-classic"],
				template: CLASSIC_STEADING_TEMPLATE,
				// His radios carry name="stonetop-*" (not system paths); persisting them via native form
				// submit would write garbage. Everything persists through the delegated listeners below.
				submitOnChange: false,
				tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "overview" }],
			});
		}

		/** @override - the fork base defines `get template()`, which wins over options.template. */
		get template() {
			return CLASSIC_STEADING_TEMPLATE;
		}

		/** @override - the Classic (Taylor-faithful) sheet drops the fork's Ledger header
		 *  button, which the base adds in _getHeaderButtons. */
		_getHeaderButtons() {
			return super._getHeaderButtons().filter(b => b.class !== "stonetop-ledger-button");
		}

		/** @override - produce HIS SteadingSnapshot shape from the fork snapshot the base already built. */
		async getData(options) {
			const ctx = await super.getData(options);          // ctx.stonetop = FORK snapshot (+ rollMode)
			ctx.stonetop = this._buildClassicSteadingContext(ctx.stonetop);
			return ctx;
		}

		// Reshape the already-built FORK steading snapshot (`fork`) into his SteadingSnapshot shape.
		// Synchronous — `fork` is the snapshot the base getData already awaited.
		_buildClassicSteadingContext(fork) {
			const sys = fork.system ?? {};
			const clampIdx = i => Math.max(0, Math.min(BONUS_LABELS.length - 1, i));
			const opts = (labels, current) => labels.map((label, i) => ({ label, index: i, selected: i === current }));

			const fortunesIdx   = clampIdx((sys.stats?.fortunes?.value ?? 1) + 1);
			const populationIdx = clampIdx((sys.attributes?.population?.value ?? 0) + 1);
			const prosperityIdx = clampIdx((sys.attributes?.prosperity?.value ?? 0) + 1);
			const defensesIdx   = clampIdx((sys.stats?.defenses?.value ?? 0) + 1);
			const sizeIdx       = Math.max(0, SIZE_ORDER.indexOf(fork.size ?? "village"));
			const surplus       = sys.attributes?.surplus?.value ?? 1;

			const debOpts = sys.attributes?.debilities?.options ?? {};
			const debilities = DEBILITY_TEXT.map(d => ({ ...d, active: !!debOpts[d.slug]?.value }));

			// His template shows Resources / Defenses / Assets as inline-editable name strings.
			const nameStrings = list => (list ?? []).map(x => x?.name ?? "");

			const silver = fork.silver ?? { purses: 0, handfuls: 0, coins: 0 };
			const gold   = fork.gold   ?? { purses: 0, handfuls: 0, coins: 0 };
			const coinage = [
				{ title: "Silver", purses: silver.purses ?? 0, handfuls: silver.handfuls ?? 0, coins: silver.coins ?? 0 },
				{ title: "Gold",   purses: gold.purses   ?? 0, handfuls: gold.handfuls   ?? 0, coins: gold.coins   ?? 0 },
			];

			// His rosters key edits by `id`; the fork lists are positional, so id == array index.
			const residents = (fork.residents ?? []).map((r, i) => ({
				id: i, name: r?.name ?? "", occupation: r?.occupation ?? "", traits: r?.traits ?? "",
			}));
			const neighborPeople = (fork.neighbors ?? []).map((n, i) => ({
				id: i, name: n?.name ?? "", occupation: n?.occupation ?? "", traits: n?.traits ?? "", home: n?.home ?? "",
			}));
			const placesOfInterest = (fork.places ?? []).map((p, i) => ({
				key: p?.letter ?? "", value: p?.name ?? "", index: i,
			}));

			// Stash the effective fork lists so the inline add/remove/rename listeners can clone + write
			// them (re-stashed every render).
			this._classicStash = {
				resources:      fork.resources      ?? [],
				fortifications: fork.fortifications ?? [],
				assets:         fork.assets         ?? [],
				residents:      fork.residents      ?? [],
				neighbors:      fork.neighbors      ?? [],
				places:         fork.places         ?? [],
			};

			// Improvements: map the fork's improvements[] (built from its hardcoded catalog + custom
			// drops) into his ChoiceGroup column shape — each requirement item becomes a single-box
			// track keyed req-<flatIndex>, so his fill-track checkbox collapses to a per-index toggle
			// bridged to the fork's _onImprovementReq (see activateListeners).
			const improvements = this._buildClassicImprovements(fork.improvements);

			// STUB sections — no fork data source yet (render-safe empties; their edit listeners are
			// deliberate gaps until the follow-up): residentNames/Traits, neighbors.places, content,
			// homefront moves.
			const residentTraits = [];
			return {
				fortunes:   { note: NOTES.fortunes, current: fortunesIdx, options: opts(BONUS_LABELS, fortunesIdx) },
				surplus:    { note: NOTES.surplus, current: surplus },
				attributes: {
					size:       { note: NOTES.size,       options: opts(SIZE_LABELS, sizeIdx),       items: [] },
					population: { note: NOTES.population, options: opts(BONUS_LABELS, populationIdx), items: [] },
					prosperity: { note: NOTES.prosperity, options: opts(BONUS_LABELS, prosperityIdx), items: nameStrings(fork.resources) },
					defenses:   { note: NOTES.defenses,   options: opts(DEFENSE_LABELS, defensesIdx), items: nameStrings(fork.fortifications) },
				},
				debilities,
				rollMode:           normalizeRollMode(fork.rollMode),
				assets:             { items: nameStrings(fork.assets), coinage },
				residents,
				residentNames:      "",
				residentTraits,
				residentTraitsText: residentTraits.join("\n"),
				npcTraitColumns:    splitIntoColumns(residentTraits, 5),
				neighbors:          { people: neighborPeople, places: [] },
				improvements,
				improvementColumns: splitIntoImprovementColumns(improvements),
				moves:              null,
				placesOfInterest,
				content:            [],
				notes:              fork.notes ?? "",
			};
		}

		// Map the fork's improvements[] into his choice-group columns. Each fork improvement becomes a
		// { slug, list } group: a header EntryRow (label + effect/flavor) then one EntryRow per requirement
		// item, each with a single-box track keyed `req-<flatIndex>` (the item's flat r[] index). His
		// choice-row renders these as labelled checkboxes; the listener toggles the fork r[] by index.
		_buildClassicImprovements(improvements) {
			return (improvements ?? []).map(imp => {
				const list = [];
				// Header: improvement name + its in-fiction FLAVOR. The mechanical EFFECT is shown LAST
				// (after the requirements), matching his layout — they are two distinct rows, not merged.
				list.push({
					type: "entry", slug: imp.slug,
					content: { title: imp.label ?? imp.slug, titleNote: null, subtitle: null, subtitleNote: null, text: imp.flavor || null },
					track: null, input: null, followers: [], inlineDisplay: false, outfitItems: [],
				});
				(imp.sections ?? []).forEach((section, sIdx) => {
					// Requirement-group heading (e.g. "**Requires** either one of these:", "And then: …") —
					// a track-less entry, rendered as its own line by his choice-row, preserving the
					// either-one-of/and-then/all-of grouping that structures the improvement.
					if (section.heading) {
						list.push({
							type: "entry", slug: `head-${imp.slug}-${sIdx}`,
							content: { title: null, titleNote: null, subtitle: null, subtitleNote: null, text: section.heading },
							track: null, input: null, followers: [], inlineDisplay: false, outfitItems: [],
						});
					}
					for (const item of (section.items ?? [])) {
						list.push({
							type: "entry", slug: `req-${item.index}`,
							content: { title: null, titleNote: null, subtitle: null, subtitleNote: null, text: item.label ?? "" },
							track: { slug: `req-${item.index}`, checks: [!!item.checked], requires: null },
							input: null, followers: [], inlineDisplay: false, outfitItems: [],
						});
					}
				});
				if (imp.effect) {
					list.push({
						type: "entry", slug: `effect-${imp.slug}`,
						content: { title: null, titleNote: null, subtitle: null, subtitleNote: null, text: imp.effect },
						track: null, input: null, followers: [], inlineDisplay: false, outfitItems: [],
					});
				}
				return { slug: imp.slug, list };
			});
		}

		// ── Listeners ──────────────────────────────────────────────────────────────────────────────
		// Mirror ClassicCharacterSheet: the fork base activateListeners queries the Minimal DOM and throws
		// on his template (Foundry swallows it → silent render failure), so call ONLY the appv1 base, then
		// wire his vendored DOM directly to the fork write API.
		activateListeners(html) {
			foundry.appv1.sheets.ActorSheet.prototype.activateListeners.call(this, html);
			activateSteppers(html[0]);                          // ▲▼ on .stonetop-step (surplus + coinage)
			if (!this.isEditable) return;
			const root = html[0];
			const ta = this._stonetopSteading;

			const intVal = el => parseInt(el.value, 10);

			// ── Header: rating radios (fortunes / size / population / prosperity / defenses) + roll mode ──
			root.addEventListener("change", ev => {
				const input = ev.target.closest("input.steading-box-input");
				if (!input) return;
				const name = input.name;
				if (name === "stonetop-fortunes") {
					ev.stopPropagation();
					ta.setSystemValue("stats.fortunes.value", intVal(input) - 1);
				} else if (name === "stonetop-roll-mode") {
					ev.stopPropagation();
					this.actor.setFlag(FLAG_SCOPE, "rollMode", normalizeRollMode(input.value)).then(() => this.render(false));
				} else if (input.dataset.attr) {
					ev.stopPropagation();
					const attr = input.dataset.attr;
					if (attr === "size") ta.setFlags({ size: SIZE_ORDER[intVal(input)] ?? "village" });
					else {
						const path = attr === "defenses" ? "stats.defenses.value" : `attributes.${attr}.value`;
						ta.setSystemValue(path, intVal(input) - 1);
					}
				}
			}, true);

			// Surplus (number input)
			root.addEventListener("change", ev => {
				const input = ev.target.closest(".steading-surplus-input");
				if (!input) return;
				ev.stopPropagation();
				ta.setSystemValue("attributes.surplus.value", Number.isFinite(intVal(input)) ? intVal(input) : 0);
			}, true);

			// Debilities (checkboxes)
			root.addEventListener("change", ev => {
				const cb = ev.target.closest(".steading-circle-input");
				if (!cb) return;
				ev.stopPropagation();
				ta.setSystemValue(`attributes.debilities.options.${cb.dataset.slug}.value`, cb.checked);
			}, true);

			// Improvements: his choice-row req checkboxes (single-box tracks keyed req-<flatIndex>) →
			// toggle the fork's flat requirement boolean improvements[<slug>].r[<flatIndex>].
			root.addEventListener("change", ev => {
				const cb = ev.target.closest('.stonetop-cg-track[data-cg-context="improvement"]');
				if (!cb) return;
				ev.stopPropagation();
				const m = /^req-(\d+)$/.exec(cb.dataset.cgOption ?? "");
				if (!m) return;
				this._onImprovementReq(cb.dataset.cgGroup, parseInt(m[1], 10), cb.checked);
			}, true);

			// Stat-panel roll buttons (Fortunes / Population / Prosperity / Defenses; Surplus is not a roll stat)
			root.addEventListener("click", ev => {
				const btn = ev.target.closest(".steading-stat-roll[data-roll]");
				if (!btn) return;
				const stat = btn.dataset.roll;
				if (!["fortunes", "defenses", "population", "prosperity"].includes(stat)) return;
				ev.stopPropagation();
				this._onSteadingRoll(stat[0].toUpperCase() + stat.slice(1), stat);
			}, true);

			// ── Overview: Resources / Defenses extras (prosperity↔resources, defenses↔fortifications) ──
			root.addEventListener("click", ev => {
				const addBtn = ev.target.closest(".stonetop-attr-extra-add");
				if (addBtn) {
					ev.stopPropagation();
					return this._classicListPush(ATTR_LIST_KEY[addBtn.dataset.attr], { name: "", checked: false });
				}
				const rmBtn = ev.target.closest(".stonetop-attr-extra-remove");
				if (rmBtn) {
					ev.stopPropagation();
					return this._classicListRemove(ATTR_LIST_KEY[rmBtn.dataset.attr], parseInt(rmBtn.dataset.index, 10));
				}
			}, true);
			root.addEventListener("change", ev => {
				const inp = ev.target.closest(".stonetop-attr-extra");
				if (!inp) return;
				ev.stopPropagation();
				this._classicListRename(ATTR_LIST_KEY[inp.dataset.attr], parseInt(inp.dataset.index, 10), inp.value);
			}, true);

			// ── Overview: Assets list + coinage ──
			root.addEventListener("click", ev => {
				const addBtn = ev.target.closest(".stonetop-asset-item-add");
				if (addBtn) { ev.stopPropagation(); return this._classicListPush("assets", { name: "", checked: false }); }
				const rmBtn = ev.target.closest(".stonetop-asset-item-remove");
				if (rmBtn) { ev.stopPropagation(); return this._classicListRemove("assets", parseInt(rmBtn.dataset.index, 10)); }
			}, true);
			root.addEventListener("change", ev => {
				const inp = ev.target.closest(".stonetop-asset-item");
				if (inp) { ev.stopPropagation(); return this._classicListRename("assets", parseInt(inp.dataset.index, 10), inp.value); }
				const coin = ev.target.closest(".stonetop-coinage-input");
				if (coin) {
					ev.stopPropagation();
					const idx = parseInt(coin.dataset.index, 10);
					this._onCurrencyChange(idx === 0 ? "silver" : "gold", coin.dataset.field, parseInt(coin.value, 10) || 0);
				}
			}, true);

			// ── Residents tab ──
			root.addEventListener("click", ev => {
				if (ev.target.closest(".stonetop-resident-add")) {
					ev.stopPropagation();
					return this._classicListPush("residents", { name: "", occupation: "", traits: "", relations: "", notes: "", checked: false });
				}
				const rm = ev.target.closest(".stonetop-resident-remove");
				if (rm) { ev.stopPropagation(); return this._classicListRemove("residents", parseInt(rm.dataset.id, 10)); }
			}, true);
			root.addEventListener("change", ev => {
				const inp = ev.target.closest(".stonetop-resident-name, .stonetop-resident-occupation, .stonetop-resident-traits");
				if (!inp) return;
				ev.stopPropagation();
				const field = inp.classList.contains("stonetop-resident-name") ? "name"
					: inp.classList.contains("stonetop-resident-occupation") ? "occupation" : "traits";
				this._onResidentChange(parseInt(inp.dataset.id, 10), field, inp.value);
			}, true);

			// ── Neighbors tab (people roster) ──
			root.addEventListener("click", ev => {
				if (ev.target.closest(".stonetop-neighbor-person-add")) {
					ev.stopPropagation();
					return this._classicListPush("neighbors", { name: "", occupation: "", traits: "", home: "", relations: "", notes: "", checked: false });
				}
				const rm = ev.target.closest(".stonetop-neighbor-person-remove");
				if (rm) { ev.stopPropagation(); return this._classicListRemove("neighbors", parseInt(rm.dataset.id, 10)); }
			}, true);
			root.addEventListener("change", ev => {
				const inp = ev.target.closest(".stonetop-neighbor-person-name, .stonetop-neighbor-person-occupation, .stonetop-neighbor-person-traits, .stonetop-neighbor-person-home");
				if (!inp) return;
				ev.stopPropagation();
				const field = inp.classList.contains("stonetop-neighbor-person-name") ? "name"
					: inp.classList.contains("stonetop-neighbor-person-occupation") ? "occupation"
					: inp.classList.contains("stonetop-neighbor-person-home") ? "home" : "traits";
				this._onNeighborChange(parseInt(inp.dataset.id, 10), field, inp.value);
			}, true);

			// ── Notes tab: places of interest + free notes ──
			root.addEventListener("click", ev => {
				if (!ev.target.closest(".stonetop-place-add")) return;
				ev.stopPropagation();
				const places = foundry.utils.deepClone(this._classicStash?.places ?? []);
				places.push({ letter: String.fromCharCode(65 + places.length), name: "" });
				ta.setFlags({ places });
			}, true);
			root.addEventListener("change", ev => {
				const place = ev.target.closest(".stonetop-place-field");
				if (place) { ev.stopPropagation(); return this._onPlaceChange(parseInt(place.dataset.index, 10), place.value); }
				const notes = ev.target.closest(".stonetop-notes");
				if (notes) { ev.stopPropagation(); return this._onNotesChange(notes.value); }
			}, true);
		}

		// ── Inline-list helpers (clone the stashed effective list, mutate, persist) ─────────────────
		async _classicListPush(key, blank) {
			if (!key) return;
			const list = foundry.utils.deepClone(this._classicStash?.[key] ?? []);
			list.push(blank);
			await this._stonetopSteading.setFlags({ [key]: list });
		}
		async _classicListRemove(key, index) {
			if (!key || !Number.isInteger(index)) return;
			const list = foundry.utils.deepClone(this._classicStash?.[key] ?? []);
			if (index < 0 || index >= list.length) return;
			list.splice(index, 1);
			await this._stonetopSteading.setFlags({ [key]: list });
		}
		async _classicListRename(key, index, value) {
			if (!key || !Number.isInteger(index)) return;
			const list = foundry.utils.deepClone(this._classicStash?.[key] ?? []);
			if (!list[index]) return;
			list[index] = { ...list[index], name: value };
			await this._stonetopSteading.setFlags({ [key]: list });
		}

		/** @override - strip the fork's master edit-toggle wrench (his template is always-editable, with
		 *  its own controls), then upgrade `.stonetop-rich` markdown tokens (debility text) to links. */
		async _render(force, options) {
			await super._render(force, options);
			const root = this.element?.[0] ?? this.element;
			root?.querySelector?.(".window-header .stonetop-header-toggle")?.remove();
			await enrichRichTokens(root, { rollData: this.actor?.getRollData?.() ?? {} });
		}
	};
}
