import {
	LoreOptionSnapshotBuilder,
	LoreEntrySnapshotBuilder,
	LoreSection,
	AppearanceLineSnapshot,
	AppearanceOptionSnapshot,
	AppearanceSection,
	BackgroundChoiceOptionSnapshot,
	BackgroundChoicesSnapshotBuilder,
	BackgroundOptionSnapshotBuilder,
	BackgroundSection,
	CharacterSnapshotBuilder,
	DebilitySnapshotBuilder,
	InstinctOptionSnapshotBuilder,
	InstinctSection,
	InventoryItemSnapshotBuilder,
	InventorySegmentSnapshot,
	InventorySnapshot,
	LoadSnapshotBuilder,
	MoveCategorySnapshotBuilder,
	MoveGroupSnapshot,
	MovelistBuilder,
	MoveSnapshotBuilder,
	OriginOptionSnapshot,
	OriginSection,
	OtherItemSnapshotBuilder,
	OutfitSnapshotBuilder,
	PlaybookSnapshotBuilder,
	PossessionItemSnapshotBuilder,
	PossessionsSnapshot,
	RequirementSnapshot,
	ResourceBuilder,
	StatSnapshot,
	ValueMax,
	VitalsSnapshotBuilder,
} from "../../model/CharacterSnapshot.js";
import {PlaybookMoveEntry} from "./PlaybookMoveEntry.js";
import {MoveResources} from "./MoveResources.js";
import {StonetopFlags, STONETOP_SCOPE, ITEM_FLAG_SCOPE, resolvedFlags, resolvedFlagProperty} from "./StonetopFlags.js";
import {heroDisplayName, WBH_HERO_FLAG} from "./WouldBeHeroAsterisk.js";
import {CharacterBackgrounds} from "./CharacterBackgrounds.js";
import {CharacterInstincts} from "./CharacterInstincts.js";
import {CharacterAppearance} from "./CharacterAppearance.js";
import {CharacterOrigin} from "./CharacterOrigin.js";
import {CharacterPossessions} from "./CharacterPossessions.js";
import {CharacterInventory} from "./CharacterInventory.js";
import {CharacterArcana} from "./CharacterArcana.js";
import {CharacterLore} from "./CharacterLore.js";
import {CharacterPostDeath, buildLoreSection} from "./CharacterPostDeath.js";
import {FoundryRepositoryFactory} from "./repositories/FoundryRepositoryFactory.js";
import {capitalizeFirst, slugify, composeInstinct} from "../../utils/strings.js";
import {localize as _loc} from "../../utils/i18n.js";
import {getStonetopSteadingActor} from "../../utils/world.js";
import {normalizeRollType} from "../../utils/roll-types.js";
import {deriveLoadLevel, loadLimitsFor} from "../../utils/load.js";
import {maxDie, stepDie} from "../../utils/damage-die.js";

const OTHER_MOVE_TYPES = ["background", "special", "follower", "homefront"];
const ROLL_LABELS_BY_TYPE = {
	str: "STR",
	dex: "DEX",
	int: "INT",
	wis: "WIS",
	con: "CON",
	cha: "CHA",
};
const HOMEFRONT_ROLL_LABELS_BY_NAME = {
	"Deploy": "Defenses",
	"Muster": "Population",
	"Pull Together": "Population",
	"Seasons Change": "Fortunes",
	"Trade & Barter": "Prosperity",
};
const ORIGIN_DESCRIPTIONS = {
	barrierPass: "<p>Blocked by a massive wall and gate, held by stoic, unfriendly folk who want little to do with strangers. They live on mountain goats and sheep, brook no trespass, and only rarely come down to trade ancient wonders for crops or livestock.</p>",
	gordinsDelve: "<p>A mining town in the Huffel Peaks. Folk make their way there when they are on the run or have nothing left back home, drawn by Maker-made passages that plunge beneath the mountains and by rare trade from the mask-wearing Ustrina.</p>",
	lygos: "<p>The towns of the arid south lie far beyond Marshedge. Trade is steady between them and the South Manmarch, but they are distant from Stonetop, about thirty days from Marshedge by road.</p>",
	manmarch: "<p>The <strong>North Manmarch</strong> is home to aggressive, warlike folk who dwell in wooden longhouses and are caught in an eternal cycle of blood-feud. The <strong>South Manmarch</strong> is more sparsely inhabited, with nomads hunting aurochs herds and trading with Marshedge and Lygos.</p>",
	marshedge: "<p>A proper town, with a wooden palisade, market, and town council. They grow hemp and wheat and gather wild rice and herbs from Ferrier's Fen, though Brennan and his old gang, the Claws, dominate the town watch.</p>",
	steplands: "<p>A rugged wilderness, home to the nomadic Hillfolk: horselords and shepherds, fierce to outsiders. They trade horses, wool, and salt, revile Gordin's Delve for prying sacred metals from the earth, and warn travelers away from ancient burial mounds.</p>",
	stonetop: "<p>A tight-knit village of about three hundred souls, built around a massive standing stone at the edge of the Great Wood. Everyone is expected to pull their weight, take their turn at guard duty, and help protect the community when danger comes.</p>",
	wild: "<p>The area around Stonetop includes the Great Wood, the Flats, and other dangerous places beyond the roads. The Forest Folk have vanished, crinwin grow bolder, and hunters bring back stories of fresh ruins, strange spirits, and twisted things in the trees.</p>",
};

function _normalizeSheetRollMode(rollMode) {
	return ["adv", "dis"].includes(rollMode) ? rollMode : "normal";
}

// Slugs whose resource max equals 4+Prosperity. Matches the `prosperityResource`
// flag in the JSON source; acts as the runtime fallback until the pack is
// recompiled with that flag present in the LevelDB.
const _PROSPERITY_RESOURCE_SLUGS = new Set(["supplies", "more-supplies", "even-more-supplies"]);

// Resolve "x piercing" against the steading's Prosperity for display. With Prosperity
// 1+ it shows the actual value ("2 piercing"); at 0, no steading (null), or negative,
// the literal "x piercing" trait is left in place so it always shows on the sheet.
function _transformPiercingNote(note, prosperity) {
	if (!note || !note.includes('x <em>piercing</em>')) return note;
	if (prosperity === null) return note; // no steading → leave literal "x piercing"
	if (prosperity <= -1) return note.replace('x <em>piercing</em>', '<em>crude</em>');
	return note.replace('x <em>piercing</em>', `${Math.min(prosperity, 2)} <em>piercing</em>`);
}

// A move can raise every load cap via its `loadBonus` field (the Ranger's Pack
// Horse sets it to 1). The caps and the count→tier bucketing live in utils/load.js
// so the sheet, snapshot defaults, and dialog can't drift.
function _ownedLoadBonus(actor) {
	return actor.items
		.filter(i => i.type === "move")
		.reduce((sum, i) => sum + (Number(i.system?.loadBonus) || 0), 0);
}

// The standard Shield inventory item (Book I p.86). The Heavy/Judge/Marshal's Armored
// move halves its ◇ load — see _ownedShieldLoadReduction.
const _SHIELD_SLUG = "shield";

// The Armored move ("carry a shield, mark only ◆ instead of ◆◆") drops a carried shield's
// ◇ load by its `shieldLoadReduction`. Like loadBonus, the mechanic lives in the move's data
// so buildSnapshot never hard-codes a move name.
function _ownedShieldLoadReduction(actor) {
	return actor.items
		.filter(i => i.type === "move")
		.reduce((sum, i) => sum + (Number(i.system?.shieldLoadReduction) || 0), 0);
}

export class StonetopCharacter {
	constructor(actor, repos) {
		this._actor = actor;
		this._playbookRepo        = repos.playbook;
		this._moveRepo            = repos.moves;
		this._inventoryRepo       = repos.inventory;
		this._postDeathInsertRepo = repos.postDeathInsert;
		this._background = new CharacterBackgrounds(new StonetopFlags(actor, "background"));
		this._instinct = new CharacterInstincts(new StonetopFlags(actor, "instinct"));
		this._appearance = new CharacterAppearance(new StonetopFlags(actor, "appearance"));
		this._origin = new CharacterOrigin(new StonetopFlags(actor, "origin"));
		this._moveResources = new MoveResources(new StonetopFlags(actor, "moves"));
		this._possessions = new CharacterPossessions(new StonetopFlags(actor, "possessions"));
		this._inventory = new CharacterInventory(new StonetopFlags(actor, "inventory"));
		this._arcana = new CharacterArcana(new StonetopFlags(actor, "arcana"), repos.arcana);
		this._lore = new CharacterLore(new StonetopFlags(actor, "lore"));
		this._postDeath = new CharacterPostDeath(
			new StonetopFlags(actor, "postDeathInsert"),
			new CharacterInstincts(new StonetopFlags(actor, "postDeathInstinct")),
			new CharacterLore(new StonetopFlags(actor, "postDeathLore")),
			repos.postDeathInsert,
			repos.moves,
		);
	}

	static create(actor) {
		return new StonetopCharacter(actor, new FoundryRepositoryFactory());
	}

	get type() { return this._actor.type; }
	get background() { return this._background; }
	get instinct() { return this._instinct; }
	get appearance() { return this._appearance; }
	get origin() { return this._origin; }
	get moveResources() { return this._moveResources; }
	get possessions() { return this._possessions; }

	get _characterLevel() { return this._actor.system?.attributes?.level?.value ?? 1; }

	// Potential-for-Greatness stat slot: choosing a stat writes +1 to that stored
	// stat (and reverts the previously chosen one), recording the level it was
	// marked on. Newly filled slots auto-fill the current level.
	async setStatSlot(moveName, optionSlug, index, newStat) {
		const entries = _markEntries(this._moveResources.getMarks()[moveName]?.[optionSlug]);
		while (entries.length <= index) entries.push({ stat: "", level: null });
		const oldStat = entries[index].stat ?? "";
		if (oldStat === newStat) return;
		const stats = this._actor.system?.stats ?? {};
		const updates = {};
		if (oldStat && stats[oldStat]) updates[`system.stats.${oldStat}.value`] = (stats[oldStat].value ?? 0) - 1;
		if (newStat && stats[newStat]) updates[`system.stats.${newStat}.value`] = (stats[newStat].value ?? 0) + 1;
		entries[index] = { stat: newStat, level: newStat ? (oldStat ? entries[index].level : this._characterLevel) : null };
		// One document write: the stat deltas and the mark record together.
		await this._actor.update({ ...updates, ...this._moveResources.markUpdate(moveName, optionSlug, entries) });
	}

	// Checkbox mark options (e.g. max HP, damage die): set how many are checked,
	// auto-filling the current level on newly checked marks.
	async setCountMark(moveName, optionSlug, newCount) {
		const entries = _markEntries(this._moveResources.getMarks()[moveName]?.[optionSlug]);
		while (entries.length < newCount) entries.push({ stat: "", level: this._characterLevel });
		entries.length = Math.max(0, newCount);
		await this._actor.update(this._moveResources.markUpdate(moveName, optionSlug, entries));
	}

	// Edit-mode override of the level recorded for a given mark slot.
	async setMarkLevel(moveName, optionSlug, index, level) {
		const entries = _markEntries(this._moveResources.getMarks()[moveName]?.[optionSlug]);
		if (!entries[index]) return;
		entries[index] = { ...entries[index], level: Number.isFinite(level) && level > 0 ? level : null };
		await this._actor.update(this._moveResources.markUpdate(moveName, optionSlug, entries));
	}

	async updateName(name) {
		const previousName = this._actor.name ?? "";
		const prototypeTokenName = this._actor.prototypeToken?.name;
		const updates = { name };
		if (!prototypeTokenName || prototypeTokenName === previousName) {
			updates["prototypeToken.name"] = name;
		}
		await this._actor.update(updates);
	}

	async playbook() {
		const slug = this._actor.system?.playbook?.slug;
		if (!slug) return null;
		return this._playbookRepo.findBySlug(slug);
	}

	async buildSnapshot() {
		const actor = this._actor;
		const actorLevel = actor.system?.attributes?.level?.value ?? 1;
		const playbookData = await this.playbook();
		const ownedAllByName = this._buildOwnedMovesMap();
		const moves    = await this._buildMovesSection(playbookData, ownedAllByName, actorLevel);
		const inventory = await this._buildInventorySection(playbookData, ownedAllByName, actorLevel);
		const allOutfitItems = await this._inventoryRepo.getAll();
		const postDeath = await this._postDeath.buildSnapshot();
		const pdiLabel  = postDeath.activeInsert?.name ?? null;
		const moveBonuses = await this._ownedMoveBonuses(playbookData, ownedAllByName);
		// Armor counts standard items plus any special items the character has added —
		// never an unadded special item whose checked flag happens to linger.
		const addedSet = new Set(this._inventory.addedSpecial);
		const armorItems = allOutfitItems.filter(i => !i.special || addedSet.has(i.slug));
		const armor = this._inventory.calculateArmor(armorItems) + moveBonuses.armor;
		const arcanaLore = (playbookData?.lore ?? []).some(e => e.arcanaImage || (e.options ?? []).some(o => o.arcanaRole))
			? await this._arcana.buildLoreDisplay()
			: null;
		return new CharacterSnapshotBuilder()
			.withName(actor.name)
			.withPlaybook(playbookData ? _buildPlaybookSection(playbookData, this._background, this._instinct, this._appearance, this._origin, this._lore, actor.name, arcanaLore, !!this._actor.getFlag(STONETOP_SCOPE, WBH_HERO_FLAG), actorLevel) : null)
			.withDebilities(_buildDebilitiesSection(actor))
			.withStats(_buildStatsSection(actor))
			.withVitals(_buildVitalsSection(actor, playbookData, armor, moveBonuses))
			.withMoves(moves)
			.withMovelist(_buildMovelist(moves, inventory.other, pdiLabel))
			.withInventory(inventory)
			.withArcana(await this._arcana.buildSnapshot(actor.system.stats ?? {}, this._inventory.checked, this._inventory.resources))
			.withPostDeathInsert(postDeath)
			.withRollMode(_normalizeSheetRollMode(resolvedFlags(actor).rollMode))
			.withCrewBonuses(_buildCrewStats(playbookData?.crew, moveBonuses))
			.build();
	}

	// Sum the max-HP and armor bonuses granted by owned playbook moves (e.g. the
	// Heavy's Carved Out of Wood / Cut from Granite). Read from the move definitions
	// so it works regardless of when the owned copy was added.
	async _ownedMoveBonuses(playbookData, ownedAllByName) {
		const totals = { hp: 0, armor: 0, crewHp: 0, damageDie: null, crewDamageSteps: 0, crewDamageCap: "d10", crewRollSteps: 0 };
		if (!playbookData) return totals;
		const defs  = await this._moveRepo.getPlaybookMoves(playbookData.name);
		const marks = this._moveResources.getMarks();
		for (const m of defs) {
			if (!ownedAllByName.has(m.name)) continue;
			totals.hp    += m.hpBonus    || 0;
			totals.armor += m.armorBonus || 0;
			// Per-option marks (e.g. Potential for Greatness): apply each checked box.
			const moveMarks = marks[m.name] ?? {};
			for (const opt of (m.markOptions ?? [])) {
				// Stat-choice marks (e.g. Potential for Greatness) store an array of
				// chosen stats and are applied directly to the stored stats on change,
				// not derived here — multiplying by the array would yield NaN.
				if (opt.choice === "stat") continue;
				const count = _markEntries(moveMarks[opt.slug]).length;
				if (!count) continue;
				totals.hp     += (opt.hp     || 0) * count;
				totals.armor  += (opt.armor  || 0) * count;
				totals.crewHp += (opt.crewHp || 0) * count;
				if (opt.damageDie) totals.damageDie = maxDie(totals.damageDie, opt.damageDie);
				totals.crewDamageSteps += (opt.crewDamageStep || 0) * count;
				if (opt.crewDamageCap) totals.crewDamageCap = opt.crewDamageCap;
				totals.crewRollSteps += (opt.crewRoll || 0) * count;
			}
		}
		return totals;
	}

	async _buildMovesSection(playbookData, ownedAllByName, actorLevel) {
		const categories = [];

		if (playbookData) {
			const background = playbookData.backgrounds?.find(b => b.slug === this._background.selectedSlug);
			const bgMoveNames = new Set(background?.moves ?? []);
			const bgSlugs = new Set([...bgMoveNames].map(slugify));
			const entries = await this._moveRepo.getPlaybookMoves(playbookData.name);
			if (entries.length > 0) {
				const sorted = this.sortPlaybookMoves(
					this.buildMovelistContext(entries, ownedAllByName, bgMoveNames, actorLevel, playbookData.name)
				);
				const moveResourcesMap = this._moveResources.getMoveResources();
				const moveMarksMap     = this._moveResources.getMarks();
				const moveBackgroundAnswers = resolvedFlags(this._actor).moves?.backgroundAnswers ?? {};
				const improvedStatChoices   = resolvedFlags(this._actor).improvedStatChoices ?? {};
				const source = { type: "playbook", slug: playbookData.slug };
				categories.push(new MoveCategorySnapshotBuilder()
					.withKey("playbook")
					.withTitle(`${playbookData.name} Moves`)
					.withNote(playbookData.startingMovesNote ?? null)
					.withMoves(_sortOwnedFirst(sorted.map(m => _buildMoveEntry(m, source, moveResourcesMap, bgSlugs, moveBackgroundAnswers, improvedStatChoices, moveMarksMap))))
					.build()
				);
			}
		}

		const basicEntries = (await this._moveRepo.getBasicMoves()).sort((a, b) => {
			if (a.name === "Aid") return -1;
			if (b.name === "Aid") return 1;
			return a.name.localeCompare(b.name);
		});
		const basicCategory = _buildCompendiumMoveCategory(basicEntries, { key: "basic", title: "Basic Moves" }, ownedAllByName);
		if (basicCategory) categories.push(basicCategory);

		const expeditionEntries = (await this._moveRepo.getExpeditionMoves()).sort((a, b) => a.name.localeCompare(b.name));
		const expeditionCategory = _buildCompendiumMoveCategory(expeditionEntries, { key: "expedition", title: "Expedition Moves" }, ownedAllByName);
		if (expeditionCategory) categories.push(expeditionCategory);

		for (const moveType of OTHER_MOVE_TYPES) {
			const items = this._actor.items.filter(i => i.type === "move" && i.system?.moveType === moveType);
			if (items.length > 0) {
				categories.push(new MoveCategorySnapshotBuilder()
					.withKey(moveType)
					.withTitle(capitalizeFirst(moveType) + " Moves")
					.withNote(null)
					.withMoves(items.map(i => new MoveSnapshotBuilder()
						.withId(i._id)
						.withCompendiumId(i._id)
						.withOwnedId(i._id)
						.withName(i.name)
						.withDescription(i.system?.description ?? "")
						.withRollType(i.system?.rollType ?? null)
						.withRollLabel(_rollLabelForMove(i.name, i.system?.rollType, i.system))
						.withIsStarting(false)
						.withSource({ type: moveType })
						.withSourceLabel(null)
						.withOwned(true)
						.withOwnedIds([i._id])
						.withLocked(false)
						.withRequirement(null)
						.withRequiresLabel(null)
						.withResource(null)
						.withRepeat(null)
						.withRepeatable(false)
						.build()
					))
					.build()
				);
			}
		}

		const postDeathItems = this._actor.items.filter(i => i.type === "move" && i.system?.moveType === "post-death");
		if (postDeathItems.length > 0) {
			categories.push(new MoveCategorySnapshotBuilder()
				.withKey("post-death")
				.withTitle("Post-Death Moves")
				.withNote(null)
				.withMoves(postDeathItems.map(i => new MoveSnapshotBuilder()
					.withId(i._id)
					.withCompendiumId(i._id)
					.withOwnedId(i._id)
					.withName(i.name)
					.withDescription(i.system?.description ?? "")
					.withRollType(i.system?.rollType ?? null)
					.withRollLabel(_rollLabelForMove(i.name, i.system?.rollType, i.system))
					.withIsStarting(true)
					.withSource({ type: "post-death" })
					.withSourceLabel(null)
					.withOwned(true)
					.withOwnedIds([i._id])
					.withLocked(false)
					.withRequirement(null)
					.withRequiresLabel(null)
					.withResource(null)
					.withRepeat(null)
					.withRepeatable(false)
					.build()
				))
				.build()
			);
		}

		return categories;
	}

	async _buildInventorySection(playbookData, ownedAllByName, actorLevel) {
		const checked        = this._inventory.checked;
		const resources      = this._inventory.resources;
		const rPool          = this._inventory.regularPool;
		const sPool          = this._inventory.smallPool;
		const allItems       = await this._inventoryRepo.getAll();
		const steadingActor  = this.getSteadingActor();
		const smallItemLimit = this.getSmallItemLimit(steadingActor);
		const steadingName   = steadingActor?.name ?? null;
		const prosperity     = smallItemLimit !== null ? smallItemLimit - 4 : null;
		// A move's `loadBonus` raises every load cap (the Ranger's Pack Horse → +1).
		// The boosted limits flow into the regular ◇ pool here and into the Outfit
		// dialog via the snapshot. hasPackHorse drives the boosted help text/note.
		const loadBonus      = _ownedLoadBonus(this._actor);
		const hasPackHorse   = loadBonus > 0;
		const loadLimits     = loadLimitsFor(loadBonus);
		// The Armored move drops a carried shield to ◆ (1 ◇) instead of ◆◆; floored at 1.
		const shieldLoadReduction = _ownedShieldLoadReduction(this._actor);

		const mapItem = (outfitItem) => {
			const res    = outfitItem.resource;
			const isProsperityResource = outfitItem.prosperityResource
				|| _PROSPERITY_RESOURCE_SLUGS.has(outfitItem.slug);
			const resMax = (isProsperityResource && smallItemLimit !== null)
				? smallItemLimit
				: res?.max;
			// Armored reduces a carried shield's ◇ cost (min 1), so it reads ◆ instead of ◆◆.
			const weight = (outfitItem.slug === _SHIELD_SLUG && shieldLoadReduction > 0)
				? Math.max(1, outfitItem.weight - shieldLoadReduction)
				: outfitItem.weight;
			return new InventoryItemSnapshotBuilder()
				.withSlug(outfitItem.slug)
				.withName(outfitItem.name)
				.withNote(_transformPiercingNote(outfitItem.note, prosperity))
				.withWeight(weight)
				.withChecked(checked[outfitItem.slug] ?? false)
				.withResource(res ? new ResourceBuilder()
					.withCurrent(Math.min(resources[outfitItem.slug] ?? 0, resMax ?? 0))
					.withMax(resMax)
					.withTitle(res.title ?? null)
					.withLabels(res.labels ?? [])
					.build() : null)
				.withIsCustom(false)
				.withOwnedId(null)
				.withTwoCol(outfitItem.twoCol)
				.withBreakBefore(outfitItem.breakBefore)
				.build();
		};

		const customItems = this._actor.items.filter(i =>
			i.type === "move" && i.system?.moveType === "inventory-custom"
		);
		const mapCustomItem = item => new InventoryItemSnapshotBuilder()
			.withSlug(item._id)
			.withName(item.name)
			.withNote(null)
			.withWeight(item.system.weight ?? 1)
			.withChecked(checked[item._id] ?? false)
			.withResource(null)
			.withIsCustom(true)
			.withOwnedId(item._id)
			.withTwoCol(false)
			.withBreakBefore(false)
			.build();

		// Special (handout) items are kept off the default checklist; they appear only
		// once the player adds them via the "Add Special Item" picker.
		const addedSpecialSet = new Set(this._inventory.addedSpecial);
		const mapAddedSpecial = i => { const s = mapItem(i); s.isAddedSpecial = true; return s; };
		const addedSpecial = allItems.filter(i => i.special && addedSpecialSet.has(i.slug));
		const standardItems = allItems.filter(i => !i.special);

		// Gear granted by authored custom possessions (Taylor's nested possession→outfit-items):
		// derived descriptors that flow through the normal mapItem builder into the gear columns.
		const grantedItems = this._possessions.grantedOutfitItems();

		const arcanaItems = await this._arcana.weightedInventoryItems();
		const arcanaSection = arcanaItems.filter(i => i.inventoryColumn === "arcana").map(mapItem);
		const allSmall = standardItems.filter(i => i.inventoryColumn === "small");
		const regularNonArcana = [
			...standardItems.filter(i => i.inventoryColumn === "regular").map(mapItem),
			...addedSpecial.filter(i => i.inventoryColumn === "regular").map(mapAddedSpecial),
			...customItems.filter(i => i.system.inventoryColumn === "regular").map(mapCustomItem),
			...grantedItems.filter(i => i.inventoryColumn === "regular").map(mapItem),
		];
		const regularArcana = arcanaItems.filter(i => i.inventoryColumn === "regular").map(mapItem);
		if (regularArcana.length > 0 && regularNonArcana.length > 0) regularArcana[0].breakBefore = true;
		const flatRegular = [...regularNonArcana, ...regularArcana];

		let possessions = null;
		if (playbookData?.specialPossessions) {
			const maxUsesMap = this.computePossessionMaxUses(playbookData.specialPossessions, ownedAllByName, actorLevel);
			possessions = this._buildPossessionsSnapshot(playbookData.specialPossessions, maxUsesMap, prosperity);
		}

		const other = this._actor.items
			.filter(i => i.type === "move" && i.system?.moveType === "other")
			.map(i => new OtherItemSnapshotBuilder()
				.withId(i._id)
				.withName(i.name)
				.withDescription(i.system?.description ?? null)
				.withMoveType(i.system?.moveType ?? null)
				.withOwnedId(i._id)
				.build()
			);

		// Load is derived from the ◇ actually marked — checked item weights plus the
		// undefined regular pool — never stored. Marking loot or editing the pool
		// directly just re-derives it, matching the book's "count what you've marked."
		const allRegularForLoad    = [...flatRegular, ...arcanaSection];
		const checkedRegularWeight = allRegularForLoad
			.filter(i => i.checked).reduce((sum, i) => sum + (i.weight ?? 0), 0);
		// The undefined pool can hold whatever's left under the heavy cap; the stored
		// count is clamped to that so the reserve never pushes the load past heavy.
		const regularPoolMax     = Math.max(0, loadLimits.heavy - checkedRegularWeight);
		const regularPoolCurrent = Math.min(rPool, regularPoolMax);
		// The ◇ track always shows the full load capacity, so the diamonds never vanish
		// as you mark items: reserve that no longer fits under the cap simply renders as
		// empty ◇ (clicking one warns you're at your limit — see regularPoolCap). Only a
		// Pack Horse / loadBonus move raises the cap (to 10), so an overloaded carry still
		// tops out at heavy rather than sprouting extra ◇.
		const regularPoolSlots   = loadLimits.heavy;
		const totalRegularMarks  = checkedRegularWeight + regularPoolCurrent;
		// Manual load-level override (Classic parity with Taylor's clickable load radios): a set override
		// wins over the weight-derived level; null/absent => derive from marked weight as normal.
		const loadOverride       = this._actor.getFlag?.(STONETOP_SCOPE, "overrides")?.loadLevel ?? null;
		const derivedLoadLevel   = loadOverride ?? deriveLoadLevel(totalRegularMarks, loadLimits);

		const load = new LoadSnapshotBuilder()
			.withInstruction(_loc("stonetop.inventory.outfit.heading"))
			.withSelected(derivedLoadLevel)
			.withLoadLevelLight(derivedLoadLevel === "light")
			.withLoadLevelNormal(derivedLoadLevel === "normal")
			.withLoadLevelHeavy(derivedLoadLevel === "heavy" || derivedLoadLevel === "overloaded")
			.withLoadLevelOverloaded(derivedLoadLevel === "overloaded")
			.withTotalMarks(totalRegularMarks)
			.build();

		const addedSmall = addedSpecial.filter(i => i.inventoryColumn === "small");
		const smallItems = [
			...allSmall.filter(i => !i.smallGrid).map(mapItem),
			...addedSmall.filter(i => !i.smallGrid).map(mapAddedSpecial),
			...customItems.filter(i => i.system.inventoryColumn === "small").map(mapCustomItem),
			...grantedItems.filter(i => i.inventoryColumn === "small").map(mapItem),
			...arcanaItems.filter(i => i.inventoryColumn === "small").map(mapItem),
		];
		const smallGridItems = allSmall.filter(i => i.smallGrid).map(mapItem);

		// Small marks are likewise derived: the undefined □ pool fills the room left
		// under the 4+Prosperity Outfit allotment after checked small items.
		const checkedSmallCount = [...smallItems, ...smallGridItems].filter(i => i.checked).length;
		const smallPoolMax     = Math.max(0, (smallItemLimit ?? 9) - checkedSmallCount);
		const smallPoolCurrent = Math.min(sPool, smallPoolMax);
		// Like the ◇ track, the □ track always shows the full 4+Prosperity allotment, so
		// boxes never vanish as small items are marked.
		const smallPoolSlots   = smallItemLimit ?? 9;

		const outfit = new OutfitSnapshotBuilder()
			.withLoad(load)
			.withRegularItems(flatRegular)
			.withRegularSegments(_segmentByTwoCol(flatRegular))
			.withRegularPool(new ResourceBuilder().withCurrent(regularPoolCurrent).withMax(regularPoolSlots).withTitle(null).withLabels([]).build())
			.withRegularPoolCap(regularPoolMax)
			.withSmallItems(smallItems)
			.withSmallGridItems(smallGridItems)
			.withSmallPool(new ResourceBuilder().withCurrent(smallPoolCurrent).withMax(smallPoolSlots).withTitle(null).withLabels([]).build())
			.withSmallPoolCap(smallPoolMax)
			.withArcanaItems(arcanaSection)
			.withSmallItemLimit(smallItemLimit)
			.withSteadingName(steadingName)
			.withHasPackHorse(hasPackHorse)
			.withLoadLimits(loadLimits)
			.build();

		return new InventorySnapshot(outfit, possessions, other);
	}

	_buildPossessionsSnapshot(specialPossessions, maxUsesMap, prosperity = null) {
		const { pickNote, pickCount, preselected = [], options } = specialPossessions;
		const selectedSlugs = this._possessions.selected;
		const usesMap = this._possessions.uses;
		const preselectedSet = new Set(preselected);

		let chosenCount = 0;
		const items = options.map(opt => {
			const isPre = preselectedSet.has(opt.slug);
			const isSelected = isPre || selectedSlugs.has(opt.slug);
			if (isSelected && !isPre) chosenCount++;
			const maxUses = maxUsesMap[opt.slug] ?? opt.resource?.max ?? null;
			const currentUses = isSelected ? (usesMap[opt.slug] ?? 0) : 0;
			const resourceDef = opt.resource ?? null;
			const resource = resourceDef ? new ResourceBuilder()
				.withCurrent(currentUses)
				.withMax(maxUses ?? resourceDef.max)
				// Title is rendered separately as the italic `usesLabel` in the
				// possessions block; leave it off the resource so the shared
				// resource-track partial doesn't render a duplicate label.
				.withTitle(null)
				.withLabels(resourceDef.labels ?? [])
				.build() : null;
			return new PossessionItemSnapshotBuilder()
				.withSlug(opt.slug)
				.withLabel(opt.label)
				// "x piercing" weapons (e.g. the Ranger's composite bow) resolve to the
				// steading's Prosperity for display here, just like outfit items — onboarding
				// keeps the literal "x" since it renders the raw playbook description instead.
				.withDescription(_transformPiercingNote(opt.description ?? "", prosperity))
				.withSelected(isSelected)
				.withChecked(isSelected)
				.withDisabled(isPre)
				.withPreselected(isPre)
				.withPreselectedSource(isPre ? "Starting move" : null)
				.withResource(resource)
				.withUsesLabel(resourceDef?.title ?? null)
				.withChoices(null)
				.withChoiceGroups(null)
				.build();
		});

		// Player-written "something else (discuss with GM)" possessions live in their own
		// flag (they match no listed option), so append them after the list. Each spends a
		// pick like any other choice, and is removed via the × button rather than a checkbox.
		const customItems = this._possessions.custom.map(c => {
			chosenCount++;
			return new PossessionItemSnapshotBuilder()
				.withSlug(c.slug)
				.withLabel(c.label)
				.withDescription("")
				.withSelected(true)
				.withChecked(true)
				.withDisabled(true)
				.withPreselected(false)
				.withPreselectedSource(null)
				.withResource(null)
				.withUsesLabel(null)
				.withChoices(null)
				.withChoiceGroups(null)
				.withCustom(true)
				.build();
		});

		// Fully player-authored possessions (the "Add Custom Possession" dialog): like the write-ins
		// but carry a description and an optional resource track, and offer an Edit affordance.
		const authoredItems = this._possessions.authored.map(c => {
			chosenCount++;
			const resDef = c.resource ?? null;
			const resource = resDef ? new ResourceBuilder()
				.withCurrent(usesMap[c.slug] ?? 0)
				.withMax(resDef.max ?? 0)
				.withTitle(null)
				.withLabels(resDef.labels ?? [])
				.build() : null;
			return new PossessionItemSnapshotBuilder()
				.withSlug(c.slug)
				.withLabel(c.label)
				.withDescription(c.description ?? "")
				.withSelected(true)
				.withChecked(true)
				.withDisabled(true)
				.withPreselected(false)
				.withPreselectedSource(null)
				.withResource(resource)
				.withUsesLabel(resDef?.title ?? null)
				.withChoices(null)
				.withChoiceGroups(null)
				.withCustom(true)
				.withAuthored(true)
				.build();
		});

		const isIncomplete = pickCount > 0 && chosenCount < pickCount;
		return new PossessionsSnapshot(pickCount, pickNote, [...items, ...customItems, ...authoredItems], isIncomplete);
	}

	async setPostDeathInsert(slug) {
		const toRemove = this._actor.items
			.filter(i => i.type === "move" && i.system?.moveType === "post-death")
			.map(i => i._id);
		if (toRemove.length > 0) {
			await this._actor.deleteEmbeddedDocuments("Item", toRemove);
		}
		await this._postDeath.setActiveSlug(slug);
		if (slug) {
			const entries = await this._moveRepo.getPostDeathMoves(slug);
			await this._actor.createEmbeddedDocuments("Item", entries.map(m => ({
				name: m.name,
				type: "move",
				system: { moveType: "post-death", rollType: m.rollType ?? "", description: m.description ?? "" },
			})));
		}
	}
	async setPostDeathInstinct(value)                    { await this._postDeath.instinct.select(value); }
	async setPostDeathLoreCount(loreSlug, optSlug, n)    { await this._postDeath.lore.setCount(loreSlug, optSlug, n); }
	async setPostDeathLoreText(loreSlug, optSlug, value) { await this._postDeath.lore.setText(loreSlug, optSlug, value); }

	async setInventoryItemChecked(slug, isChecked) { await this._inventory.setItemChecked(slug, isChecked); }
	async setInventoryResource(slug, count)         { await this._inventory.setResource(slug, count); }
	async setInventoryRegularPool(count)            { await this._inventory.setRegularPool(count); }
	async setInventorySmallPool(count)              { await this._inventory.setSmallPool(count); }
	async removeSpecialItem(slug)                   { await this._inventory.removeSpecial(slug); }

	getSteadingActor() {
		const storedSteadingId = resolvedFlagProperty(this._actor, "steadingId");
		return (storedSteadingId ? game.actors?.get(storedSteadingId) : null)
			?? getStonetopSteadingActor();
	}

	getSmallItemLimit(steading = this.getSteadingActor()) {
		const rawProsperity = (steading ? resolvedFlagProperty(steading, "steading.system.attributes.prosperity.value") : null)
			?? steading?.system?.attributes?.prosperity?.value;
		if (rawProsperity == null) return null;
		const prosperity = Number(rawProsperity);
		return isNaN(prosperity) ? null : 4 + prosperity;
	}

	/**
	 * Have What You Need (one-click): marking a specific item on the Inventory tab
	 * draws marks from the undefined pool (its weight, or 1 for a small item). If
	 * the pool can't cover it, the shortfall just adds to your load — that's loot
	 * you picked up in the field (Book I p.87). We remember how much each mark drew
	 * so un-marking returns exactly that (an item defined at Outfit drew nothing, so
	 * un-marking just drops its weight) — toggling can never invent reserve marks.
	 * The pool is also directly editable, so any state is reachable.
	 *
	 * @param {string}  slug
	 * @param {boolean} isChecked  Whether the item is now carried.
	 * @param {object}  opts
	 * @param {boolean} [opts.small]   Small item (□, costs 1) vs regular item (◇, costs its weight).
	 * @param {number}  [opts.weight]  Regular item weight (◇ to move).
	 */
	async toggleCarriedItem(slug, isChecked, { small = false, weight = 1 } = {}) {
		await this._inventory.setItemChecked(slug, isChecked);
		const cost      = small ? 1 : Math.max(0, weight);
		const pool      = small ? this._inventory.smallPool : this._inventory.regularPool;
		const nextDrawn = { ...this._inventory.drawn };
		let next;
		if (isChecked) {
			const spent = Math.min(cost, pool);
			next = pool - spent;
			if (spent > 0) nextDrawn[slug] = spent; else delete nextDrawn[slug];
		} else {
			next = pool + (nextDrawn[slug] ?? 0);
			delete nextDrawn[slug];
		}
		await this._inventory.setDrawn(nextDrawn);
		if (small) await this._inventory.setSmallPool(next);
		else       await this._inventory.setRegularPool(next);
	}

	// Outfit batch-marks the inventory: it writes the checked items and the two
	// "undefined" ◇/□ reserves. Load itself is derived from the marks, so there's
	// nothing else to store. Outfit redefines the whole loadout, so the per-item
	// draw records are cleared — its checked items are defined load, not drawn from
	// the reserve. The pools and item marks stay freely editable afterwards.
	async applyOutfit(checkedMap, regularPool = 0, smallPool = 0) {
		await Promise.all([
			this._inventory.setAllChecked(checkedMap),
			this._inventory.setRegularPool(regularPool),
			this._inventory.setSmallPool(smallPool),
			this._inventory.setDrawn({}),
		]);
	}

	async resetInventorySelections() {
		await this._inventory.resetSelections();
	}

	async addCustomInventoryItem(name, weight) {
		await this._actor.createEmbeddedDocuments("Item", [{
			name,
			type: "move",
			system: { moveType: "inventory-custom", inventoryColumn: "regular", weight: Math.max(1, weight) },
		}]);
	}

	async addCustomSmallItem(name) {
		await this._actor.createEmbeddedDocuments("Item", [{
			name,
			type: "move",
			system: { moveType: "inventory-custom", inventoryColumn: "small" },
		}]);
	}

	async removeCustomInventoryItem(itemId) {
		await this._actor.deleteEmbeddedDocuments("Item", [itemId]);
	}

	buildPossessionsContext(specialPossessions, selectedSlugs, usesMap, maxUsesMap, extraPreselected = [], subChoicesMap = {}, choiceUsesMap = {}) {
		if (!specialPossessions) return null;
		const { pickNote, options } = specialPossessions;
		const bgPreselectedSet = new Set(extraPreselected);
		const preselectedSet = new Set([...((specialPossessions.preselected) ?? []), ...extraPreselected]);

		return {
			pickNote,
			options: options.map(opt => {
				const isPre = preselectedSet.has(opt.slug);
				const isSelected = isPre || selectedSlugs.has(opt.slug);
				const preselectedSource = isPre ? (bgPreselectedSet.has(opt.slug) ? "Background" : "Starting move") : null;
				const maxUses = maxUsesMap[opt.slug] ?? opt.resource?.max ?? null;
				const pickedSubs = subChoicesMap[opt.slug] ?? [];
				return {
					slug: opt.slug,
					label: opt.label,
					description: opt.description ?? "",
					detailsSection: opt.detailsSection ?? null,
					checked: isSelected,
					preselected: isPre,
					preselectedSource,
					disabled: isPre,
					uses: maxUses,
					usesLabel: opt.resource?.title ?? null,
					usesChecks: isSelected && maxUses
						? Array.from({ length: maxUses }, (_, i) => ({ checked: i < (usesMap[opt.slug] ?? 0) }))
						: null,
					choices: isSelected && opt.choices ? {
						pickCount: opt.choices.pickCount,
						options: opt.choices.options.map(c => {
							const picked = pickedSubs.includes(c.slug);
							const cMaxUses = c.resource?.max ?? null;
							return {
								slug: c.slug,
								label: c.label,
								checked: picked,
								disabled: !picked && pickedSubs.length >= opt.choices.pickCount,
								uses: cMaxUses,
								usesChecks: picked && cMaxUses
									? Array.from({ length: cMaxUses }, (_, i) => ({
										checked: i < (choiceUsesMap[`${opt.slug}:${c.slug}`] ?? 0),
									}))
									: null,
							};
						}),
					} : null,
					choiceGroups: isSelected && opt.choiceGroups ? opt.choiceGroups.map((cg, cgIdx) => ({
						heading: cg.heading,
						note: cg.note ?? null,
						subgroups: cg.subgroups.map((sg, sgIdx) => {
							const groupId = `${opt.slug}-cg${cgIdx}-sg${sgIdx}`;
							const slugsCsv = sg.options.map(o => o.slug).join(",");
							return {
								groupId,
								slugsCsv,
								multiSelect: !!sg.multiSelect,
								options: sg.options.map(o => ({
									slug: o.slug,
									label: o.label,
									checked: pickedSubs.includes(o.slug),
								})),
							};
						}),
					})) : null,
				};
			}),
		};
	}

	computePossessionMaxUses(specialPossessions, ownedAllByName, level) {
		const result = { ...this._possessions.maxUses };
		for (const opt of (specialPossessions?.options ?? [])) {
			if (!opt.usesBonus) continue;
			let bonus = 0;
			if (opt.usesBonus.evenLevelBonus) {
				bonus += Math.floor(level / 2) * opt.usesBonus.evenLevelBonus;
			}
			for (const mb of (opt.usesBonus.moveBonus ?? [])) {
				const instances = ownedAllByName.get(mb.moveName)?.length ?? 0;
				bonus += instances * mb.perInstance;
			}
			if (bonus > 0) result[opt.slug] = (opt.resource?.max ?? 0) + bonus;
		}
		return result;
	}

	async selectPossession(slug)   { await this._possessions.select(slug); }
	async deselectPossession(slug) { await this._possessions.deselect(slug); }
	async setCustomPossessions(labels) { await this._possessions.setCustom(labels); }
	async removeCustomPossession(slug) { await this._possessions.removeCustom(slug); }
	async upsertAuthoredPossession(record) { return this._possessions.upsertAuthored(record); }
	async removeAuthoredPossession(slug)   { await this._possessions.removeAuthored(slug); }
	getAuthoredPossession(slug) { return this._possessions.authored.find(c => c.slug === slug) ?? null; }
	async setPossessionUses(slug, count) { await this._possessions.setUses(slug, count); }
	async selectSubChoice(possessionSlug, choiceSlug)   { await this._possessions.addSubChoice(possessionSlug, choiceSlug); }
	async setPossessionSubChoices(possessionSlug, choiceSlugs) { await this._possessions.setSubChoices(possessionSlug, choiceSlugs); }
	async deselectSubChoice(possessionSlug, choiceSlug) { await this._possessions.removeSubChoice(possessionSlug, choiceSlug); }
	async selectSubChoiceExclusive(possessionSlug, choiceSlug, exclusiveSlugs) { await this._possessions.selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs); }
	async setSubChoiceUses(possessionSlug, choiceSlug, count) { await this._possessions.setChoiceUses(possessionSlug, choiceSlug, count); }

	// How many of the selected background's markable actions the character may mark at its
	// current level (Beast-Bonded: 1 at 1st, +1 at 3rd/5th/7th/9th). Lets the sheet enforce
	// the limit directly rather than relying solely on the rendered disabled attribute.
	async allowedMarkedActions() {
		const playbookData = await this.playbook();
		const bg = playbookData?.backgrounds?.find(b => b.slug === this._background.selectedSlug);
		const level = this._actor.system?.attributes?.level?.value ?? 1;
		return allowedMarkableActions(bg?.markableActions, level);
	}

	async getMoves() {
		const playbookName = this._actor.system?.playbook?.name ?? null;
		const actorLevel = this._actor.system?.attributes?.level?.value ?? 1;
		const ownedAllByName = this._buildOwnedMovesMap();

		const playbookData = await this.playbook();
		const background = playbookData?.backgrounds?.find(b => b.slug === this._background.selectedSlug);
		const bgMoveNames = new Set(background?.moves ?? []);

		let playbookMoves = [];
		if (playbookName) {
			const entries = await this._moveRepo.getPlaybookMoves(playbookName);
			playbookMoves = this.sortPlaybookMoves(this.buildMovelistContext(entries, ownedAllByName, bgMoveNames, actorLevel, playbookName));

			const moveResourcesMap = this._moveResources.getMoveResources();
			for (const move of playbookMoves) {
				if (!move.resource) continue;
				move.resourceChecks = Array.from({ length: move.resource.max }, (_, i) => ({
					checked: i < (moveResourcesMap[move.name] ?? 0),
					label: move.resource.labels?.[i] ?? null,
				}));
			}
			playbookMoves = _sortOwnedFirst(playbookMoves);
		}

		const basicEntries = await this._moveRepo.getBasicMoves();
		const basicMoves = basicEntries.map(e => {
			const instances = ownedAllByName.get(e.name) ?? [];
			return {
				name: e.name,
				compendiumId: e.id,
				ownedId: instances[0]?._id ?? null,
				rollType: e.rollType,
				rollLabel: _rollLabelForMove(e.name, e.rollType, { moveType: "basic", description: e.description }),
				owned: instances.length > 0,
				description: e.description,
			};
		}).sort((a, b) => {
			if (a.name === "Aid") return -1;
			if (b.name === "Aid") return 1;
			return a.name.localeCompare(b.name);
		});
		const orderedBasicMoves = _sortOwnedFirst(basicMoves);

		const otherGroups = OTHER_MOVE_TYPES.reduce((acc, t) => {
			const items = this._actor.items.filter(i => i.type === "move" && i.system?.moveType === t);
			if (items.length) acc.push({
				key: t,
				label: capitalizeFirst(t) + " Moves",
				moves: items.map(i => ({
					name: i.name,
					ownedId: i._id,
					rollType: normalizeRollType(i.system?.rollType),
					rollLabel: _rollLabelForMove(i.name, i.system?.rollType, i.system),
				})),
			});
			return acc;
		}, []);

		const playbookMoveNameSet = new Set(playbookMoves.map(m => m.name));
		const otherMoves = this._actor.items
			.filter(i => {
				if (i.type !== "move") return false;
				if (i.system?.moveType === "other") return true;
				if (i.system?.moveType === "playbook" && !playbookMoveNameSet.has(i.name)) return true;
				return false;
			})
			.map(i => ({
				name: i.name,
				ownedId: i._id,
				rollType: normalizeRollType(i.system?.rollType),
				rollLabel: _rollLabelForMove(i.name, i.system?.rollType, i.system),
				description: i.system?.description ?? null,
			}));

		return { playbookMoves, basicMoves: orderedBasicMoves, otherGroups, otherMoves, startingMovesNote: playbookData?.startingMovesNote ?? null };
	}

	buildMovelistContext(entries, ownedAllByName, bgMoveNames, actorLevel, actorPlaybook) {
		return entries.map(e =>
			new PlaybookMoveEntry(e, ownedAllByName.get(e.name) ?? [], bgMoveNames, ownedAllByName, actorLevel, actorPlaybook)
		);
	}

	sortPlaybookMoves(moves) {
		const groups = new Map();
		for (const move of moves) {
			const key = move.minLevel ?? 0;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(move);
		}
		const result = [];
		for (const level of [...groups.keys()].sort((a, b) => a - b)) {
			result.push(..._sortGroup(groups.get(level), new Set(groups.get(level).map(m => m.name))));
		}
		return result;
	}

	async ensureStartingMoves() {
		const playbookName = this._actor.system?.playbook?.name;
		if (!playbookName) return;

		const entries = await this._moveRepo.getPlaybookMoves(playbookName);
		const ownedNames = new Set(this._actor.items.filter(i => i.type === "move").map(i => i.name));

		const playbookData = await this.playbook();
		const background = playbookData?.backgrounds?.find(b => b.slug === this._background.selectedSlug);
		const bgMoveNames = new Set(background?.moves ?? []);

		// "Either X OR Y" starting moves (e.g. the Heavy's Armored OR Uncanny
		// Reflexes) are a player choice, so they're never auto-granted — the chosen
		// one is added by the onboarding flow (or picked by hand on the sheet).
		const choiceMoveNames = new Set(
			(playbookData?.startingMoveChoices ?? playbookData?.moves?.choices ?? [])
				.flatMap(group => group.options ?? [])
		);

		const missing = entries.filter(e =>
			((e.isStarting && !choiceMoveNames.has(e.name)) || bgMoveNames.has(e.name)) && !ownedNames.has(e.name)
		);
		if (missing.length) {
			const docs = await Promise.all(missing.map(e => this._moveRepo.getPlaybookMoveDocument(e.id)));
			await this._actor.createEmbeddedDocuments("Item", docs.filter(Boolean).map(d => d.toObject()));
		}

		const [basicEntries, expeditionEntries] = await Promise.all([
			this._moveRepo.getBasicMoves(),
			this._moveRepo.getExpeditionMoves(),
		]);
		const missingUniversal = [
			...basicEntries.filter(e => !ownedNames.has(e.name)),
			...expeditionEntries.filter(e => !ownedNames.has(e.name)),
		];
		if (missingUniversal.length) {
			const docs = await Promise.all(missingUniversal.map(e => this._moveRepo.getBasicMoveDocument(e.id)));
			await this._actor.createEmbeddedDocuments("Item", docs.filter(Boolean).map(d => d.toObject()));
		}
	}

	async addMove(compendiumId, { skipIfOwned = false } = {}) {
		const doc = await this._moveRepo.getPlaybookMoveDocument(compendiumId);
		if (!doc) return;
		if (skipIfOwned && this._actor.items.some(i => i.type === "move" && i.name === doc.name)) return;
		await this._actor.createEmbeddedDocuments("Item", [doc.toObject()]);
	}

	async addPlaybookMoveByName(playbookName, moveName) {
		if (!playbookName || !moveName) return;
		const ownedNames = new Set(this._actor.items.filter(i => i.type === "move").map(i => i.name));
		if (ownedNames.has(moveName)) return;
		const entries = await this._moveRepo.getPlaybookMoves(playbookName);
		const entry = entries.find(e => e.name === moveName);
		if (entry) await this.addMove(entry.id);
	}

	async removeMove(ownedId) {
		if (ownedId) await this._actor.deleteEmbeddedDocuments("Item", [ownedId]);
	}

	// Apply the "either X OR Y" starting-move picks: grant the chosen move in each group
	// and remove any other option from the same group the actor still owns, so switching
	// the choice (on a re-run of onboarding) doesn't leave the character owning both.
	// `choiceGroups` is the playbook's `moves.choices`; `chosenIdByGroup` maps group index
	// → chosen compendium id.
	async applyStartingMoveChoices(choiceGroups, chosenIdByGroup) {
		for (let i = 0; i < (choiceGroups?.length ?? 0); i++) {
			const chosenId = chosenIdByGroup?.[i];
			if (!chosenId) continue;
			const chosenDoc = await this._moveRepo.getPlaybookMoveDocument(chosenId);
			if (!chosenDoc) continue;
			const optionNames = new Set(choiceGroups[i].options ?? []);
			const stale = this._actor.items.filter(it =>
				it.type === "move" && optionNames.has(it.name) && it.name !== chosenDoc.name
			);
			for (const it of stale) await this.removeMove(it._id);
			await this.addMove(chosenId, { skipIfOwned: true });
		}
	}

	async _onCreateDescendantDocuments(documents) {
		const stonetopItem = documents.find(d => d.type === "playbook");
		if (!stonetopItem) return;
		const stonetopPlaybook = stonetopItem.asPlaybook();

		const hp = stonetopPlaybook.hp;
		const damage = stonetopPlaybook.damage;
		if (hp && damage) {
			await this._actor.update({
				"system.attributes.hp.max": hp,
				"system.attributes.hp.value": hp,
				"system.attributes.damage.value": damage,
			});
		}
		await this.ensureStartingMoves();
	}

	async onRoll(event, { statOverride = null, situational = 0 } = {}) {
		const itemId = event.currentTarget.closest(".item")?.dataset.itemId;
		if (!itemId) return false;
		const item = this._actor.items.get(itemId);
		const stat = statOverride ?? normalizeRollType(item?.system?.rollType);
		if (!stat) return false;

		const isDescription = event.currentTarget.getAttribute("data-show") === "description";
		const descriptionOnly = isDescription || (item.type === "npcMove" && !item.system.rollFormula);

		const rollMode = this.rollMode;
		const forward  = descriptionOnly ? 0 : this._actor.system?.attributes?.forward?.value ?? 0;
		const ongoing  = descriptionOnly ? 0 : this._actor.system?.attributes?.ongoing?.value ?? 0;
		// A one-off situational modifier from the optional pre-roll prompt; the roll
		// engine surfaces it as a "Situational" pill (modifier − forward − ongoing).
		const situ     = descriptionOnly ? 0 : situational;

		const modifier    = forward + ongoing + situ;
		const rollOptions = { rollMode, modifier, forward, ongoing, statOverride: stat };

		await item.roll({ ...this.applyDebilityRollMode(stat, rollOptions), descriptionOnly });

		if (forward !== 0) {
			await this._actor.update({ "system.attributes.forward.value": 0 }, { stonetopMove: item?.name });
		}
		return true;
	}

	async onDirectStatRoll(stat, extraOptions = {}) {
		const { rollStat } = await import("../../utils/roll-engine.js");
		const { situational = 0, ...rest } = extraOptions;
		const rollMode = this.rollMode;
		const forward  = this._actor.system?.attributes?.forward?.value ?? 0;
		const ongoing  = this._actor.system?.attributes?.ongoing?.value ?? 0;
		// `situational` is the one-off modifier from the optional pre-roll prompt; the
		// roll engine renders it as a "Situational" pill (modifier − forward − ongoing).
		const modifier = forward + ongoing + situational;

		await rollStat(stat, this._actor, this.applyDebilityRollMode(stat, {
			rollMode,
			modifier,
			forward,
			ongoing,
			...rest,
		}));

		if (forward !== 0) {
			await this._actor.update({ "system.attributes.forward.value": 0 }, extraOptions.moveName ? { stonetopMove: extraOptions.moveName } : {});
		}
	}

	/**
	 * Order Followers (Book I, NPCs & Followers p.462). A follower doesn't roll
	 * +STAT — it rolls 2d6 plus the bonus the player resolved from its tags (+0/+1/
	 * +2, see orderFollowersBonus), optionally with disadvantage when a tag gets in
	 * the way. We route through rollStat with an explicit statValue so we reuse its
	 * card, its disadvantage handling, and — crucially — its automatic +1 XP on a
	 * 6-, which marks on this PC and is attributed to the move (the player marks XP
	 * when their follower misses). The PC's own forward/ongoing/debility/global roll
	 * mode deliberately do NOT apply: the follower is acting, not the PC.
	 *
	 * @param {object} opts
	 * @param {number} [opts.bonus]     - 0, 1, or 2
	 * @param {string} [opts.rollMode]  - "normal" | "adv" | "dis"
	 * @param {string} [opts.moveName]  - Card header, e.g. "Hari: Defy Danger"
	 */
	async onOrderFollowersRoll({ bonus = 0, rollMode = "normal", moveName } = {}) {
		const { rollStat } = await import("../../utils/roll-engine.js");
		await rollStat("follower", this._actor, {
			statValue: Math.trunc(Number(bonus) || 0),
			rollMode:  ["adv", "dis"].includes(rollMode) ? rollMode : "normal",
			moveName:  moveName || "Order Followers",
			modifier:  0,
		});
	}

	async onDropMove(itemData) {
		const alreadyOwned = !!this._actor.items.find(i => i.type === "move" && i.name === itemData.name);
		if (alreadyOwned) return false;

		const actorPlaybook = this._actor.system?.playbook?.name ?? null;
		const itemPlaybook = itemData.system?.playbook ?? null;
		if (itemData.system?.moveType === "playbook" && itemPlaybook && itemPlaybook !== actorPlaybook) {
			itemData = { ...itemData, system: { ...itemData.system, moveType: "other" } };
		}

		await this._actor.createEmbeddedDocuments("Item", [itemData]);
		return true;
	}

	applyDebilityRollMode(stat, options) {
		const debilityOptions = this._actor.system.attributes?.debilities?.options ?? {};
		const activeEntry = Object.entries(debilityOptions).find(
			([key, opt]) => {
				if (!opt.value) return false;
				const affectedStats = Array.isArray(opt.stat) ? opt.stat : _DEBILITY_DEF_BY_KEY[key]?.stats;
				return affectedStats?.includes(stat);
			}
		);
		if (!activeEntry) return options;
		const [key] = activeEntry;
		const def = _DEBILITY_DEF_BY_KEY[key];
		const base = { ...options, stonetopDebility: def?.name ?? key, stonetopDebilityTooltip: def?.description ?? "" };
		if (options.rollMode === "adv") return { ...base, rollMode: "normal" };
		return { ...base, rollMode: "dis" };
	}

	get rollMode() {
		return _normalizeSheetRollMode(resolvedFlags(this._actor).rollMode);
	}

	async setRollMode(rollMode) {
		await this._actor.setFlag(STONETOP_SCOPE, "rollMode", _normalizeSheetRollMode(rollMode));
	}
	async addArcanum(slug)                           { await this._arcana.addArcanum(slug); }
	async removeArcanum(slug)                        { await this._arcana.removeArcanum(slug); }

	/**
	 * Create a blank player-authored arcanum: a world `move`/arcanum item carrying the same
	 * `flags.<scope>.{slug,front,back}` payload the shipped pack arcana use, so the character sheet
	 * and FoundryArcanaRepository consume it with no changes. It opens straight into the authoring
	 * sheet (stamped sheetClass) and is added to this character's owned arcana. Returns the item so
	 * the caller can render its editor. The `custom-arcanum-` slug prefix is what the snapshot keys
	 * `isCustom` on (see ArcanaSnapshot) and what the repository's world-item lookup resolves.
	 */
	async createCustomArcanum() {
		const slug  = `custom-arcanum-${foundry.utils.randomID()}`;
		const item  = await getDocumentClass("Item").create({
			name: _loc("stonetop.arcana.newCustomName"),
			type: "move",
			img:  "icons/svg/book.svg",
			system: { moveType: "arcanum" },
			flags: {
				[ITEM_FLAG_SCOPE]: {
					slug,
					front: { title: "", description: "", item: null, unlock: { description: "", requirements: [] } },
					back:  { title: "", description: "", item: null, resource: null, move: null, options: [] },
				},
				core: { sheetClass: "stonetop.StonetopArcanumEditorSheet" },
			},
		});
		await this.addArcanum(slug);
		return item;
	}

	/** The world `move`/arcanum item backing a custom arcanum slug, or null (used to open its editor). */
	getCustomArcanumItem(slug) {
		return game.items?.find(i =>
			i?.type === "move" &&
			i?.system?.moveType === "arcanum" &&
			i?.flags?.[ITEM_FLAG_SCOPE]?.slug === slug) ?? null;
	}
	async identifyArcanum(slug)                      { await this._arcana.identifyArcanum(slug); }
	async getArcanumChatContent(slug, flipped)       { return this._arcana.getArcanumChatContent(slug, flipped); }
	async flipArcanum(slug)     { await this._arcana.flipArcanum(slug); }
	async setMinorArcanumRole(role, slug) { await this._arcana.setMinorRole(role, slug); }
	async unflipArcanum(slug)   { await this._arcana.unflipArcanum(slug); }
	async setArcanumUnlockCount(arcanumSlug, optionSlug, count)          { await this._arcana.setUnlockCount(arcanumSlug, optionSlug, count); }
	async setArcanumBackOptionCount(arcanumSlug, optionSlug, count)      { await this._arcana.setBackOptionCount(arcanumSlug, optionSlug, count); }
	async setArcanumBoxChecked(slug, context, index, checked)            { await this._arcana.setArcanumBoxChecked(slug, context, index, checked); }
	async setArcanumResource(slug, count)                                { await this._inventory.setResource(slug, count); }
	async setLoreOptionCount(loreSlug, optionSlug, count)           { await this._lore.setCount(loreSlug, optionSlug, count); }
	async setLoreOptionText(loreSlug, optionSlug, value)            { await this._lore.setText(loreSlug, optionSlug, value); }

	async getLevelUpData() {
		const actor      = this._actor;
		const level      = actor.system?.attributes?.level?.value ?? 1;
		const xp         = actor.system?.attributes?.xp?.value ?? 0;
		const cost       = 6 + level * 2;
		const newLevel   = level + 1;
		const playbookData   = await this.playbook();
		const ownedAllByName = this._buildOwnedMovesMap();

		let availableMoves = [];
		let lockedMoves    = [];
		if (playbookData?.name) {
			const background  = playbookData.backgrounds?.find(b => b.slug === this._background.selectedSlug);
			const bgMoveNames = new Set(background?.moves ?? []);
			const entries     = await this._moveRepo.getPlaybookMoves(playbookData.name);
			const all = this.sortPlaybookMoves(
				this.buildMovelistContext(entries, ownedAllByName, bgMoveNames, newLevel, playbookData.name)
			).filter(e => !e.owned);
			availableMoves = all.filter(e => !e.locked);
			lockedMoves    = all.filter(e => e.locked);
		}

		let needsInvocation     = false;
		let availableInvocations = [];
		if (newLevel % 2 === 0 && playbookData?.invocations?.options?.length) {
			const selected = new Set(actor.getFlag("stonetop", "invocations.selected") ?? []);
			availableInvocations = playbookData.invocations.options.filter(o => !selected.has(o.slug));
			needsInvocation = availableInvocations.length > 0;
		}

		return {
			level, xp, cost, newLevel,
			xpRemaining: xp - cost,
			availableMoves,
			lockedMoves,
			needsInvocation,
			availableInvocations,
		};
	}

	async applyLevelUp(selectedMoveCompendiumId, selectedInvocationSlug) {
		const level = this._actor.system?.attributes?.level?.value ?? 1;
		const xp    = this._actor.system?.attributes?.xp?.value ?? 0;
		const cost  = 6 + level * 2;
		await this._actor.update({
			"system.attributes.level.value": level + 1,
			"system.attributes.xp.value":   Math.max(0, xp - cost),
		});
		if (selectedMoveCompendiumId) {
			await this.addMove(selectedMoveCompendiumId);
		}
		if (selectedInvocationSlug) {
			const current = this._actor.getFlag("stonetop", "invocations.selected") ?? [];
			await this._actor.setFlag("stonetop", "invocations.selected", [...current, selectedInvocationSlug]);
		}
	}

	_buildOwnedMovesMap() {
		const map = new Map();
		for (const item of this._actor.items.filter(i => i.type === "move")) {
			if (!map.has(item.name)) map.set(item.name, []);
			map.get(item.name).push(item);
		}
		return map;
	}
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

const _STAT_DEFS = {
	str: { name: "Strength",     abbr: "STR" },
	dex: { name: "Dexterity",    abbr: "DEX" },
	con: { name: "Constitution", abbr: "CON" },
	int: { name: "Intelligence", abbr: "INT" },
	wis: { name: "Wisdom",       abbr: "WIS" },
	cha: { name: "Charisma",     abbr: "CHA" },
};

const _DEBILITY_DEFS = [
	{ key: "weakened",  name: "Weakened",  stats: ["str", "dex"], description: "Fatigued, tired, sluggish, shaky. Disadvantage on +STR or +DEX rolls." },
	{ key: "dazed",     name: "Dazed",     stats: ["int", "wis"], description: "Out of it, befuddled, not thinking clearly. Disadvantage on +INT or +WIS rolls." },
	{ key: "miserable", name: "Miserable", stats: ["con", "cha"], description: "Greatly distressed, angry, unwell, in pain. Disadvantage on +CON or +CHA rolls." },
];
const _DEBILITY_DEF_BY_KEY = Object.fromEntries(_DEBILITY_DEFS.map(d => [d.key, d]));

function _buildStatsSection(actor) {
	const rawStats = actor.system?.stats ?? {};
	return Object.fromEntries(
		Object.entries(_STAT_DEFS).map(([key, { name, abbr }]) => [
			key,
			new StatSnapshot(rawStats[key]?.value ?? 0, name, abbr),
		])
	);
}

function _buildDebilitiesSection(actor) {
	const opts = actor.system?.attributes?.debilities?.options ?? {};
	return _DEBILITY_DEFS.map(({ key, name, stats }) =>
		new DebilitySnapshotBuilder()
			.withKey(key)
			.withName(name)
			.withActive(!!(opts[key]?.value))
			.withStats(stats)
			.build()
	);
}


function _buildVitalsSection(actor, playbookData, armorValue, moveBonuses = {}) {
	const attrs = actor.system?.attributes ?? {};
	const level = attrs.level?.value ?? 1;
	const hpBonus = moveBonuses.hp ?? 0;
	const computedDamage = playbookData
		? (moveBonuses.damageDie ? maxDie(playbookData.damage, moveBonuses.damageDie) : playbookData.damage)
		: null;
	const computedMax = playbookData ? (playbookData.hp ?? 0) + hpBonus : 0;
	// Manual overrides: the Classic sheet lets you edit max-HP / armor / damage directly (parity with
	// Taylor's editable vitals). A non-null override wins over the computed default; null/absent =>
	// compute as normal. Stored at flags.<scope>.overrides so both sheet styles stay consistent.
	const ov = actor.getFlag?.(STONETOP_SCOPE, "overrides") ?? {};
	const hasMaxOv = ov.maxHp != null;
	const maxHp  = hasMaxOv ? Math.max(0, Number(ov.maxHp) || 0) : computedMax;
	const armor  = ov.armor != null ? Math.max(0, Number(ov.armor) || 0) : armorValue;
	const damage = (ov.damage != null && ov.damage !== "") ? String(ov.damage) : computedDamage;
	return new VitalsSnapshotBuilder()
		.withHp((playbookData || hasMaxOv) ? new ValueMax(attrs.hp?.value ?? 0, maxHp) : new ValueMax(0, 0))
		.withDamage(damage)
		.withArmor(armor)
		.withLevel(level)
		.withXp(new ValueMax(attrs.xp?.value ?? 0, 6 + level * 2))
		.build();
}

// Final per-Crew-member stats: the playbook's data-driven base plus the bonuses
// from marked Marshal moves (Heroes to the Last / Veteran Crew).
function _buildCrewStats(crew, moveBonuses) {
	return {
		memberHp:  (crew?.hp ?? 6) + (moveBonuses.crewHp ?? 0),
		armor:     crew?.armor ?? 0,
		damageDie: stepDie(crew?.damageDie ?? "d6", moveBonuses.crewDamageSteps ?? 0, moveBonuses.crewDamageCap),
		rollMod:   (crew?.roll ?? 1) + (moveBonuses.crewRollSteps ?? 0),
	};
}

function _originDescriptionForRegion(region) {
	const key = _normalizeOriginRegion(region);
	if (!key) return "";
	if (key.includes("barrier pass")) return ORIGIN_DESCRIPTIONS.barrierPass;
	if (key.includes("gordin")) return ORIGIN_DESCRIPTIONS.gordinsDelve;
	if (key.includes("lygos") || key.includes("southern") || key.includes("south")) return ORIGIN_DESCRIPTIONS.lygos;
	if (key.includes("manmarch")) return ORIGIN_DESCRIPTIONS.manmarch;
	if (key.includes("marshedge")) return ORIGIN_DESCRIPTIONS.marshedge;
	if (key.includes("steplands") || key.includes("hillfolk")) return ORIGIN_DESCRIPTIONS.steplands;
	if (key.includes("stonetop")) return ORIGIN_DESCRIPTIONS.stonetop;
	if (key.includes("wild")) return ORIGIN_DESCRIPTIONS.wild;
	return "";
}

function _normalizeOriginRegion(region) {
	return String(region ?? "")
		.toLowerCase()
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

// How many of a background's level-gated markable actions are unlocked at a given
// level: one per milestone level reached (Beast-Bonded marks at 1/3/5/7/9).
// Exported so onboarding (always 1st level) shares this rule instead of re-deriving it.
export function allowedMarkableActions(markable, actorLevel) {
	const levels = markable?.levels ?? [];
	return levels.filter(l => actorLevel >= l).length;
}

function _buildMarkableActions(b, savedMarkedActions, actorLevel) {
	const markable = b.markableActions;
	if (!markable?.options?.length) return null;
	const marked  = new Set(savedMarkedActions);
	const allowed = allowedMarkableActions(markable, actorLevel);
	const markedCount = markable.options.filter(o => marked.has(o.slug)).length;
	const atLimit = markedCount >= allowed;
	return {
		label:       markable.label ?? "",
		allowed,
		markedCount,
		options: markable.options.map(o => {
			const checked = marked.has(o.slug);
			return { slug: o.slug, label: o.label, checked, disabled: !checked && atLimit };
		}),
	};
}

function _buildPlaybookSection(playbookData, background, instinct, appearance, origin, lore, actorName, arcanaDisplay = null, becameHero = false, actorLevel = 1) {
	const savedBg      = background.selectedSlug || null;
	const savedChoices = background.choices;
	const savedSetupTexts = background.setupTexts ?? {};
	const savedSetupResources = background.setupResources ?? {};
	const savedMarkedActions = background.markedActions ?? [];
	const savedInstinct = instinct.selectedValue || null;
	const savedAppearance = appearance.saved;
	const savedOrigin  = origin.selected || null;

	const bgOptions = (playbookData.backgrounds ?? []).map(b => {
		const choices = b.choices ? new BackgroundChoicesSnapshotBuilder()
			.withLabel(b.choices.label)
			.withCount(b.choices.count)
			.withCountLabel(b.choices.count.join(" or "))
			.withOptions(b.choices.options.map(o =>
				new BackgroundChoiceOptionSnapshot(o.slug, o.label, !!(savedChoices?.[o.slug]))
			))
			.withSaved(savedChoices)
			.build() : null;
		return new BackgroundOptionSnapshotBuilder()
			.withSlug(b.slug)
			.withLabel(b.label)
			.withDescription(b.description ?? "")
			.withSelected(b.slug === savedBg)
			.withMoves((b.moves ?? []).map(slugify))
			.withChoices(choices)
			.withSetupTexts((b.setup?.texts ?? []).map(t => ({
				key: t.key,
				label: t.label ?? t.key,
				value: savedSetupTexts[t.key] ?? "",
			})))
			.withSetupResources((b.setup?.resources ?? []).map(r => {
				const max = r.max ?? 1;
				const current = savedSetupResources[r.key] ?? r.value ?? 0;
				return {
					key: r.key,
					label: r.label ?? r.key,
					current,
					max,
					checks: Array.from({ length: max }, (_, i) => ({
						index: i,
						checked: i < current,
					})),
				};
			}))
			.withMarkableActions(_buildMarkableActions(b, savedMarkedActions, actorLevel))
			.build();
	});

	const instinctOptions = (playbookData.instincts ?? []).map(({ word, description }) => {
		const value = composeInstinct(word, description);
		return new InstinctOptionSnapshotBuilder()
			.withWord(word)
			.withDescription(description)
			.withValue(value)
			.withSelected(savedInstinct === value)
			.build();
	});

	const appearanceOptions = (playbookData.appearance ?? []).map((opts, i) =>
		new AppearanceLineSnapshot(i, opts.map(v =>
			new AppearanceOptionSnapshot(v, (savedAppearance?.[i]) === v)
		))
	);

	const originOptions = (playbookData.origin ?? []).map(({ region, names }) =>
		new OriginOptionSnapshot(
			region,
			names.map(name => ({ name, checked: name === actorName })),
			region === savedOrigin,
			_originDescriptionForRegion(region)
		)
	);

	return new PlaybookSnapshotBuilder()
		.withSlug(playbookData.slug)
		.withName(heroDisplayName(playbookData.name, becameHero))
		.withImg(playbookData.img ?? null)
		.withDescription(playbookData.description ?? null)
		.withStatsNote(playbookData.statsNote ?? null)
		.withLore(buildLoreSection(playbookData.lore ?? [], lore, arcanaDisplay))
		.withBackground(new BackgroundSection(savedBg, bgOptions))
		.withInstinct(new InstinctSection(savedInstinct, instinctOptions))
		.withAppearance(new AppearanceSection(appearanceOptions))
		.withOrigin(new OriginSection(savedOrigin, originOptions))
		.build();
}

// Normalize a stored mark value into an array of { stat, level } entries.
// Handles legacy shapes: a plain count (number) or an array of stat strings.
function _markEntries(stored) {
	if (Array.isArray(stored)) {
		return stored.map(e => (e && typeof e === "object")
			? { stat: e.stat ?? "", level: e.level ?? null }
			: { stat: typeof e === "string" ? e : "", level: null });
	}
	if (typeof stored === "number") return Array.from({ length: stored }, () => ({ stat: "", level: null }));
	return [];
}

// Build a move's mark options for display: stat-choice options (Potential for
// Greatness) get a stat dropdown per slot; the rest get checkbox arrays. Each
// filled slot / checked mark carries the level it was marked on.
function _buildMarkOptions(entry, markCounts) {
	if (!entry.markOptions?.length) return null;
	const statList = Object.entries(_STAT_DEFS).map(([key, { abbr }]) => ({ key, abbr }));
	return entry.markOptions.map(opt => {
		const entries = _markEntries(markCounts[opt.slug]);
		const marks = opt.marks ?? 1;
		if (opt.choice === "stat") {
			const statSlots = Array.from({ length: marks }, (_, i) => {
				const sel = entries[i]?.stat ?? "";
				return {
					index: i,
					level: entries[i]?.level ?? null,
					options: [{ key: "", abbr: "—", selected: sel === "" },
						...statList.map(s => ({ key: s.key, abbr: s.abbr, selected: sel === s.key }))],
				};
			});
			return { slug: opt.slug, label: opt.label, choice: "stat", statSlots };
		}
		const count = entries.length;
		return {
			slug:   opt.slug,
			label:  opt.label,
			checks: Array.from({ length: marks }, (_, i) => ({
				index: i,
				checked: i < count,
				level: entries[i]?.level ?? null,
			})),
		};
	});
}

function _buildMoveEntry(entry, source, moveResourcesMap, bgSlugs = new Set(), moveBackgroundAnswers = {}, improvedStatChoices = {}, moveMarksMap = {}) {
	const resourceDef = entry.resource;
	const resource = resourceDef ? new ResourceBuilder()
		.withCurrent(moveResourcesMap[entry.name] ?? 0)
		.withMax(resourceDef.max)
		.withTitle(resourceDef.title ?? null)
		.withLabels(resourceDef.labels ?? [])
		.build() : null;
	const repeat = entry.repeatable
		? { max: entry.repeatChecks.length, current: entry.ownedIds.length }
		: null;
	const requirement = entry.requiresLabel
		? new RequirementSnapshot(entry.requiresLabel, !entry.locked)
		: null;
	const sourceLabel = entry.isStarting ? (bgSlugs.has(slugify(entry.name)) ? "Background" : "Starting move") : null;

	const markOptions = _buildMarkOptions(entry, moveMarksMap[entry.name] ?? {});

	const statChoices = (entry.name === "Improved Stat" && entry.ownedIds.length > 0)
		? entry.ownedIds
			.map(ownedId => {
				const statKey = improvedStatChoices[ownedId] ?? null;
				if (!statKey) return null;
				return { ownedId, statKey, statAbbr: _STAT_DEFS[statKey]?.abbr ?? statKey.toUpperCase() };
			})
			.filter(Boolean)
		: null;

	return new MoveSnapshotBuilder()
		.withId(entry.compendiumId)
		.withCompendiumId(entry.compendiumId)
		.withOwnedId(entry.ownedIds[0] ?? null)
		.withName(entry.name)
		.withDescription(entry.description)
		.withRollType(entry.rollType)
		.withRollLabel(_rollLabelForMove(entry.name, entry.rollType, entry))
		.withIsStarting(entry.isStarting)
		.withSource(source)
		.withSourceLabel(sourceLabel)
		.withOwned(entry.owned)
		.withOwnedIds(entry.ownedIds)
		.withLocked(entry.locked)
		.withRequirement(requirement)
		.withRequiresLabel(requirement?.label ?? null)
		.withResource(resource)
		.withRepeat(repeat)
		.withRepeatable(repeat !== null)
		.withBackgroundAnswer(moveBackgroundAnswers[entry.name] ?? null)
		.withStatChoices(statChoices)
		.withMarkOptions(markOptions)
		.withAsterisk(!!entry.asterisk)
		.build();
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

/**
 * Builds a move category snapshot for a universal, compendium-sourced move list
 * (e.g. Basic Moves, Expedition Moves) — every entry is shown to every actor,
 * with ownership/roll info layered on from `ownedAllByName`.
 */
function _buildCompendiumMoveCategory(entries, { key, title }, ownedAllByName) {
	if (entries.length === 0) return null;
	return new MoveCategorySnapshotBuilder()
		.withKey(key)
		.withTitle(title)
		.withNote(null)
		.withMoves(_sortOwnedFirst(entries.map(e => {
			const instances = ownedAllByName.get(e.name) ?? [];
			return new MoveSnapshotBuilder()
				.withId(e.id)
				.withCompendiumId(e.id)
				.withOwnedId(instances[0]?._id ?? null)
				.withName(e.name)
				.withDescription(e.description ?? "")
				.withRollType(e.rollType)
				.withRollLabel(_rollLabelForMove(e.name, e.rollType, { moveType: key, description: e.description }))
				.withIsStarting(false)
				.withSource({ type: key })
				.withSourceLabel(null)
				.withOwned(instances.length > 0)
				.withOwnedIds(instances.map(i => i._id))
				.withLocked(false)
				.withRequirement(null)
				.withRequiresLabel(null)
				.withResource(null)
				.withRepeat(null)
				.withRepeatable(false)
				.build();
		})))
		.build();
}

function _rollLabelForMove(name, rollType, data = {}) {
	const normalizedRollType = normalizeRollType(rollType);
	if (!normalizedRollType) return null;
	if (data.moveType === "homefront" && HOMEFRONT_ROLL_LABELS_BY_NAME[name]) {
		return HOMEFRONT_ROLL_LABELS_BY_NAME[name];
	}
	if (data.moveType === "homefront") {
		const match = String(data.description ?? "").match(/roll\s+\+([A-Za-z][A-Za-z ]*)/i);
		if (match) return match[1].trim();
	}
	if ((data.moveType === "basic" || data.moveType === "expedition") && normalizedRollType === "ask") return "ANY";
	return ROLL_LABELS_BY_TYPE[normalizedRollType] ?? null;
}

function _buildMovelist(categories, other, pdiLabel = null) {
	const playbookCat   = categories.find(c => c.key === "playbook");
	const basicCat      = categories.find(c => c.key === "basic");
	const expeditionCat = categories.find(c => c.key === "expedition");
	const postDeathCat  = categories.find(c => c.key === "post-death");
	const otherCats     = categories.filter(c => !["basic", "playbook", "expedition", "post-death"].includes(c.key));
	const postDeathGroup = postDeathCat && pdiLabel
		? { label: pdiLabel, moves: postDeathCat.moves }
		: null;
	const startingNote = playbookCat?.note ?? null;
	const pickCount    = parseMovePickCount(startingNote);
	const chosenCount    = (playbookCat?.moves ?? []).filter(m => m.sourceLabel === null && m.owned).length;
	const movesIncomplete = pickCount > 0 && chosenCount < pickCount;

	return new MovelistBuilder()
		.withPlaybookMoves(playbookCat?.moves ?? [])
		.withBasicMoves(basicCat?.moves ?? [])
		.withExpeditionMoves(expeditionCat?.moves ?? [])
		.withOtherGroups(otherCats.map(cat => new MoveGroupSnapshot(cat.key, cat.title, cat.moves)))
		.withOtherMoves(other)
		.withStartingMovesNote(startingNote)
		.withPostDeathGroup(postDeathGroup)
		.withMovesIncomplete(movesIncomplete)
		.build();
}


export function parseMovePickCount(note) {
	const m = (note ?? "").match(/\b(\d+)\s+(?:more\s+|other\s+)?(?:move[s]?\s+)?of\s+your\s+choice/i);
	return m ? parseInt(m[1], 10) : 0;
}

function _segmentByTwoCol(items) {
	const segments = [];
	let current = null;
	let currentType = null;
	for (const item of items) {
		const type = item.twoCol ? "grid" : "list";
		if (!current || currentType !== type) {
			current = new InventorySegmentSnapshot(type === "grid", item.breakBefore ?? false, []);
			segments.push(current);
			currentType = type;
		}
		current.items.push(item);
	}
	return segments;
}

function _sortGroup(moves, groupNames) {
	const dependents = new Map();
	const roots = [];
	for (const move of moves) {
		if (!move.requires || !groupNames.has(move.requires)) {
			roots.push(move);
		} else {
			if (!dependents.has(move.requires)) dependents.set(move.requires, []);
			dependents.get(move.requires).push(move);
		}
	}
	roots.sort((a, b) => a.name.localeCompare(b.name));
	for (const deps of dependents.values()) deps.sort((a, b) => a.name.localeCompare(b.name));
	const result = [];
	const visited = new Set();

	function visit(move) {
		if (visited.has(move.name)) return;
		visited.add(move.name);
		result.push(move);
		for (const child of dependents.get(move.name) ?? []) visit(child);
	}

	for (const root of roots) visit(root);
	moves.filter(m => !visited.has(m.name)).sort((a, b) => a.name.localeCompare(b.name)).forEach(m => result.push(m));
	return result;
}

function _sortOwnedFirst(moves) {
	const tier = m => m.owned ? 0 : m.locked ? 2 : 1;
	return [...moves].sort((a, b) => {
		const tierDiff = tier(a) - tier(b);
		if (tierDiff !== 0) return tierDiff;
		return a.name.localeCompare(b.name);
	});
}
