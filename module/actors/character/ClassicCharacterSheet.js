// "Classic" character sheet — a PORT of Taylor Nightingale's actual character sheet (his templates,
// vendored under templates/classic/, + his scoped CSS in styles/classic.css), wired to THIS fork's
// flag-based data via an adapter. It overrides the template, builds his CharacterSnapshot shape from
// fork data in getData, and (later) ports his interaction handlers. Selected per-actor or as the
// world default ("classic" sheet style).
//
// getData strategy: the fork base StonetopCharacterSheet.getData() already (a) builds the FORK
// CharacterSnapshot onto ctx.stonetop and (b) populates ctx.stonetop.followers via the real
// playbook doc. We REUSE that built snapshot (no second async build) and RESHAPE it into his
// CharacterSnapshot shape section-by-section: playbook / moves / outfit+possessions / arcana /
// followers / inserts. Shapes diverge per-section (his uses a ChoiceGroup abstraction, selection{}
// on moves, separate outfit/possessions, etc.); each _build*/_reshape* below documents the mapping
// and any fork→his gaps. His interaction handlers are ported in activateListeners below (task 2d):
// capture-phase delegated handlers on html[0], each bound to his vendored data-* contract and
// calling the fork write API (this.actor.typedActor.* setters / actor.update / setFlag) directly.
import { renderMarkdown, enrichRichTokens } from "../../classic/classic-support.js";
import { activateEditToggles, activateSteppers, activateComboBoxes } from "../../classic/classic-ui.js";
import { slugify, escHtml } from "../../utils/strings.js";
import { bringDialogToFront } from "../../utils/front-on-open.js";
import { deletionEntry } from "../../utils/foundry-compat.js";
import { INTRO_PLAYBOOK_DATA } from "../../dialogs/introductions-data.js";

const CLASSIC_CHARACTER_TEMPLATE = "systems/stonetop/templates/classic/actor/character.hbs";

// Taylor's sidebar move order, per category. The fork's snapshot reorders these (basic moves are
// alphabetized with Aid first; special/follower follow item order) for its Minimal sheet
// (StonetopCharacter.js), but Taylor's sheet shows them in his pack's native order. The Classic sheet
// is a faithful port of his sheet, so re-impose his order here, matched by the fork's move NAME (which
// can differ slightly from Taylor's labels — e.g. "Advantage & Disadvantage", "Death's Door"). Any
// fork-only move not in a list (basic "Seek Insight", follower "Followers in Fights" — both absent from
// Taylor's) keeps its relative order and falls to the end (see _orderByNames).
const CLASSIC_SIDEBAR_MOVE_ORDER = {
	basic: [
		"Clash",
		"Persuade (vs. NPCs)",
		"Aid",
		"Interfere",
		"Let Fly",
		"Defend",
		"Defy Danger",
		"Persuade (vs. PCs)",
		"Know Things",
	],
	special: [
		"Burn Brightly",
		"End of Session",
		"Advantage & Disadvantage",
		"Death's Door",
	],
	follower: [
		"Strengthen Your Bond",
		"Order Followers",
	],
};

export function createClassicCharacterSheetClass(StonetopCharacterSheet) {
	return class ClassicCharacterSheet extends StonetopCharacterSheet {
		static get defaultOptions() {
			const opts = super.defaultOptions;
			return foundry.utils.mergeObject(opts, {
				// Drop the fork's CSS-hook classes (stonetop / pbta) so the Minimal sheet's stonetop.css
				// and the pbta base CSS don't bleed onto the Classic sheet. classic.css styles it solely
				// via the `.stonetop-classic` root (its `.stonetop.sheet …` selectors were rebased to it).
				classes: [...opts.classes.filter(c => c !== "stonetop" && c !== "pbta"), "stonetop-classic"],
				template: CLASSIC_CHARACTER_TEMPLATE,
				tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "playbook" }],
			});
		}

		/** @override - the fork base defines `get template()`, which wins over options.template;
		 *  point it at his vendored Classic template. */
		get template() {
			return CLASSIC_CHARACTER_TEMPLATE;
		}

		/** @override - produce HIS CharacterSnapshot shape (context.stonetop) from fork data.
		 *  super.getData() builds the FORK snapshot onto ctx.stonetop (and ctx.stonetop.followers via
		 *  the real playbook doc); we reshape that in place into his shape. */
		async getData(options) {
			const ctx = await super.getData(options);
			// The universal Special/Follower reference moves aren't seeded onto fork characters, so
			// fork.moves never carries those categories. Fetch their compendium definitions here (async)
			// so the synchronous reshape below can synthesize his sidebar lists from them.
			this._classicReferenceMoves = await this._loadClassicReferenceMoves();
			ctx.stonetop = this._buildClassicContext(ctx.stonetop);
			ctx.availablePlaybooks = await this._buildClassicAvailablePlaybooks();
			return ctx;
		}

		// Load the universal Special + Follower reference-move definitions from the items pack. Taylor
		// seeds these onto every character (CharacterMoves.initBasicMoves) so his sidebar shows them; the
		// fork omits that seeding, so the Classic sheet surfaces them read-only from the compendium
		// instead. Returns { special:[], follower:[] } (empty on any failure — the sidebar simply omits
		// the missing category, never throws).
		async _loadClassicReferenceMoves() {
			const repo = this.actor?.typedActor?._moveRepo;
			if (!repo?.getMovesByType) return { special: [], follower: [] };
			try {
				const [special, follower] = await Promise.all([
					repo.getMovesByType("special"),
					repo.getMovesByType("follower"),
				]);
				return { special: special ?? [], follower: follower ?? [] };
			} catch (_) {
				return { special: [], follower: [] };
			}
		}

		/** @override - drop ALL of the fork's added header chrome (New Character, the "Stonetop" jump-to-
		 *  steading shortcut, and the Ledger button) from the window header. Those belong to the Minimal
		 *  sheet / session-zero onboarding flow; the Classic sheet (a faithful port of Taylor's) keeps only
		 *  Foundry's stock controls. Every fork button carries a `stonetop-`-prefixed class, so filter on it. */
		_getHeaderButtons() {
			return super._getHeaderButtons().filter(b => !b.class?.startsWith("stonetop-"));
		}

		// Reshape the already-built FORK snapshot (`fork`) into his CharacterSnapshot shape. Synchronous —
		// `fork` is the snapshot the base getData already awaited, so no section here needs to await.
		// His Classic templates read ONLY these top-level keys (the fork's render-decorations like
		// movesOpen/arcanaOpen/detailsEdit are Minimal-only and intentionally dropped).
		_buildClassicContext(fork) {
			const sys = this.actor.system ?? {};
			const equipment = this._buildClassicEquipment(fork.inventory);
			return {
				name:        this.actor.name,
				// Drives the custom-arcanum / custom-possession authoring affordances (the only edit
				// controls his template surfaces beyond per-field toggles). Gated on ownership rather
				// than a wrench since the Classic sheet has no global edit-mode toggle.
				editable:    this.isEditable,
				playbook:    this._buildClassicPlaybook(fork),      // his PlaybookSnapshot | null (=> picker)
				stats:       fork.stats,                            // already his keyed StatSnapshot {value,name,abbr}
				debilities:  fork.debilities,                       // already his DebilitySnapshot[] {key,name,active}
				vitals:      this._buildClassicVitals(fork),        // wrap fork's string damage into {value}
				moves:       this._buildClassicMoves(fork),         // { categories:[{key,label,note,renderStyle,allowAdditional,moves}] }
				outfit:      equipment.outfit,                      // his OutfitSnapshot | null
				possessions: equipment.possessions,                 // his PossessionsSnapshot | null
				arcana:      this._buildClassicArcana(fork),        // { minor:{title,items,hasOwned}, major:{…} }
				inserts:     this._buildClassicInserts(fork),       // his InsertSnapshot[] (extra tabs)
				followers:   this._buildClassicFollowers(fork),     // flat his FollowerSnapshot[]
				rollMode:    fork.rollMode ?? "normal",
				bio:         sys.description ?? "",
				notes:       sys.notes ?? "",
			};
		}

		// ── VITALS ──────────────────────────────────────────────────────────────────────────────
		// fork.vitals matches his VitalsSnapshot EXCEPT damage is a raw string ("d6"|null); his
		// actor-attributes.hbs reads `vitals.damage.value`, so wrap it. armor/hp.max/damage are
		// COMPUTED (worn-item armor + move bonuses, playbook+move-bonus damage die) — but a manual edit
		// stores an override (flags.<scope>.overrides.*) that _buildVitalsSection prefers, so the value on
		// fork.vitals is already the effective (override-or-computed) one; we just pass it through.
		_buildClassicVitals(fork) {
			const v = fork.vitals ?? {};
			const dieStr = (typeof v.damage === "string" && v.damage) ? v.damage : null;
			return {
				damage: { value: dieStr ?? "" }, // his shape; empty value renders "" exactly like his null
				hp:     { value: Number(v.hp?.value ?? 0), max: Number(v.hp?.max ?? 0) },
				armor:  Number(v.armor ?? 0),
				xp:     { value: Number(v.xp?.value ?? 0), max: Number(v.xp?.max ?? (6 + Number(v.level ?? 1) * 2)) },
				level:  Number(v.level ?? 1),
			};
		}

		// ── PLAYBOOK ────────────────────────────────────────────────────────────────────────────
		// his ChoiceGroup is just { slug, list:[rows] }; rows we synthesize are plain objects matching
		// the shapes choice-row.hbs reads. We never instantiate his classes (not importable from the fork).

		_classicEntryRow(slug, { title = null, titleNote = null, subtitle = null, subtitleNote = null,
		                         text = null, track = null, input = null } = {}) {
			return {
				type: "entry", slug,
				content: { title, titleNote, subtitle, subtitleNote, text },
				track,            // null | { slug, checks:bool[], requires:null }
				input,            // null | { slug, placeholder, value, type:"inline"|"rich" }
				followers: [], inlineDisplay: false, outfitItems: [],
			};
		}

		_classicChoiceRow(options, { inline = false, rowKey = null, radio = true, siblingSlugsCsv = null } = {}) {
			return { type: "choice", options, inline, rowKey, radio, siblingSlugsCsv };
		}

		// his title-image convention, rebased onto the vendored Classic assets
		_classicPlaybookArt(slug) {
			const base = "systems/stonetop/assets/classic/playbooks";
			return slug
				? { img: `${base}/${slug}.png`, titleImg: `${base}/${slug}-title.png` }
				: { img: null, titleImg: null };
		}

		// LORE: fork LoreSection.entries -> his loreGroups (ChoiceGroup[]). Each fork lore ENTRY becomes
		// one ChoiceGroup; each fork lore OPTION becomes an EntryRow (text option -> input box; checkbox
		// option -> track of `max` checks with `count` ticked). The entry title/description ride on the
		// FIRST row's content. (GAP: his pick-row layouts / arcanaPicker / multi-column lore are not
		// reproduced — the fork has no `choices` pack block, only `lore[]`.)
		_buildClassicLoreGroups(lore) {
			const entries = lore?.entries ?? [];
			return entries.map(e => {
				const list = [];
				if (e.title || e.description) {
					list.push(this._classicEntryRow(`${e.slug}-head`, {
						title: e.title ?? null,
						text:  e.description ?? null,
					}));
				}
				for (const o of (e.options ?? [])) {
					if (o.type === "text") {
						list.push(this._classicEntryRow(o.slug, {
							text:  o.description ?? null,
							input: { slug: `${o.slug}-input`, placeholder: null, value: o.textValue ?? "", type: "inline" },
						}));
					} else {
						const max = o.max ?? 1;
						const checks = Array.isArray(o.checks)
							? o.checks
							: Array.from({ length: max }, (_, i) => i < (o.count ?? 0));
						list.push(this._classicEntryRow(o.slug, {
							text:  o.description ?? null,
							track: { slug: o.slug, checks, requires: null },
						}));
					}
				}
				return { slug: e.slug, list };
			});
		}

		// INSTINCT: fork InstinctSection -> his instinctGroup (ChoiceGroup, single ChoiceRow of radio
		// options) + instinctSelected (display string). Fork option = {word, description, value, selected}.
		_buildClassicInstinct(instinct) {
			const opts = instinct?.options ?? [];
			const selected = instinct?.selected ?? "";
			const options = opts.map(o => ({
				slug: o.value,                                  // saved value is the composite "Word — desc"
				text: o.word,
				description: o.description ?? null,
				checked: !!o.selected,
				type: null, fillValue: "",
			}));
			const group = options.length
				? { slug: "instinct", list: [this._classicChoiceRow(options, {
						rowKey: "instinct-row-0", radio: true,
						siblingSlugsCsv: options.map(o => o.slug).join(","),
					})] }
				: null;
			return { instinctGroup: group, instinctSelected: selected };
		}

		// APPEARANCE: fork AppearanceSection.options (lines) -> his appearanceGroup (ChoiceGroup, one
		// ChoiceRow per line; each row a radio set of {value,selected}). lineIdx -> stable rowKey.
		_buildClassicAppearance(appearance) {
			const lines = appearance?.options ?? [];
			if (!lines.length) return null;
			const list = lines.map(line => {
				const options = (line.options ?? []).map(o => ({
					slug: o.value, text: o.value, description: null,
					checked: !!o.selected, type: null, fillValue: "",
				}));
				return this._classicChoiceRow(options, {
					rowKey: `appearance-row-${line.lineIdx}`, radio: true,
					siblingSlugsCsv: options.map(o => o.slug).join(","),
				});
			});
			return { slug: "appearance", list };
		}

		// BACKGROUND: fork BackgroundSection -> his background {selected, options:[{slug,label,description,
		// selected,resource,choices}]}. Core fields map 1:1; `resource` (fork setupResources) + sub-`choices`
		// (fork follower-shaped choices) are GAPs — emitted null so their {{#if}} blocks stay inert.
		_buildClassicBackground(background) {
			const options = (background?.options ?? []).map(b => ({
				slug: b.slug,
				label: b.label,
				description: b.description ?? "",
				selected: !!b.selected,
				resource: null,
				choices: null,
			}));
			return { selected: background?.selected ?? null, options };
		}

		// ORIGIN: fork OriginSection.options use names:[{name,checked}]; his template prints names as bare
		// strings ({{this}}). Flatten to string[] and keep region/selected.
		_buildClassicOrigin(origin) {
			const options = (origin?.options ?? []).map(o => ({
				region: o.region,
				selected: !!o.selected,
				names: (o.names ?? []).map(n => (typeof n === "string" ? n : n.name)),
			}));
			return { selected: origin?.selected ?? null, options };
		}

		// MAIN: assemble his PlaybookSnapshot from the fork snapshot. Returns null (=> picker) when unplaybooked.
		_buildClassicPlaybook(fork) {
			const pb = fork?.playbook ?? null;
			if (!pb) return null;
			const art = this._classicPlaybookArt(pb.slug);
			const { instinctGroup, instinctSelected } = this._buildClassicInstinct(pb.instinct);
			return {
				slug: pb.slug,
				name: pb.name,
				img: art.img,            // vendored Classic art (fork pb.img points at the Minimal-sheet SVG)
				titleImg: art.titleImg,
				description: pb.description ?? null,
				statsNote: pb.statsNote ?? null,
				loreGroups: this._buildClassicLoreGroups(pb.lore),
				instinctGroup,
				instinctSelected,
				appearanceGroup: this._buildClassicAppearance(pb.appearance),
				background: this._buildClassicBackground(pb.background),
				origin: this._buildClassicOrigin(pb.origin),
				introductions: this._buildClassicIntroductions(pb.slug),  // his on-sheet Introductions block
			};
		}

		// ── INTRODUCTIONS ─────────────────────────────────────────────────────────────────────────
		// His playbook tab renders an Introductions block (below the divider): a per-playbook step-3
		// narration prompt + the step-4 "name an NPC" questions + the step-6 "ask your fellow PCs"
		// questions, each a one-check entry row with an inline answer box (his pack: track.max 1,
		// input.type "inline"). The fork keeps the SAME authored prompts in INTRO_PLAYBOOK_DATA
		// (shared with the guided Introductions dialog + the Chronicle), so reshape those into his
		// IntroductionsSnapshot shape { step3, npcGroup:{slug,list}, pcGroup:{slug,list} }.
		// Answers persist to a per-actor store (flags.stonetop.classicIntro.<context>.<slug>)
		// routed through _classicCgRoute — the Classic sheet's OWN store, independent of the
		// GM-driven world Chronicle setting (the two record introductions for different purposes).
		_buildClassicIntroductions(slug) {
			const data = slug ? INTRO_PLAYBOOK_DATA[slug] : null;
			if (!data) return null;
			const stored = this.actor.getFlag("stonetop", "classicIntro") ?? {};
			const rows = (questions, context) => {
				const vals = stored[context] ?? {};
				return (questions ?? []).map(q => {
					const s = slugify(q);
					return this._classicEntryRow(s, {
						text:  q,
						track: { slug: s, checks: [Number(vals[s] ?? 0) > 0] },
						input: { slug: `${s}-input`, placeholder: null, value: vals[`${s}-input`] ?? "", type: "inline" },
					});
				});
			};
			return {
				// Match the guided dialog's lead-in (IntroductionsDialog: "On your third turn, …").
				step3:    `On your <strong>third turn</strong>, ${data.step3}`,
				npcGroup: { slug: "intro-npc", list: rows(data.step4, "intro-npc") },
				pcGroup:  { slug: "intro-pc",  list: rows(data.step6, "intro-pc") },
			};
		}

		/** Persist a Classic-sheet introductions answer — the NPC/PC question's track count or its
		 *  inline text — to the per-actor store _buildClassicIntroductions reads back. Keyed by
		 *  (context, option) like his ChoiceValues, but self-contained (separate from the world
		 *  Chronicle setting). */
		_setClassicIntroValue(context, option, value) {
			return this.actor.setFlag("stonetop", `classicIntro.${context}.${option}`, value);
		}

		// EMPTY-STATE PICKER: {slug,name}[] from the playbook pack (sorted by name).
		async _buildClassicAvailablePlaybooks() {
			try {
				const store = this.actor?.typedActor?._playbookRepo?._store;
				const entries = store ? await store.getAll() : [];
				return entries
					.filter(e => e.type === "playbook" && e.system?.slug)
					.map(e => ({ slug: e.system.slug, name: e.name }))
					.sort((a, b) => a.name.localeCompare(b.name));
			} catch (_) { return []; }
		}

		// ── MOVES ───────────────────────────────────────────────────────────────────────────────
		// Reshape fork.moves (MoveCategorySnapshot[] with fork field names) into his Movelist shape:
		// { categories:[{ key,label,note,renderStyle,allowAdditional, moves:[…his MoveSnapshot fields] }] }.
		// fork.moves keys: playbook|basic|expedition|background|special|follower|homefront|post-death.
		// His sidebar shows universal reference lists; the moves tab shows the rest. Every fork key lands
		// in exactly one bucket, so no category is dropped.
		// GAPs (data absent from fork.moves, not bugs): allowAdditional is never true (no 'other'
		// category in fork.moves), and per-move inline `choices` is always null (fork MoveSnapshot has no
		// `choices`). Both blocks are template-gated, so they render nothing.
		_buildClassicMoves(fork) {
			// His sheet has NO Expedition category (his model lumps expedition with the basics); the fork
			// added a separate one, so drop it entirely from the Classic sheet to match his layout.
			const SIDEBAR_KEYS = new Set(["basic", "special", "follower"]);
			const cats = (fork?.moves ?? []).filter(cat => cat.key !== "expedition");
			// The fork seeds only the universal BASIC reference moves onto characters (ensureStartingMoves
			// covers playbook + basic + expedition, never special/follower), so fork.moves carries no
			// special/follower category to fill his sidebar — those headings would silently vanish. Taylor's
			// sheet shows both as reference lists, so synthesize them from the compendium (read-only —
			// _classicReferenceMoves, loaded in getData) whenever the character owns none. An actor that DID
			// embed special/follower move items keeps its own (richer) fork category instead.
			for (const key of ["special", "follower"]) {
				const owned = cats.find(c => c.key === key);
				if (owned && (owned.moves?.length ?? 0) > 0) continue;   // real owned category wins
				const ref = this._classicReferenceCategory(key);
				if (!ref) continue;
				if (owned) cats[cats.indexOf(owned)] = ref;              // replace an empty fork category…
				else cats.push(ref);                                     // …or append (the sidebar filters by
				                                                         // renderStyle, so list position is moot)
			}
			const categories = cats.map(cat => this._buildClassicMoveCategory(cat, SIDEBAR_KEYS.has(cat.key)));
			// Slug→identity index for the listener pass: the vendored move-group emits data-move-slug
			// (= slugify(name)) + data-owned-id but no compendium id, so the move acquire/resource
			// handlers resolve slug → { name, compendiumId, ownedId } through this map.
			this._classicMoveIndex = new Map();
			for (const cat of categories)
				for (const m of (cat.moves ?? []))
					this._classicMoveIndex.set(m.slug, { name: m.name, compendiumId: m.id, ownedId: m.ownedId });
			return { categories };
		}

		_buildClassicMoveCategory(cat, isSidebar) {
			let moves = (cat.moves ?? []).map(m => this._buildClassicMove(m));
			// The Classic sidebar mirrors Taylor's pack-native move order, not the fork's reordered one.
			const sidebarOrder = CLASSIC_SIDEBAR_MOVE_ORDER[cat.key];
			if (sidebarOrder) moves = _orderByNames(moves, sidebarOrder);
			return {
				key:             cat.key,
				label:           cat.title ?? cat.key,            // fork field is `title`, his template reads `label`
				note:            cat.note ?? null,
				renderStyle:     isSidebar ? "side-bar" : "standard",
				allowAdditional: cat.key === "other",             // never true for fork.moves (no 'other' category)
				moves,
			};
		}

		// Reshape one fork MoveSnapshot -> his MoveSnapshot shape consumed by move-group.hbs (standard)
		// and the character.hbs sidebar loop (side-bar).
		_buildClassicMove(m) {
			// his `selection` {value,max}: fork models acquisition via `owned` + `repeat`.
			const repeatMax = m.repeat?.max ?? 1;
			const value     = m.repeat ? (m.repeat.current ?? 0) : (m.owned ? 1 : 0);
			const selection = { value, max: Math.max(repeatMax, 1) };
			const selectable = !m.locked && value < selection.max;
			const slug = slugify(m.name);
			return {
				id:            m.compendiumId ?? m.id ?? null,   // sidebar data-compendium-id (character.hbs:90)
				ownedId:       m.ownedId ?? null,
				slug,
				name:          m.name ?? slug,
				description:   m.description ?? "",
				rollStat:      m.rollType ?? null,               // RE-KEY rollType -> rollStat (his data-roll)
				isStarting:    !!m.isStarting,
				source:        m.source ?? { type: "" },
				sourceLabel:   m.sourceLabel ?? null,
				selection,
				selectable,
				requirement:   m.requirement ?? null,            // RequirementSnapshot {label,met}; template reads .met
				requiresLabel: m.requiresLabel ?? null,
				resource:      m.resource ?? null,               // fork Resource {current,max,labels,…}; resourceChecks-safe
				choices:       null,                             // fork MoveSnapshot has no `choices` (gated, safe)
			};
		}

		// Build a synthetic fork-shaped MoveCategorySnapshot for the universal Special/Follower reference
		// moves (loaded from the compendium in getData), so _buildClassicMoveCategory can reshape them
		// exactly like a real fork category. Returns null when no definitions loaded (sidebar omits it).
		_classicReferenceCategory(key) {
			const defs = this._classicReferenceMoves?.[key] ?? [];
			if (!defs.length) return null;
			const title = key === "special" ? "Special Moves" : "Follower Moves";
			return { key, title, note: null, moves: defs.map(d => this._classicReferenceMove(d, key)) };
		}

		// One compendium MoveDefinition -> the fork-MoveSnapshot shape _buildClassicMove consumes. These are
		// reference entries, NOT embedded items: ownedId stays null, so the sidebar renders the move name as
		// a click-to-open link (the .stonetop-basic-move-open handler resolves data-compendium-id → the pack
		// doc) without a roll die — matching how his sheet shows un-acquired reference moves.
		_classicReferenceMove(d, key) {
			return {
				id:            d.id,
				compendiumId:  d.id,
				ownedId:       null,
				name:          d.name,
				description:   d.description ?? "",
				rollType:      d.rollType ?? null,
				isStarting:    false,
				source:        { type: key },
				sourceLabel:   null,
				owned:         false,
				repeat:        null,
				locked:        false,
				requirement:   null,
				requiresLabel: null,
				resource:      null,
			};
		}

		// ── EQUIPMENT (outfit + possessions) ──────────────────────────────────────────────────────
		// Reshape the fork's single InventorySnapshot into his two SEPARATE top-level keys. His template
		// reads regularSections/smallSections (OutfitSection[] = {name,items}); the fork stores flat
		// arrays, so we wrap them into sections (outfitSegments re-splits grid/list runs by item.twoCol).
		// Per-item + resource + pool shapes already match, so they pass straight through.
		_buildClassicEquipment(inv) {
			const fo = inv?.outfit ?? null;
			const outfit = fo ? {
				load: {
					loadLevelLight:  !!fo.load?.loadLevelLight,
					loadLevelNormal: !!fo.load?.loadLevelNormal,
					loadLevelHeavy:  !!fo.load?.loadLevelHeavy,
				},
				regularPool: fo.regularPool ?? { current: 0, max: 0, title: null, labels: [] },
				smallPool:   fo.smallPool   ?? { current: 0, max: 0, title: null, labels: [] },
				// Fold the fork's separate "arcana" inventory column in after the regular items (fork
				// regularItems already holds the regular-column arcana, so no double-count).
				regularSections: this._classicOutfitSections([
					...(fo.regularItems ?? []),
					...(fo.arcanaItems ?? []),
				]),
				// Small grid items are twoCol-style; his template keys the grid off item.twoCol, so flag
				// them true when folding into the small section.
				smallSections: this._classicOutfitSections([
					...(fo.smallItems ?? []),
					...(fo.smallGridItems ?? []).map(i => ({ ...i, twoCol: true })),
				]),
				otherItems: this._classicOtherItemsText(inv),
			} : null;

			const fp = inv?.possessions ?? null;
			const possessions = fp ? {
				pickCount: fp.pickCount ?? 0,
				pickNote:  fp.pickNote ?? "",
				// Fork PossessionItemSnapshot is a superset of his; pass through the his-read fields.
				// `choices` is the only divergent shape his template walks (choices.list); fork
				// _buildPossessionsSnapshot sets it null for ALL possessions, so the block stays inert (GAP).
				items: (fp.items ?? []).map(it => ({
					slug:              it.slug,
					label:             it.label ?? "",
					description:       it.description ?? "",
					checked:           !!it.checked,
					disabled:          !!it.disabled,
					preselectedSource: it.preselectedSource ?? null,
					resource:          it.resource ?? null,
					choices:           it.choices ?? null,
					isAuthored:        !!it.isAuthored,   // drives the per-possession Edit/Remove affordances
				})),
			} : null;

			return { outfit, possessions };
		}

		// Wrap a flat fork item array into his OutfitSection[] ({name, items}). The fork already ordered
		// items and his outfitSegments helper handles grid/list runs WITHIN a section by item.twoCol, so a
		// single unnamed section per column reproduces his render (GAP: lost inter-group divider only;
		// outfit-items.hbs never reads section `name`, so null is harmless).
		_classicOutfitSections(items) {
			if (!items || items.length === 0) return [];
			return [{ name: null, items }];
		}

		// his outfit.otherItems is a free-text string; the fork stores "other" gear as inv.other
		// (OtherItemSnapshot[]). Flatten their names to a newline string for display (GAP: lossy,
		// display-only — typing in the textarea won't persist anywhere yet).
		_classicOtherItemsText(inv) {
			// Once the player has edited the Classic textarea, the free-text flag is authoritative (even
			// when cleared to ""); before any edit it falls back to flattening the structured inv.other.
			const stored = this.actor.getFlag("stonetop", "classicOtherItems");
			if (typeof stored === "string") return stored;
			const other = inv?.other ?? [];
			if (!other.length) return "";
			return other.map(o => o.name).filter(Boolean).join("\n");
		}

		// ── ARCANA ──────────────────────────────────────────────────────────────────────────────
		// Reshape the fork arcana snapshot (fork.arcana = {minor,major}, each an ArcanaSectionSnapshot
		// {title,items,hasOwned}) into his {minor:{title,items,hasOwned}, major:{…}}. The fork already
		// injects the interactive □/○/◇ mark checkboxes INTO the front/back description HTML (the live
		// mark-track render path — see reference_arcana-mark-tracks-two-render-paths), so we keep that
		// HTML verbatim and do NOT re-render glyphs. arcanum-cards.hbs renders descriptions through `md`,
		// which passes the already-injected <input> elements through unchanged.
		_buildClassicArcana(fork) {
			const section = forkSection => ({
				title:    forkSection?.title ?? "",
				items:    (forkSection?.items ?? []).map(it => this._reshapeArcanum(it)),
				// His template reads .hasOwned as a property; reproduce the fork getter on the POJO.
				get hasOwned() { return this.items.some(i => i.owned); },
			});
			return {
				minor: section(fork?.arcana?.minor),
				major: section(fork?.arcana?.major),
			};
		}

		// One fork MinorArcanumSnapshot -> his ArcanumSnapshot shape the arcanum-cards partial reads.
		_reshapeArcanum(it) {
			const f = it.front ?? {};
			const b = it.back ?? {};

			// FRONT. The fork keeps the unlock prompt + ○ mark track on f.unlock.description (with its
			// already-injected ○ checkboxes) and the discrete unlock picks on f.unlock.requirements. His
			// template reads only front.description (via md) + front.unlock.list (via choice-row), so:
			//   1) append the fork unlock prompt HTML (live ○ circles) onto front.description, and
			//   2) synthesize choice-row rows from f.unlock.requirements into front.unlock.list.
			const frontDescription = this._composeFrontDescription(f.description, f.unlock?.description);
			const front = {
				title:       f.title ?? "",
				item:        this._reshapeArcanumItem(f.item),
				description: frontDescription,
				unlock:      { list: this._reshapeUnlockRows(f.unlock?.requirements) },
			};

			// BACK. title/description/item/resource map straight across; the back interactive picks &
			// consequences live entirely as injected □ glyphs inside back.description (fork b.options is
			// empty for every shipped arcanum and there is no fork consequences analogue), so his
			// back.choices / back.consequences gates collapse (null).
			const back = {
				title:       b.title ?? "",
				item:        this._reshapeArcanumItem(b.item),
				description: b.description ?? "",
				resource:    b.resource ? this._reshapeResource(b.resource) : null,
				moves:       b.move ? [{ name: b.move.name ?? "", subtitle: null, text: b.move.description ?? "" }] : [],
				choices:      null,
				consequences: null,
			};

			return {
				slug:     it.slug,
				name:     f.title ?? it.slug,          // his template uses item.name only for <img alt>
				img:      it.img ?? null,              // fork sets majorArcanaImg(slug); null for minors
				front,
				back,
				owned:    it.owned ?? false,
				flipped:  it.flipped ?? false,
				checked:  it.checked ?? false,
				isCustom: it.isCustom ?? false,        // drives the per-card Edit affordance
			};
		}

		// Append the fork's unlock-prompt HTML (lead-in + already-injected ○ circles) onto the front
		// description so his single-description front side surfaces the unlock prompt. Distinct injection
		// contexts ("frontCircle" vs "unlock") mean no glyph index collision.
		_composeFrontDescription(description, unlockDescription) {
			const desc = description ?? "";
			const lead = unlockDescription ?? "";
			if (!lead) return desc;
			return `${desc}<div class="stonetop-arcanum-unlock-lead">${lead}</div>`;
		}

		// fork ArcanumUnlockSection.requirements (text item {type:"text",content} | option item
		// {type:"option",slug,description,count,max}) -> his choice-row EntryRow[] for front.unlock.list.
		// Text items render as read-only prose; option items render as a selectable count track keyed by
		// the option slug (round-trips through setArcanumUnlockCount once listeners are ported).
		_reshapeUnlockRows(requirements) {
			return (requirements ?? []).map(req => {
				if (req?.type === "text") {
					return this._classicEntryRow(null, { text: req.content ?? "" });
				}
				const max   = req?.max ?? 1;
				const count = req?.count ?? 0;
				return this._classicEntryRow(req?.slug ?? null, {
					text:  req?.description ?? "",
					track: { slug: req?.slug ?? null, checks: Array.from({ length: max }, (_, i) => i < count) },
				});
			});
		}

		// fork OutfitItem -> the {name,weight,note,resource} the arcanum-cards item block reads.
		_reshapeArcanumItem(item) {
			if (!item) return null;
			return {
				name:     item.name ?? "",
				weight:   item.weight ?? null,                                  // fed to `times`; null/0 = no diamonds
				note:     item.note ?? null,
				resource: item.resource ? this._reshapeResource(item.resource) : null,
			};
		}

		// fork Resource -> the {title,current,max,labels} resourceChecks consumes (already 1:1).
		_reshapeResource(r) {
			return {
				title:   r.title ?? null,
				current: r.current ?? 0,
				max:     r.max ?? 0,
				labels:  r.labels ?? [],
			};
		}

		// ── FOLLOWERS ───────────────────────────────────────────────────────────────────────────
		// Build his flat FollowerSnapshot[] from the fork's TYPED follower object. The base getData
		// already ran _buildFollowersData(realPlaybookDoc, …) and left the typed result on
		// fork.followers ({animalCompanion, crew, initiates[], beasts[], custom[]}), so we just flatten +
		// reshape each card into his shape. Wrapped in try/catch so neither a follower edge case nor a
		// markdown failure can unmount the whole sheet.
		// GAPs (deferred): follower inventory/gear catalog, the catalog-driven companion picker, the
		// crew's group roster, and Readiness/Order-Followers controls have no slot in his
		// FollowerSnapshot/partials and are intentionally dropped for this pass.
		_buildClassicFollowers(fork) {
			try {
				const typed = fork?.followers;
				if (!typed) { this._classicFollowerRoutes = []; return []; }
				const cards = [
					typed.animalCompanion,
					typed.crew,
					...(typed.initiates ?? []),
					...(typed.beasts ?? []),
					...(typed.custom ?? []),
				].filter(Boolean);
				// Route table for the listener pass: his follower-card DOM carries only data-slug, and
				// animal-companion + crew both build with slug:"" — so the write handlers resolve a card's
				// { ftype, slug } by its DOM index into this table (same flatten order as the rendered cards).
				this._classicFollowerRoutes = cards.map(c => ({ ftype: c.ftype, slug: c.slug ?? "" }));
				return cards.map(c => this._classicFollowerFromCard(c));
			} catch (_e) {
				this._classicFollowerRoutes = [];
				return [];
			}
		}

		// Reshape ONE fork follower card into his FollowerSnapshot shape (a plain object — the template
		// only reads the public field names, so a duck-typed object that satisfies the partials + helpers
		// is sufficient).
		_classicFollowerFromCard(c) {
			const md = (raw) => raw ? this._classicMarkdown(raw) : "";

			// Fork loyalty is a pip array [{index,filled}]; his is a ResourceSnapshot consumed by the
			// `resourceChecks` helper, which reads {current,max,labels} and indexes labels[i] WITHOUT a
			// null-guard, so `labels` MUST be an array. Livestock has no loyalty track -> null resource.
			const pips = Array.isArray(c.loyalty) ? c.loyalty : null;
			const loyalty = pips
				? { current: pips.filter(p => p.filled).length, max: pips.length || 3, labels: [], title: null }
				: null;

			// Fork tags are [{label,…}] on every type (guard for a stray string too). His selection-chips
			// reads sel.values[] / sel.unselectedOptions[]; we have no option catalog on the card, so
			// options = the selected values (chips render; the ▾ add-list is empty).
			const tagValues = (c.tags ?? [])
				.map(t => (typeof t === "string" ? t : t?.label))
				.filter(Boolean);

			const hp     = Number(c.hpCurrent ?? c.hpStaticValue ?? 0);
			const hpMax  = Number(c.hpMax ?? c.hpStaticValue ?? 0);
			const armor  = c.armor ?? "";
			const damage = c.damage ?? "";
			const moves  = c.moves ?? "";
			const notes  = c.notes ?? "";

			return {
				// The animal companion and crew cards both carry slug:"" in the fork; the listener
				// adapter (ported later) must route those two by type, not by slug.
				slug:        c.slug ?? c.hpSlug ?? c.loyaltySlug ?? "",
				// Only the custom follower type is `removable` in the fork; the others get a non-null
				// arcanaSlug -> his template hides the delete button on them.
				arcanaSlug:  c.removable ? null : (c.ftype ?? "fork"),
				name:        c.name || c.label || c.namePlaceholder || c.typeLabel || "Follower",

				// We don't model his catalog-driven companion picker, so render the animal companion as a
				// plain follower (isCompanion false, traits shown as tags).
				isCompanion: false,
				companionTypeSelection:    { values: [], text: "", options: [], unselectedOptions: [] },
				companionOptionsSelection: { values: [], text: "", options: [], unselectedOptions: [] },
				companionPickCount:   0,
				companionStartOptions: [],

				isGroup: false,
				tagSelection:      { values: tagValues, text: tagValues.join(", "), options: tagValues, unselectedOptions: [] },
				instinctSelection: this._classicScalarSelection(c.instinct),
				costSelection:     this._classicScalarSelection(c.cost),

				armor, armorHtml: md(String(armor)),
				damage, damageHtml: md(String(damage)),
				hp, hpMax,

				// The fork's crew roster is a different model, so emit no per-follower group members.
				members: [],
				memberSuggestions: { names: [], tags: [], traits: [] },
				membersNote: "",

				moves, movesHtml: md(moves),
				loyalty,

				// his ChoiceGroup-driven follower choices have no fork equivalent -> null (template gates
				// on choices.list.length). Follower inventory catalog likewise absent -> hasInventory:false.
				choices: null,
				hasInventory: false,
				inventory: null,

				notes, notesHtml: md(notes),

				// Back-compat scalars his ctor also sets (harmless extras).
				specialQuality: "",
				description: c.typeLabel ?? "",
				tags: tagValues.join(", "),
				instinct: c.instinct ?? "",
				cost: c.cost ?? "",
			};
		}

		// A single-select Selection-shaped object (instinct / cost) for classic.selection-input,
		// which reads sel.text + sel.options[].
		_classicScalarSelection(value) {
			const v = value == null ? "" : String(value);
			return { values: v ? [v] : [], text: v, options: v ? [v] : [], unselectedOptions: [] };
		}

		// Markdown -> HTML using the Classic support pipeline. [[ ]] / @UUID tokens in the result are
		// upgraded to clickable links post-render by enrichRichTokens (see _render).
		_classicMarkdown(raw) {
			return renderMarkdown(raw);
		}

		// ── INSERTS (extra tabs) ──────────────────────────────────────────────────────────────────
		// The only insert the fork models as a tab is the post-death insert, on fork.postDeathInsert
		// (a PostDeathSectionSnapshot). His tab-insert renders instinctGroup/instinctSelected (a
		// ChoiceGroup) + choices (ChoiceGroup[]); the fork instead carries activeInsert.instinct
		// (InstinctSection) + activeInsert.lore (LoreSection), so we reshape those.
		// GAP: Lightbearer invocations are a PLAYBOOK field in the fork (shown in the Moves tab), not an
		// insert, so no invocations tab is emitted here.
		_buildClassicInserts(fork) {
			const section = fork?.postDeathInsert ?? null;
			const active  = section?.activeInsert ?? null;
			if (!active) return [];

			// The fork post-death insert is not an embedded item; key the tab/remove handler by the
			// active slug. (The Classic remove handler, ported later, special-cases this synthetic id to
			// call setPostDeathInsert(null) rather than deleting an embedded document.)
			const slug = active.slug ?? section.activeSlug ?? "post-death";
			return [{
				id:               `postdeath-${slug}`,
				slug,
				name:             active.name ?? "Insert",
				img:              active.img ?? null,
				description:      active.description ?? null,
				instinctGroup:    this._classicInstinctGroup(active.instinct),
				instinctSelected: active.instinct?.selected ?? "",
				choices:          this._buildClassicLoreGroups(active.lore),
				moves:            [], // tab-insert does not render insert.moves; post-death moves show in the moves tab
			}];
		}

		// InstinctSection -> his ChoiceGroup { slug:"instinct", list:[ ChoiceRow ] } (one radio pick row).
		_classicInstinctGroup(instinct) {
			const opts = instinct?.options ?? [];
			if (!opts.length && !instinct?.selected) return null;
			const options = opts.map(o => ({
				slug:        o.value ?? o.word ?? "",
				text:        o.word ?? "",
				description: o.description ?? null,
				checked:     !!o.selected,
				type:        null,
				fillValue:   "",
			}));
			return {
				slug: "instinct",
				list: [this._classicChoiceRow(options, {
					rowKey: "instinct-row-0", radio: true,
					siblingSlugsCsv: options.map(o => o.slug).join(","),
				})],
			};
		}

		/** @override - port his capture-phase delegated handlers onto the fork write API. We call ONLY
		 *  Foundry's appv1 base (tabs + native drag/drop) — NOT super.activateListeners (the fork Minimal
		 *  listeners query the Minimal DOM and throw on his template). Every write handler binds to his
		 *  vendored data-* contract and routes to this.actor.typedActor.* / actor.update / setFlag.
		 *  Several handlers target controls the getData fill currently renders empty/null (background
		 *  resource, possession sub-choices, the back/follower-check cg branches) — kept for parity, inert
		 *  until those shapes are surfaced. Cross-cutting gaps (free-text follower tags, the crew roster,
		 *  follower inventory, on-sheet introductions, combobox/edit-toggle/stepper UI infra) are noted in
		 *  the project_classic-sheet-port memory. */
		activateListeners(html) {
			foundry.appv1.sheets.ActorSheet.prototype.activateListeners.call(this, html);
			// UI affordances (his base sheet wires these unconditionally): the .stonetop-editable pencil
			// reveal (REQUIRED — follower armor/damage/instinct/cost/moves/notes are hidden until it),
			// the ▲▼ steppers on number inputs, and the Selection combo-box dropdowns. Run before the
			// editable guard so they behave for non-editable viewers too (harmless — writes still gate).
			activateEditToggles(html[0]);
			activateSteppers(html[0]);
			activateComboBoxes();

			// Drag-drop (his Classic sheet binds these directly). We deliberately skip
			// super.activateListeners — the fork base binds drop against the Minimal DOM — so re-bind the
			// fork drop pipeline here: playbook Item -> _onDropPlaybook (writes system.playbook + seeds HP +
			// starting moves), other Items -> _onDropItemCreate, dropped Actors -> steading-link /
			// monster->follower convert. Bound before the editable guard, matching his original sheet
			// (the inherited _onDrop* helpers gate on permissions themselves).
			html[0].addEventListener("dragover", ev => ev.preventDefault());
			html[0].addEventListener("drop", async ev => {
				if (ev.target.closest(".sheet-tabs")) return;
				ev.stopImmediatePropagation();
				const data = this._getDragEventData(ev);
				if (!data) return;
				if (data.type === "Actor") {
					const doc = await fromUuid(data.uuid);
					if (doc?.system?.customType === "stonetop") {
						await this.actor.setFlag("stonetop", "steadingId", doc.id);
						this.render(false);
					} else if (doc?.type === "monster") {
						this._onMonsterDropConvert(doc);
					}
					return;
				}
				if (data.type === "Item") {
					if (data.uuid) {
						const doc = await fromUuid(data.uuid);
						if (doc?.type === "playbook") { await this._onDropPlaybook(doc); return; }
					}
					const item = await Item.implementation.fromDropData(data);
					if (!item) return;
					if (item.parent?.uuid === this.actor.uuid) { await this._onDropItem(ev, data); return; }
					await this._onDropItemCreate(item.toObject());
				}
			}, true);

			if (!this.isEditable) return;

			// ── CORE + ROLLS ──────────────────────────────────────────────────────────────────
			// Global rollable (his base sheet, ported): stat / item / damage rolls via the fork roll surface.
			html[0].addEventListener("click", async ev => {
				if (ev.target.tagName === "INPUT" && !ev.target.disabled && !ev.target.readOnly) return;
				const rollable = ev.target.closest(".rollable[data-roll]");
				if (!rollable) return;
				ev.stopPropagation();
				const ta = this.actor.typedActor;
				if (rollable.classList.contains("stonetop-damage-roll") || rollable.dataset.roll === "damage") {
					await this._classicRollDamage(rollable);
					return;
				}
				const handled = await ta.onRoll({ currentTarget: rollable }, {});
				if (handled) return;
				const roll = rollable.dataset.roll;
				if (roll) await ta.onDirectStatRoll(roll, {});
			}, true);

			// Vitals: HP / XP / Level are editable system fields (max-HP, armor, damage are COMPUTED — gaps).
			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-hp");
				if (!input) return;
				const n = parseInt(input.value);
				this.actor.update({ "system.attributes.hp.value": Math.max(0, isNaN(n) ? 0 : n) });
			}, true);
			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-xp");
				if (!input) return;
				const n = parseInt(input.value);
				this.actor.update({ "system.attributes.xp.value": Math.max(0, isNaN(n) ? 0 : n) });
			}, true);
			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-level");
				if (!input) return;
				const n = parseInt(input.value);
				// FORK level is system.attributes.level.value (an object), NOT the scalar his sheet writes.
				this.actor.update({ "system.attributes.level.value": Math.max(1, isNaN(n) ? 1 : n) });
			}, true);

			// Manual vitals overrides — parity with his EDITABLE max-HP / armor / damage. The fork
			// computes these (playbook+moves HP, worn-item armor, playbook damage die); writing a value
			// stores an override (flags.<scope>.overrides.*) that _buildVitalsSection prefers everywhere,
			// so the edit is the EFFECTIVE value (incl. the damage roll, which reads the shown die).
			// Clearing the field to empty removes the override -> back to the computed default.
			const setOverride = (key, val) =>
				this.actor.setFlag("stonetop", `overrides.${key}`, val).then(() => this.render(false));
			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-max-hp");
				if (!input) return;
				const raw = input.value.trim();
				setOverride("maxHp", raw === "" ? null : Math.max(0, parseInt(raw) || 0));
			}, true);
			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-armor");
				if (!input) return;
				const raw = input.value.trim();
				setOverride("armor", raw === "" ? null : Math.max(0, parseInt(raw) || 0));
			}, true);
			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".stonetop-char-damage");
				if (!input) return;
				const raw = input.value.trim();
				setOverride("damage", raw === "" ? null : raw);
			}, true);
			// Manual load level — parity with his clickable load radios. Stores an override the inventory
			// snapshot prefers over the weight-derived level (clicking a radio = a deliberate manual pick).
			html[0].addEventListener("change", ev => {
				const radio = ev.target.closest(".stonetop-outfit-load-radio");
				if (!radio) return;
				setOverride("loadLevel", radio.value || null);
			}, true);

			// Debilities (fork keys weakened|dazed|miserable === his data-slug; his template has no name=).
			html[0].addEventListener("change", ev => {
				const el = ev.target.closest(".stonetop-debility-check");
				if (!el) return;
				ev.stopImmediatePropagation();
				ev.stopPropagation();
				this.actor.update({ [`system.attributes.debilities.options.${el.dataset.slug}.value`]: el.checked });
			}, true);

			// Roll mode / bio / notes.
			html[0].addEventListener("change", ev => {
				const el = ev.target.closest("[name=stonetop-roll-mode]");
				if (!el) return;
				this.actor.typedActor.setRollMode(el.value);
			}, true);
			html[0].addEventListener("change", ev => {
				const el = ev.target.closest(".stonetop-char-bio");
				if (!el) return;
				this.actor.update({ "system.description": el.value });
			}, true);
			html[0].addEventListener("change", ev => {
				const el = ev.target.closest(".stonetop-char-notes");
				if (!el) return;
				this.actor.update({ "system.notes": el.value });
			}, true);
			// Outfit "Other items" free-text (his .stonetop-notes). The fork stores structured inv.other,
			// but the Classic sheet edits a single free-text blob like his — persist it to a flag, which
			// getData (_classicOtherItemsText) reads back in preference to the structured list.
			html[0].addEventListener("change", ev => {
				const el = ev.target.closest(".stonetop-notes");
				if (!el) return;
				this.actor.setFlag("stonetop", "classicOtherItems", el.value);
			}, true);

			// Narrow-layout moves sidebar overlay (pure DOM) + open a sidebar move's item sheet.
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-moves-toggle");
				if (!btn) return;
				btn.closest(".stonetop-sheet-layout")?.classList.toggle("moves-open");
			}, true);
			// Collapse the header + stats/portrait so the tabbed content fills the sheet (his .top-toggle).
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-top-toggle");
				if (!btn) return;
				btn.closest(".sheet-wrapper")?.classList.toggle("top-collapsed");
			}, true);

			// ── CUSTOM-ARCANUM / CUSTOM-POSSESSION AUTHORING ───────────────────────────────────
			// Reuse the base sheet's authoring methods (the data layer is shared); his delegated
			// click pattern means ev.currentTarget is the form, so hand the inherited possession
			// handlers a synthetic { currentTarget: btn } carrying the data-slug they read.
			html[0].addEventListener("click", ev => {
				if (!ev.target.closest(".stonetop-arcanum-create-btn")) return;
				ev.stopPropagation();
				this._onCreateCustomArcanum();
			}, true);
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-arcanum-edit");
				if (!btn) return;
				ev.stopPropagation();
				this._onEditCustomArcanum(btn.dataset.slug);
			}, true);
			html[0].addEventListener("click", ev => {
				if (!ev.target.closest(".stonetop-possession-add-custom")) return;
				ev.stopPropagation();
				this._onAddCustomPossession();
			}, true);
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-possession-authored-edit");
				if (!btn) return;
				ev.stopPropagation();
				this._onEditAuthoredPossession({ currentTarget: btn });
			}, true);
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-possession-authored-remove");
				if (!btn) return;
				ev.stopPropagation();
				this._onRemoveAuthoredPossession({ currentTarget: btn });
			}, true);
			html[0].addEventListener("click", async ev => {
				const el = ev.target.closest(".stonetop-basic-move-open");
				if (!el) return;
				el.closest(".stonetop-sheet-layout")?.classList.remove("moves-open");
				const { compendiumId } = el.dataset;
				if (!compendiumId) return;
				const repo = this.actor.typedActor?._moveRepo;
				const doc  = (repo ? await repo.getBasicMoveDocument(compendiumId).catch(() => null) : null)
					?? (repo ? await repo.getPlaybookMoveDocument(compendiumId).catch(() => null) : null)
					?? game.items?.get(compendiumId)
					?? null;
				if (doc) doc.sheet.render(true);
			}, true);

			// ── CG-ROUTING (generic [data-cg-context] controls) ──────────────────────────────────
			html[0].addEventListener("change", ev => {
				const el = ev.target.closest(".stonetop-cg-track");
				if (!el?.dataset.cgContext) return;
				const { cgContext, cgGroup, cgOption, cgIndex } = el.dataset;
				const count = el.checked ? Number(cgIndex) + 1 : Number(cgIndex);
				this._classicCgRoute("count", el, { context: cgContext, group: cgGroup, option: cgOption, count });
			}, true);
			html[0].addEventListener("change", ev => {
				const el = ev.target.closest(".stonetop-cg-pick");
				if (!el?.dataset.cgContext) return;
				const { cgContext, cgGroup, cgOption, displayLabel } = el.dataset;
				// Reflect the picked label into the custom-instinct box (cosmetic; re-render repopulates it).
				const insertEl = el.closest("[data-insert-item-id]");
				if (insertEl) {
					const custom = insertEl.querySelector(".stonetop-instinct-custom");
					if (custom) custom.value = displayLabel ?? "";
				} else if (cgContext === "instinct") {
					const custom = html[0].querySelector(".stonetop-instinct-custom");
					if (custom) custom.value = displayLabel ?? "";
				}
				this._classicCgRoute("pick", el, {
					context: cgContext, group: cgGroup, option: cgOption,
					displayLabel: displayLabel ?? "", checked: el.checked,
				});
			}, true);
			html[0].addEventListener("change", ev => {
				const el = ev.target.closest(".stonetop-cg-text");
				if (!el?.dataset.cgContext) return;
				const { cgContext, cgGroup, cgOption } = el.dataset;
				this._classicCgRoute("text", el, { context: cgContext, group: cgGroup, option: cgOption, value: el.value });
			}, true);
			// Follower-check (arcana-back / background). DEAD on the current sheet (entries carry no
			// followers, choices are null) — kept for parity.
			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-arcanum-follower-check");
				if (!el) return;
				const ta = this.actor.typedActor;
				const { cgContext, slug: groupSlug, option: optionSlug, index } = el.dataset;
				const count = el.checked ? Number(index) + 1 : Number(index);
				if (cgContext === "arcana-back") await ta.setArcanumBackOptionCount(groupSlug, optionSlug, count);
				else if (cgContext === "background") await ta.background.addChoice({ slug: optionSlug, isChecked: count > 0 });
			}, true);

			// ── PLAYBOOK (non-cg) ─────────────────────────────────────────────────────────────────
			// Empty-state picker: resolve the slug to a real playbook DOCUMENT and hand it to the fork's
			// _onDropPlaybook (writes system.playbook + seeds HP + ensureStartingMoves + render(false)).
			html[0].addEventListener("change", async ev => {
				const sel = ev.target.closest(".stonetop-playbook-select");
				if (!sel || !sel.value) return;
				const doc = await this._classicPlaybookDoc(sel.value);
				if (doc) await this._onDropPlaybook(doc);
			}, true);
			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest("[name=stonetop-background]");
				if (!el) return;
				const ta = this.actor.typedActor;
				await ta.background.selectBackground(el.value);
				await ta.ensureStartingMoves();
			}, true);
			html[0].addEventListener("change", ev => {
				const el = ev.target.closest(".stonetop-instinct-custom");
				if (!el) return;
				this.actor.typedActor.instinct.select(el.value.trim());
			}, true);
			html[0].addEventListener("change", ev => {
				const el = ev.target.closest("[name=stonetop-origin]");
				if (!el) return;
				this.actor.typedActor.origin.select(el.value);
			}, true);
			html[0].addEventListener("click", ev => {
				const el = ev.target.closest(".stonetop-origin-name");
				if (!el) return;
				this.actor.typedActor.updateName(el.textContent.trim());
			}, true);
			// Background setup-resource diamond (forward-compat; dormant until getData surfaces it).
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-background-resource-btn");
				if (!btn) return;
				ev.stopPropagation();
				const { slug, index } = btn.dataset;
				const newVal = btn.classList.contains("is-checked") ? Number(index) : Number(index) + 1;
				this.actor.typedActor.background.setSetupResource(slug, newVal);
			}, true);

			// ── MOVES ─────────────────────────────────────────────────────────────────────────────
			// Acquire / repeat (check = add the move as an embedded item, uncheck = remove it). The
			// vendored checkbox lacks a compendium id, so _classicResolveMove resolves the slug.
			// (Move resource ticks share .stonetop-item-resource-check with possessions — handled by the
			//  single dispatcher in the EQUIPMENT block via this._onClassicMoveResource.)
			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-move-check, .stonetop-repeat-check");
				if (!el) return;
				const ta = this.actor.typedActor;
				if (el.checked) {
					const { compendiumId } = await this._classicResolveMove(el);
					if (compendiumId) await ta.addMove(compendiumId);
				} else {
					const ownedId = el.dataset.ownedId || (await this._classicResolveMove(el)).ownedId;
					if (ownedId) await ta.removeMove(ownedId);
				}
			}, true);
			// Remove an "other"-category move (inert for fork.moves — wired for parity). Confirm dialog.
			html[0].addEventListener("click", async ev => {
				const a = ev.target.closest(".stonetop-other-move-delete");
				if (!a) return;
				ev.stopPropagation();
				const ta = this.actor.typedActor;
				const { ownedId, name } = await this._classicResolveMove(a);
				if (!ownedId) return;
				Dialog.confirm({
					title:   "Remove move",
					content: `<p>Remove <strong>${escHtml(name || "this move")}</strong> from your moves? This can't be undone.</p>`,
					yes:     () => ta.removeMove(ownedId),
					render:  bringDialogToFront,
				});
			}, true);

			// ── EQUIPMENT ───────────────────────────────────────────────────────────────────────────
			const ta = this.actor.typedActor;
			// Carried item (◇/□). toggleCarriedItem spends/returns the undefined pool; load is derived → render.
			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-inventory-item-check");
				if (!el || !el.dataset.slug) return;
				const small = !!el.closest(".stonetop-inventory-small");
				await ta.toggleCarriedItem(el.dataset.slug, el.checked, { small, weight: Number(el.dataset.weight ?? 1) });
				this.render(false);
			}, true);
			html[0].addEventListener("click", async ev => {
				const el = ev.target.closest(".stonetop-inventory-resource-btn");
				if (!el) return;
				const { slug, index } = el.dataset;
				const newVal = el.classList.contains("is-checked") ? Number(index) : Number(index) + 1;
				await ta.setInventoryResource(slug, newVal);
				this.render(false);
			}, true);
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-inv-add-btn");
				if (!btn) return;
				this._classicAddInventoryItem(btn.dataset.column);
			}, true);
			html[0].addEventListener("click", async ev => {
				const el = ev.target.closest(".stonetop-inv-delete");
				if (!el) return;
				ev.stopPropagation();
				await ta.removeCustomInventoryItem(el.dataset.ownedId);
			}, true);
			// Undefined ◇/□ reserve pools (his per-index diamonds; setFlag auto-rerenders the derived load).
			html[0].addEventListener("change", async ev => {
				const reg = ev.target.closest(".stonetop-regular-pool-btn");
				if (reg) { const i = Number(reg.dataset.index); await ta.setInventoryRegularPool(reg.checked ? i + 1 : i); return; }
				const sm = ev.target.closest(".stonetop-small-pool-btn");
				if (sm) { const i = Number(sm.dataset.index); await ta.setInventorySmallPool(sm.checked ? i + 1 : i); }
			}, true);
			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-possession-check");
				if (!el) return;
				if (el.checked) await ta.selectPossession(el.dataset.slug);
				else            await ta.deselectPossession(el.dataset.slug);
			}, true);
			// Possession sub-choices (currently inert — fork emits choices:null; retained for the future).
			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-possession-sub-check");
				if (!el) return;
				const { possessionSlug, choiceSlug } = el.dataset;
				if (el.checked) await ta.selectSubChoice(possessionSlug, choiceSlug);
				else            await ta.deselectSubChoice(possessionSlug, choiceSlug);
			}, true);
			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-possession-sub-radio");
				if (!el) return;
				const { possessionSlug, choiceSlug, siblingSlugsCsv } = el.dataset;
				await ta.selectSubChoiceExclusive(possessionSlug, choiceSlug, siblingSlugsCsv ? siblingSlugsCsv.split(",") : []);
			}, true);
			// SHARED .stonetop-item-resource-check dispatcher — register ONCE. Class is shared by MOVES
			// (data-move-slug) and POSSESSIONS (data-possession-slug); branching here (instead of two
			// capture listeners) avoids stopImmediatePropagation fights.
			html[0].addEventListener("click", async ev => {
				const btn = ev.target.closest(".stonetop-item-resource-check");
				if (!btn) return;
				ev.stopPropagation();
				ev.stopImmediatePropagation();
				if (btn.dataset.moveSlug !== undefined) { await this._onClassicMoveResource(btn); return; }
				if (btn.dataset.possessionSlug === undefined) return;
				const index = Number(btn.dataset.index);
				const newVal = btn.classList.contains("is-checked") ? index : index + 1;
				const choiceSlug = btn.dataset.choiceSlug ?? null; // null today (sub-choice tracks not rendered)
				if (choiceSlug) await ta.setSubChoiceUses(btn.dataset.possessionSlug, choiceSlug, newVal);
				else            await ta.setPossessionUses(btn.dataset.possessionSlug, newVal);
			}, true);

			// ── ARCANA (non-cg) ─────────────────────────────────────────────────────────────────────
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-arcanum-flip-btn");
				if (!btn) return;
				ev.stopPropagation();
				const a = this.actor.typedActor;
				const { slug, flipped } = btn.dataset;
				if (flipped === "true") a.unflipArcanum(slug).then(() => this.render(false));
				else                    a.flipArcanum(slug).then(() => this.render(false));
			}, true);
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-arcanum-resource-btn");
				if (!btn) return;
				ev.stopPropagation();
				const { slug, index } = btn.dataset;
				const newVal = btn.classList.contains("is-checked") ? Number(index) : Number(index) + 1;
				this.actor.typedActor.setArcanumResource(slug, newVal).then(() => this.render(false));
			}, true);
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-arcanum-delete");
				if (!btn) return;
				ev.stopPropagation();
				const a = this.actor.typedActor;
				const { slug } = btn.dataset;
				const title = btn.closest(".stonetop-arcanum-card")
					?.querySelector(".stonetop-arcanum-title")?.textContent?.trim() || "this arcanum";
				Dialog.confirm({
					title:   "Remove arcanum",
					content: `<p>Remove <strong>${escHtml(title)}</strong> from your arcana? This can't be undone.</p>`,
					yes:     () => a.removeArcanum(slug).then(() => this.render(true)),
					render:  bringDialogToFront,
				});
			}, true);
			// Injected ◇/○/□ mark checkboxes inside the verbatim front/back description HTML.
			html[0].addEventListener("change", ev => {
				const cb = ev.target.closest(".stonetop-arcanum-box, .stonetop-arcanum-circle, .stonetop-arcanum-diamond");
				if (!cb) return;
				ev.stopPropagation();
				const { arcanumSlug, context, index } = cb.dataset;
				this.actor.typedActor.setArcanumBoxChecked(arcanumSlug, context, Number(index), cb.checked);
			}, true);

			// ── FOLLOWERS ───────────────────────────────────────────────────────────────────────────
			// Add → the inherited fork Create-a-Follower walkthrough.
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-follower-add");
				if (!btn) return;
				this._onCreateFollowerOpen();
			}, true);
			// Delete (renders only for custom followers → data-slug is a customFollowers id).
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".stonetop-follower-delete");
				if (!btn?.dataset.slug) return;
				ev.stopPropagation();
				const slug = btn.dataset.slug;
				const name = this.actor.getFlag("stonetop", `customFollowers.${slug}.name`) || "this follower";
				Dialog.confirm({
					title:   "Remove follower",
					content: `<p>Remove <strong>${escHtml(name)}</strong> from your followers? This can't be undone.</p>`,
					yes: () => {
						const [updKey, val] = deletionEntry(`flags.stonetop.customFollowers.${slug}`);
						return this.actor.update({ [updKey]: val }).then(() => this.render(false));
					},
					render: bringDialogToFront,
				});
			}, true);
			// Follower tags: chip click removes, typed/picked value (change) adds. Only the user-authored
			// follower types have an editable tag store (custom + crew); rules-derived tag rows
			// (animal-companion / beast traits) no-op gracefully, like the other gap fields.
			html[0].addEventListener("click", ev => {
				const chip = ev.target.closest(".stonetop-tag-chip");
				if (!chip) return;
				ev.stopPropagation();
				this._classicToggleFollowerTag(chip, chip.dataset.tag);
			}, true);
			html[0].addEventListener("change", ev => {
				const add = ev.target.closest(".stonetop-tag-add");
				if (!add) return;
				const value = add.value.trim();
				if (value) this._classicToggleFollowerTag(add, value);
			}, true);
			html[0].addEventListener("keydown", ev => {
				const add = ev.target.closest(".stonetop-tag-add");
				if (!add) return;
				if (ev.key === "Enter") { ev.preventDefault(); add.blur(); }
			}, true);
			html[0].addEventListener("change", async ev => {
				const input = ev.target.closest(".stonetop-follower-name-input");
				if (!input) return;
				const r = this._classicFollowerRoute(input);
				if (!r) return;
				const path = this._classicFollowerPath(r, "name", { structuralFirst: true });
				if (!path) return; // initiate/beast name = no-op gap
				await this.actor.setFlag("stonetop", path, input.value.trim());
				this.render(false);
			}, true);
			html[0].addEventListener("change", async ev => {
				const input = ev.target.closest(".stonetop-follower-hp");
				if (!input) return;
				const r = this._classicFollowerRoute(input);
				if (!r) return;
				const card  = input.closest(".stonetop-follower-card");
				const hpMax = Number(card?.querySelector(".stonetop-follower-hp-max")?.value ?? input.max);
				const val   = Math.max(0, Math.min(Number(input.value) || 0, Number.isFinite(hpMax) && hpMax > 0 ? hpMax : Infinity));
				const { ftype, slug } = r;
				if (ftype === "animal-companion")   await this.actor.setFlag("stonetop", "animalCompanion.hpCurrent", val);
				else if (ftype === "initiate")      await this.actor.update({ [`flags.stonetop.initiatesHp.${slug}`]: val });
				else if (ftype === "beast")         await this.actor.update({ [`flags.stonetop.beastHp.${slug}`]: val });
				else if (ftype === "custom")        await this.actor.update({ [`flags.stonetop.customFollowers.${slug}.hpCurrent`]: val });
				else if (ftype === "crew")          await this.actor.setFlag("stonetop", "crew.groupHp", val);
				this.render(false);
			}, true);
			html[0].addEventListener("change", async ev => {
				const input = ev.target.closest(".stonetop-follower-hp-max");
				if (!input) return;
				const r = this._classicFollowerRoute(input);
				if (!r || r.ftype !== "custom") return; // gap for non-custom (rules-derived)
				await this.actor.update({ [`flags.stonetop.customFollowers.${r.slug}.hpMax`]: Math.max(0, Number(input.value) || 0) });
				this.render(false);
			}, true);
			html[0].addEventListener("click", async ev => {
				const btn = ev.target.closest(".stonetop-follower-loyalty-btn");
				if (!btn) return;
				ev.stopPropagation();
				const r = this._classicFollowerRoute(btn);
				if (!r) return;
				const path = this._classicFollowerLoyaltyPath(r);
				if (!path) return;
				const idx = Number(btn.dataset.index);
				await this.actor.setFlag("stonetop", path, btn.classList.contains("is-checked") ? idx : idx + 1);
				this.render(false);
			}, true);
			const FOLLOWER_FIELD = [
				[".stonetop-follower-armor",    "armor",    true ],
				[".stonetop-follower-damage",   "damage",   false],
				[".stonetop-follower-instinct", "instinct", true ],
				[".stonetop-follower-cost",     "cost",     true ],
			];
			html[0].addEventListener("change", async ev => {
				for (const [sel, field, structuralFirst] of FOLLOWER_FIELD) {
					const input = ev.target.closest(sel);
					if (!input) continue;
					const r = this._classicFollowerRoute(input);
					if (!r) return;
					if (field === "armor" && r.ftype !== "custom") return; // armor gap for non-custom
					const path = this._classicFollowerPath(r, field, { structuralFirst });
					if (!path) return;
					await this.actor.setFlag("stonetop", path, input.value.trim());
					this.render(false);
					return;
				}
			}, true);
			html[0].addEventListener("change", async ev => {
				const moves = ev.target.closest(".stonetop-follower-moves");
				const notes = ev.target.closest(".stonetop-follower-notes");
				const input = moves || notes;
				if (!input) return;
				const r = this._classicFollowerRoute(input);
				if (!r) return;
				const path = this._classicFollowerPath(r, moves ? "moves" : "notes", { structuralFirst: false });
				if (!path) return;
				await this.actor.setFlag("stonetop", path, input.value);
				this.render(false);
			}, true);
		}

		// ── Listener helpers ──────────────────────────────────────────────────────────────────────

		/** His damage button emits a literal data-roll="damage". Roll the displayed (computed) die FLAT,
		 *  reading the value off the rendered .stonetop-char-damage input (the fork's computed die can
		 *  differ from the raw system.attributes.damage.value). */
		async _classicRollDamage(rollable) {
			const { rollDamage } = await import("../../utils/roll-engine.js");
			const shown = rollable?.closest(".stonetop-resource")?.querySelector(".stonetop-char-damage")?.value?.trim();
			const die = shown || this.actor.system?.attributes?.damage?.value;
			if (!die) return;
			const formula = /^\d/.test(String(die)) ? String(die) : `1${die}`;
			const label = rollable?.textContent?.trim() || game.i18n.localize("stonetop.character.attributes.damage");
			await rollDamage(formula, this.actor, { label });
		}

		/** CG dispatcher: bridge his data-cg-* DOM to the fork setter surface. Handles the insert
		 *  (postdeath-<slug>) special-case + the appearance/lore-text slug divergences. */
		async _classicCgRoute(kind, el, args) {
			const ta = this.actor.typedActor;
			const { context, group, option } = args;
			const insertEl = el.closest("[data-insert-item-id]");
			if (insertEl) {
				if (kind === "count") return ta.setPostDeathLoreCount(group, option, args.count);
				if (kind === "text")  return ta.setPostDeathLoreText(group, this._classicStripInputSuffix(option), args.value);
				if (kind === "pick")  return ta.setPostDeathInstinct(option); // persisted value == composed option slug
				return;
			}
			if (kind === "count") {
				switch (context) {
					case "lore":          return ta.setLoreOptionCount(group, option, args.count);
					case "arcana-unlock": return ta.setArcanumUnlockCount(group, option, args.count);
					case "arcana-back":   return ta.setArcanumBackOptionCount(group, option, args.count);
					case "background":    return ta.background.addChoice({ slug: option, isChecked: args.count > 0 });
					default: return; // GAPs: move / intro-npc / intro-pc / possession have no fork count setter
				}
			}
			if (kind === "text") {
				switch (context) {
					case "lore": return ta.setLoreOptionText(group, this._classicStripInputSuffix(option), args.value);
					default: return; // GAPs: move / intro text
				}
			}
			if (kind === "pick") {
				switch (context) {
					case "instinct":   return ta.instinct.select(option); // cgOption == composeInstinct(word,desc)
					case "appearance": {
						const m = (el.getAttribute("name") || "").match(/appearance-row-(\d+)/);
						if (!m) return;
						return ta.appearance.select(Number(m[1]), option);
					}
					case "background": return ta.background.addChoice({ slug: option, isChecked: args.checked });
					default: return; // GAPs: intro / follower pick
				}
			}
		}

		/** Lore text option slugs render as "<slug>-input"; the fork keys lore text on the bare slug. */
		_classicStripInputSuffix(slug) {
			return slug?.endsWith("-input") ? slug.slice(0, -"-input".length) : slug;
		}

		/** Resolve a playbook slug to its real compendium DOCUMENT (not the asPlaybook() POJO) so the
		 *  fork's _onDropPlaybook can read its uuid/name/system.slug/flags. */
		async _classicPlaybookDoc(slug) {
			try {
				const store = this.actor?.typedActor?._playbookRepo?._store;
				if (!store) return null;
				const entry = await store.findEntry(e => e.type === "playbook" && e.system?.slug === slug);
				return entry ? await store.getDocument(entry._id) : null;
			} catch (_e) { return null; }
		}

		/** Resolve a vendored move element (data-move-slug) to the fork move identity the setters need,
		 *  via the slug→identity index _buildClassicMoves stashed. Falls back to the rendered move name. */
		async _classicResolveMove(el) {
			const slug = el?.dataset?.moveSlug ?? null;
			const idx  = this._classicMoveIndex ?? new Map();
			let rec = slug ? idx.get(slug) : null;
			if (!rec) {
				const name = el.closest(".stonetop-item, .stonetop-move-item")?.querySelector(".stonetop-item-name")?.textContent?.trim() ?? "";
				rec = name ? [...idx.values()].find(r => r.name === name) : null;
			}
			return {
				name:         rec?.name ?? null,
				compendiumId: rec?.compendiumId ?? null,
				ownedId:      el?.dataset?.ownedId || rec?.ownedId || null,
			};
		}

		/** Move resource track (move-slug branch of the shared dispatcher). Fork keys move resources by
		 *  NAME; the DOM carries the slug, so resolve and feed moveResources.add a synthetic button. */
		async _onClassicMoveResource(btn) {
			const ta = this.actor.typedActor;
			const { name } = await this._classicResolveMove(btn);
			if (!name) return;
			const index = Number(btn.dataset.index);
			await ta.moveResources.add({ moveName: name, index, isChecked: () => btn.classList.contains("is-checked") });
		}

		/** Add a custom inventory item (regular has a weight field; small does not). Ports the fork
		 *  sheet's dialog so the chrome (stonetop classes, front-on-open) matches the Minimal sheet. */
		_classicAddInventoryItem(column) {
			const ta = this.actor.typedActor;
			const isRegular = column === "regular";
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
					cancel: { label: game.i18n.localize("Cancel") },
					add: {
						label: game.i18n.localize("stonetop.inventory.addItemConfirm"),
						callback: html => {
							const name = html.find("[name=name]").val().trim();
							if (!name) return;
							if (isRegular) {
								const weight = Math.max(1, parseInt(html.find("[name=weight]").val()) || 1);
								ta.addCustomInventoryItem(name, weight).then(() => this.render(false));
							} else {
								ta.addCustomSmallItem(name).then(() => this.render(false));
							}
						},
					},
				},
				default: "add",
				render: bringDialogToFront,
			}, { classes: ["dialog", "stonetop", "stonetop-add-item-dialog"] }).render(true);
		}

		/** Resolve a follower-card element to its fork { ftype, slug }. His DOM only carries data-slug
		 *  (animal-companion + crew both build with slug:""), so map the card's DOM index into the route
		 *  table _buildClassicFollowers stashed (same flatten order as the rendered cards). */
		_classicFollowerRoute(el) {
			const card = el.closest?.(".stonetop-follower-card");
			if (!card) return null;
			const cards  = [...card.parentElement.querySelectorAll(":scope > .stonetop-follower-card")];
			const domIdx = cards.indexOf(card);
			if (domIdx < 0) return null;
			const routes = this._classicFollowerRoutes ?? [];
			const entry = routes[domIdx];
			if (!entry || !entry.ftype) return null;
			const ds = card.dataset.slug ?? "";
			if (ds && entry.slug && entry.slug !== ds) {
				const bySlug = routes.find(rt => rt.slug && rt.slug === ds);
				if (bySlug) return { ftype: bySlug.ftype, slug: ds };
			}
			return { ftype: entry.ftype, slug: entry.slug ?? "" };
		}

		/** Flag path for a hand-edited follower field. structuralFirst routes name/instinct/cost to the
		 *  type-root (so they can be cleared) for the types that store them structurally; everything else
		 *  goes to the detail base. Returns null when neither exists (a gap). */
		_classicFollowerPath({ ftype, slug }, field, { structuralFirst = false } = {}) {
			const FLAGS = {
				"animal-companion": { detailBase: "animalCompanion.details", structural: { name: "animalCompanion.name", instinct: "animalCompanion.instinct", cost: "animalCompanion.cost" } },
				"crew":             { detailBase: "crew.details",            structural: { name: "crew.name", instinct: "crew.instinct", cost: "crew.cost" } },
				"initiate":         { detailBase: `initiateDetails.${slug}`, structural: {} },
				"beast":            { detailBase: `beastDetails.${slug}`,    structural: {} },
				"custom":           { detailBase: `customFollowers.${slug}`, structural: {} },
			}[ftype];
			if (!FLAGS) return null;
			if (structuralFirst && FLAGS.structural[field]) return FLAGS.structural[field];
			return FLAGS.detailBase ? `${FLAGS.detailBase}.${field}` : null;
		}

		/** Loyalty flag path per fork follower type (mirrors _FOLLOWER_FLAGS). */
		_classicFollowerLoyaltyPath({ ftype, slug }) {
			switch (ftype) {
				case "animal-companion": return "animalCompanion.loyalty";
				case "crew":             return "crew.loyalty";
				case "initiate":         return `initiatesLoyalty.${slug}`;
				case "beast":            return `beastLoyalty.${slug}`;
				case "custom":           return `customFollowers.${slug}.loyalty`;
				default:                 return null;
			}
		}

		/** Flag path for a follower's editable tags array. Only the user-authored types store a free tag
		 *  list (custom -> customFollowers.<id>.tags, crew -> crew.tags); the rules-derived types
		 *  (animal-companion / beast / initiate) derive their tags, so there is no editable store. */
		_classicFollowerTagsPath({ ftype, slug }) {
			switch (ftype) {
				case "custom": return `customFollowers.${slug}.tags`;
				case "crew":   return "crew.tags";
				default:       return null;
			}
		}

		/** Toggle a tag on the follower owning `el` (remove if present, add if absent), then re-render.
		 *  No-ops for follower types whose tags are rules-derived (no editable store). */
		async _classicToggleFollowerTag(el, tag) {
			const value = String(tag ?? "").trim();
			if (!value) return;
			const r = this._classicFollowerRoute(el);
			if (!r) return;
			const path = this._classicFollowerTagsPath(r);
			if (!path) return;
			const current = this.actor.getFlag("stonetop", path);
			const tags = Array.isArray(current) ? [...current] : [];
			const i = tags.findIndex(t => String(t).toLowerCase() === value.toLowerCase());
			if (i >= 0) tags.splice(i, 1);
			else        tags.push(value);
			await this.actor.setFlag("stonetop", path, tags);
			this.render(false);
		}

		/** @override - strip the fork's master edit-toggle wrench from the window header (the Classic sheet
		 *  is gated on ownership, not a global edit mode — see _buildClassicContext; its CSS-hook classes are
		 *  dropped so the toggle renders unstyled/invisible anyway). Mirrors the Classic steading sheet. Then
		 *  upgrade [[ ]] rolls / @UUID links in his .stonetop-rich blocks. */
		async _render(force, options) {
			await super._render(force, options);
			const root = this.element?.[0] ?? this.element;
			root?.querySelector?.(".window-header .stonetop-header-toggle")?.remove();
			await enrichRichTokens(root, { rollData: this.actor?.getRollData?.() ?? {} });
		}
	};
}

// Stable-reorder `moves` so any whose `name` appears in `names` lead, in that list's order; the rest
// keep their original relative order and follow.
function _orderByNames(moves, names) {
	const rank = new Map(names.map((n, i) => [n, i]));
	return [...moves].sort((a, b) => {
		const ra = rank.has(a.name) ? rank.get(a.name) : names.length;
		const rb = rank.has(b.name) ? rank.get(b.name) : names.length;
		return ra - rb;
	});
}
