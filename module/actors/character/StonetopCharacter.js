import {
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
	LoadOptionSnapshot,
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
import {StonetopFlags} from "./StonetopFlags.js";
import {CharacterBackgrounds} from "./CharacterBackgrounds.js";
import {CharacterInstincts} from "./CharacterInstincts.js";
import {CharacterAppearance} from "./CharacterAppearance.js";
import {CharacterOrigin} from "./CharacterOrigin.js";
import {CharacterPossessions} from "./CharacterPossessions.js";
import {CharacterInventory} from "./CharacterInventory.js";
import {CharacterArcana} from "./CharacterArcana.js";
import {FoundryOutfitItemRepository} from "./repositories/FoundryOutfitItemRepository.js";
import {FoundryPlaybookRepository} from "./repositories/FoundryPlaybookRepository.js";
import {FoundryMoveRepository} from "./repositories/FoundryMoveRepository.js";
import {FoundryArcanaRepository} from "./repositories/FoundryArcanaRepository.js";

const OTHER_MOVE_TYPES = ["background", "special", "follower", "expedition", "homefront"];

export class StonetopCharacter {
	constructor(actor, playbookRepository, moveRepository, inventoryRepository, arcanaRepository) {
		this._actor = actor;
		this._playbookRepo = playbookRepository;
		this._moveRepo = moveRepository;
		this._inventoryRepo = inventoryRepository;
		this._background = new CharacterBackgrounds(new StonetopFlags(actor, "background"));
		this._instinct = new CharacterInstincts(new StonetopFlags(actor, "instinct"));
		this._appearance = new CharacterAppearance(new StonetopFlags(actor, "appearance"));
		this._origin = new CharacterOrigin(new StonetopFlags(actor, "origin"));
		this._moveResources = new MoveResources(new StonetopFlags(actor, "moves"));
		this._possessions = new CharacterPossessions(new StonetopFlags(actor, "possessions"));
		this._inventory = new CharacterInventory(new StonetopFlags(actor, "inventory"));
		this._arcana = new CharacterArcana(new StonetopFlags(actor, "arcana"), arcanaRepository);
	}

	static create(actor) {
		return new StonetopCharacter(
			actor,
			new FoundryPlaybookRepository(),
			new FoundryMoveRepository(),
			new FoundryOutfitItemRepository(),
			new FoundryArcanaRepository(),
		);
	}

	get type() { return this._actor.type; }
	get background() { return this._background; }
	get instinct() { return this._instinct; }
	get appearance() { return this._appearance; }
	get origin() { return this._origin; }
	get moveResources() { return this._moveResources; }
	get possessions() { return this._possessions; }

	async updateName(name) {
		await this._actor.update({ name });
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
		return new CharacterSnapshotBuilder()
			.withName(actor.name)
			.withPlaybook(playbookData ? _buildPlaybookSection(playbookData, this._background, this._instinct, this._appearance, this._origin) : null)
			.withDebilities(_buildDebilitiesSection(actor))
			.withStats(_buildStatsSection(actor))
			.withVitals(_buildVitalsSection(actor, playbookData))
			.withMoves(moves)
			.withMovelist(_buildMovelist(moves, inventory.other))
			.withInventory(inventory)
			.withArcana(await this._arcana.buildSnapshot(
			actor.system.stats ?? {},
			this._inventory.checked,
			this._inventory.resources
		))
			.withRollMode(actor.flags?.pbta?.rollMode ?? "normal")
			.build();
	}

	async _buildMovesSection(playbookData, ownedAllByName, actorLevel) {
		const categories = [];

		if (playbookData) {
			const background = playbookData.backgrounds?.find(b => b.slug === this._background.selectedSlug);
			const bgMoveNames = new Set(background?.moves ?? []);
			const bgSlugs = new Set([...bgMoveNames].map(_toSlug));
			const entries = await this._moveRepo.getPlaybookMoves(playbookData.name);
			if (entries.length > 0) {
				const sorted = this.sortPlaybookMoves(
					this.buildMovelistContext(entries, ownedAllByName, bgMoveNames, actorLevel, playbookData.name)
				);
				const moveResourcesMap = this._moveResources.getMoveResources();
				const source = { type: "playbook", slug: playbookData.slug };
				categories.push(new MoveCategorySnapshotBuilder()
					.withKey("playbook")
					.withTitle(`${playbookData.name} Moves`)
					.withNote(playbookData.startingMovesNote ?? null)
					.withMoves(sorted.map(m => _buildMoveEntry(m, source, moveResourcesMap, bgSlugs)))
					.build()
				);
			}
		}

		const basicEntries = await this._moveRepo.getBasicMoves();
		if (basicEntries.length > 0) {
			categories.push(new MoveCategorySnapshotBuilder()
				.withKey("basic")
				.withTitle("Basic Moves")
				.withNote(null)
				.withMoves(basicEntries.map(e => {
					const instances = ownedAllByName.get(e.name) ?? [];
					return new MoveSnapshotBuilder()
						.withId(e.id)
						.withCompendiumId(e.id)
						.withOwnedId(instances[0]?._id ?? null)
						.withName(e.name)
						.withDescription(e.description ?? "")
						.withRollType(e.rollType)
						.withIsStarting(false)
						.withSource({ type: "basic" })
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
				}))
				.build()
			);
		}

		for (const moveType of OTHER_MOVE_TYPES) {
			const items = this._actor.items.filter(i => i.type === "move" && i.system?.moveType === moveType);
			if (items.length > 0) {
				categories.push(new MoveCategorySnapshotBuilder()
					.withKey(moveType)
					.withTitle(moveType.charAt(0).toUpperCase() + moveType.slice(1) + " Moves")
					.withNote(null)
					.withMoves(items.map(i => new MoveSnapshotBuilder()
						.withId(i._id)
						.withCompendiumId(i._id)
						.withOwnedId(i._id)
						.withName(i.name)
						.withDescription(i.system?.description ?? "")
						.withRollType(i.system?.rollType ?? null)
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

		return categories;
	}

	async _buildInventorySection(playbookData, ownedAllByName, actorLevel) {
		const checked   = this._inventory.checked;
		const resources = this._inventory.resources;
		const rPool     = this._inventory.regularPool;
		const sPool     = this._inventory.smallPool;
		const loadLevel = this._inventory.loadLevel;
		const allItems  = await this._inventoryRepo.getAll();

		const mapItem = (outfitItem) => {
			const res = outfitItem.resource;
			return new InventoryItemSnapshotBuilder()
				.withSlug(outfitItem.slug)
				.withName(outfitItem.name)
				.withNote(outfitItem.note)
				.withWeight(outfitItem.weight)
				.withChecked(checked[outfitItem.slug] ?? false)
				.withResource(res ? new ResourceBuilder()
					.withCurrent(resources[outfitItem.slug] ?? 0)
					.withMax(res.max)
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

		const arcanaItems = await this._arcana.weightedInventoryItems();
		const allSmall = allItems.filter(i => i.inventoryColumn === "small");
		const flatRegular = [
			...allItems.filter(i => i.inventoryColumn === "regular").map(mapItem),
			...customItems.filter(i => i.system.inventoryColumn === "regular").map(mapCustomItem),
			...arcanaItems.filter(i => i.inventoryColumn === "regular").map(mapItem),
		];

		let possessions = null;
		if (playbookData?.specialPossessions) {
			const maxUsesMap = this.computePossessionMaxUses(playbookData.specialPossessions, ownedAllByName, actorLevel);
			possessions = this._buildPossessionsSnapshot(playbookData.specialPossessions, maxUsesMap);
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

		const load = new LoadSnapshotBuilder()
			.withInstruction(_loc("stonetop.inventory.outfit.heading"))
			.withSelected(loadLevel ?? null)
			.withLoadLevelLight(loadLevel === "light")
			.withLoadLevelNormal(loadLevel === "normal")
			.withLoadLevelHeavy(loadLevel === "heavy")
			.withOptions([
				new LoadOptionSnapshot("light",  "Light",  _loc("stonetop.inventory.outfit.light")),
				new LoadOptionSnapshot("normal", "Normal", _loc("stonetop.inventory.outfit.normal")),
				new LoadOptionSnapshot("heavy",  "Heavy",  _loc("stonetop.inventory.outfit.heavy")),
			])
			.build();

		const outfit = new OutfitSnapshotBuilder()
			.withLoad(load)
			.withRegularItems(flatRegular)
			.withRegularSegments(_segmentByTwoCol(flatRegular))
			.withRegularPool(new ResourceBuilder().withCurrent(rPool).withMax(9).withTitle(null).withLabels([]).build())
			.withSmallItems([
				...allSmall.filter(i => !i.smallGrid).map(mapItem),
				...customItems.filter(i => i.system.inventoryColumn === "small").map(mapCustomItem),
				...arcanaItems.filter(i => i.inventoryColumn === "small").map(mapItem),
			])
			.withSmallGridItems(allSmall.filter(i => i.smallGrid).map(mapItem))
			.withSmallPool(new ResourceBuilder().withCurrent(sPool).withMax(9).withTitle(null).withLabels([]).build())
			.build();

		return new InventorySnapshot(outfit, possessions, other);
	}

	_buildPossessionsSnapshot(specialPossessions, maxUsesMap) {
		const { pickNote, pickCount, preselected = [], options } = specialPossessions;
		const selectedSlugs = this._possessions.selected;
		const usesMap = this._possessions.uses;
		const preselectedSet = new Set(preselected);

		const items = options.map(opt => {
			const isPre = preselectedSet.has(opt.slug);
			const isSelected = isPre || selectedSlugs.has(opt.slug);
			const maxUses = maxUsesMap[opt.slug] ?? opt.resource?.max ?? null;
			const currentUses = isSelected ? (usesMap[opt.slug] ?? 0) : 0;
			const resourceDef = opt.resource ?? null;
			const resource = resourceDef ? new ResourceBuilder()
				.withCurrent(currentUses)
				.withMax(maxUses ?? resourceDef.max)
				.withTitle(resourceDef.title ?? null)
				.withLabels(resourceDef.labels ?? [])
				.build() : null;
			return new PossessionItemSnapshotBuilder()
				.withSlug(opt.slug)
				.withLabel(opt.label)
				.withDescription(opt.description ?? "")
				.withSelected(isSelected)
				.withChecked(isSelected)
				.withDisabled(isPre)
				.withPreselected(isPre)
				.withPreselectedSource(isPre ? "Starting" : null)
				.withResource(resource)
				.withUsesLabel(resourceDef?.title ?? null)
				.withChoices(null)
				.withChoiceGroups(null)
				.build();
		});

		return new PossessionsSnapshot(pickCount, pickNote, items);
	}

	async buildInventoryContext() {
		const checked = this._inventory.checked;
		const resources = this._inventory.resources;
		const loadLevel = this._inventory.loadLevel;
		const rPool = this._inventory.regularPool;
		const sPool = this._inventory.smallPool;
		const allItems = await this._inventoryRepo.getAll();

		const mapCompendium = (outfitItem) => ({
			slug: outfitItem.slug,
			label: outfitItem.name,
			note: outfitItem.note,
			isCustom: false,
			ownedId: null,
			checked: checked[outfitItem.slug] ?? false,
			breakBefore: outfitItem.breakBefore,
			smallGrid: false,
			twoCol: outfitItem.twoCol,
			resourceChecks: outfitItem.resource?.max
				? outfitItem.resource.labels.map((label, i) => ({
					label: label || null,
					checked: i < (resources[outfitItem.slug] ?? 0),
				}))
				: null,
			weightSlots: Array.from({ length: outfitItem.weight ?? 0 }, (_, i) => i),
		});

		const mapCustom = item => ({
			slug: item._id,
			label: item.name,
			note: null,
			isCustom: true,
			ownedId: item._id,
			checked: checked[item._id] ?? false,
			breakBefore: false,
			smallGrid: false,
			twoCol: false,
			resourceChecks: null,
			weightSlots: Array.from({ length: item.system.weight ?? 1 }, (_, i) => i),
		});

		const customItems = this._actor.items.filter(i =>
			i.type === "move" && i.system?.moveType === "inventory-custom"
		);

		const allRegular = allItems.filter(i => i.inventoryColumn === "regular");
		const allSmall   = allItems.filter(i => i.inventoryColumn === "small");

		const flatRegular = [
			...allRegular.map(mapCompendium),
			...customItems.filter(i => i.system.inventoryColumn === "regular").map(mapCustom),
		];

		return {
			regularItems: flatRegular,
			regularSegments: _segmentByTwoCol(flatRegular),
			smallItems: allSmall.filter(i => !i.smallGrid).map(mapCompendium).concat(
				customItems.filter(i => i.system.inventoryColumn === "small").map(mapCustom)
			),
			smallGridItems: allSmall.filter(i => i.smallGrid).map(mapCompendium),
			loadLevel,
			loadLevelLight:  loadLevel === "light",
			loadLevelNormal: loadLevel === "normal",
			loadLevelHeavy:  loadLevel === "heavy",
			regularPool: {
				groups: [
					Array.from({ length: 3 }, (_, i) => ({ checked: i < rPool, index: i })),
					Array.from({ length: 3 }, (_, i) => ({ checked: (i + 3) < rPool, index: i + 3 })),
					Array.from({ length: 3 }, (_, i) => ({ checked: (i + 6) < rPool, index: i + 6 })),
				],
			},
			smallPool: {
				groups: [
					Array.from({ length: 3 }, (_, i) => ({ checked: i < sPool, index: i })),
					Array.from({ length: 3 }, (_, i) => ({ checked: (i + 3) < sPool, index: i + 3 })),
					Array.from({ length: 3 }, (_, i) => ({ checked: (i + 6) < sPool, index: i + 6 })),
				],
			},
		};
	}

	async setInventoryItemChecked(slug, isChecked) { await this._inventory.setItemChecked(slug, isChecked); }
	async setInventoryResource(slug, count)         { await this._inventory.setResource(slug, count); }
	async setInventoryLoadLevel(level)              { await this._inventory.setLoadLevel(level); }
	async setInventoryRegularPool(count)            { await this._inventory.setRegularPool(count); }
	async setInventorySmallPool(count)              { await this._inventory.setSmallPool(count); }

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
				const preselectedSource = isPre ? (bgPreselectedSet.has(opt.slug) ? "Background" : "Starting") : null;
				const maxUses = maxUsesMap[opt.slug] ?? opt.resource?.max ?? null;
				const pickedSubs = subChoicesMap[opt.slug] ?? [];
				return {
					slug: opt.slug,
					label: opt.label,
					description: opt.description ?? "",
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
	async setPossessionUses(slug, count) { await this._possessions.setUses(slug, count); }
	async selectSubChoice(possessionSlug, choiceSlug)   { await this._possessions.addSubChoice(possessionSlug, choiceSlug); }
	async deselectSubChoice(possessionSlug, choiceSlug) { await this._possessions.removeSubChoice(possessionSlug, choiceSlug); }
	async selectSubChoiceExclusive(possessionSlug, choiceSlug, exclusiveSlugs) { await this._possessions.selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs); }
	async setSubChoiceUses(possessionSlug, choiceSlug, count) { await this._possessions.setChoiceUses(possessionSlug, choiceSlug, count); }

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
		}

		const basicEntries = await this._moveRepo.getBasicMoves();
		const basicMoves = basicEntries.map(e => {
			const instances = ownedAllByName.get(e.name) ?? [];
			return {
				name: e.name,
				compendiumId: e.id,
				ownedId: instances[0]?._id ?? null,
				rollType: e.rollType,
				owned: instances.length > 0,
			};
		});

		const otherGroups = OTHER_MOVE_TYPES.reduce((acc, t) => {
			const items = this._actor.items.filter(i => i.type === "move" && i.system?.moveType === t);
			if (items.length) acc.push({
				key: t,
				label: t.charAt(0).toUpperCase() + t.slice(1) + " Moves",
				moves: items.map(i => ({ name: i.name, ownedId: i._id, rollType: i.system?.rollType ?? null })),
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
			.map(i => ({ name: i.name, ownedId: i._id, rollType: i.system?.rollType ?? null, description: i.system?.description ?? null }));

		return { playbookMoves, basicMoves, otherGroups, otherMoves, startingMovesNote: playbookData?.startingMovesNote ?? null };
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

		const missing = entries.filter(e =>
			(e.isStarting || bgMoveNames.has(e.name)) && !ownedNames.has(e.name)
		);
		if (missing.length) {
			const docs = await Promise.all(missing.map(e => this._moveRepo.getPlaybookMoveDocument(e.id)));
			await this._actor.createEmbeddedDocuments("Item", docs.filter(Boolean).map(d => d.toObject()));
		}

		const basicEntries = await this._moveRepo.getBasicMoves();
		const missingBasic = basicEntries.filter(e => !ownedNames.has(e.name));
		if (missingBasic.length) {
			const docs = await Promise.all(missingBasic.map(e => this._moveRepo.getBasicMoveDocument(e.id)));
			await this._actor.createEmbeddedDocuments("Item", docs.filter(Boolean).map(d => d.toObject()));
		}
	}

	async addMove(compendiumId) {
		const doc = await this._moveRepo.getPlaybookMoveDocument(compendiumId);
		if (doc) await this._actor.createEmbeddedDocuments("Item", [doc.toObject()]);
	}

	async removeMove(ownedId) {
		if (ownedId) await this._actor.deleteEmbeddedDocuments("Item", [ownedId]);
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

	async onRoll(event) {
		const itemId = event.currentTarget.closest(".item")?.dataset.itemId;
		if (!itemId) return false;
		const item = this._actor.items.get(itemId);
		const stat = item?.system?.rollType ?? null;
		if (!stat) return false;

		const isDescription = event.currentTarget.getAttribute("data-show") === "description";
		const descriptionOnly = isDescription || (item.type === "npcMove" && !item.system.rollFormula);
		const options = {};
		if (!game.settings.get("pbta", "hideRollMode")) {
			options.rollMode = this._actor.flags?.pbta?.rollMode;
		}
		await item.roll({ ...this.applyDebilityRollMode(stat, options), descriptionOnly });
		return true;
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
		const hasActiveDebility = Object.values(debilityOptions).some(
			opt => opt.value && Array.isArray(opt.stat) && opt.stat.includes(stat)
		);
		if (!hasActiveDebility) return options;
		if (options.rollMode === "adv") return { ...options, rollMode: "def" };
		if (options.rollMode === "dis") return options;
		return { ...options, rollMode: "dis" };
	}
	async addArcanum(slug)    { await this._arcana.addArcanum(slug); }
	async removeArcanum(slug) { await this._arcana.removeArcanum(slug); }
	async flipArcanum(slug)   { await this._arcana.flipArcanum(slug); }
	async unflipArcanum(slug) { await this._arcana.unflipArcanum(slug); }
	async setArcanumUnlockCount(arcanumSlug, optionSlug, count)     { await this._arcana.setUnlockCount(arcanumSlug, optionSlug, count); }
	async setArcanumBackOptionCount(arcanumSlug, optionSlug, count) { await this._arcana.setBackOptionCount(arcanumSlug, optionSlug, count); }
	async setArcanumResource(slug, count)                           { await this._inventory.setResource(slug, count); }

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

function _loc(key) {
	return typeof game !== "undefined" ? game.i18n.localize(key) : key;
}

function _toSlug(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const _STAT_DEFS = {
	str: { name: "Strength",     abbr: "STR" },
	dex: { name: "Dexterity",    abbr: "DEX" },
	con: { name: "Constitution", abbr: "CON" },
	int: { name: "Intelligence", abbr: "INT" },
	wis: { name: "Wisdom",       abbr: "WIS" },
	cha: { name: "Charisma",     abbr: "CHA" },
};

const _DEBILITY_DEFS = [
	{ key: "weakened",  name: "Weakened",  stats: ["str", "dex"] },
	{ key: "dazed",     name: "Dazed",     stats: ["int", "wis"] },
	{ key: "miserable", name: "Miserable", stats: ["con", "cha"] },
];

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

function _buildVitalsSection(actor, playbookData) {
	const attrs = actor.system?.attributes ?? {};
	const level = attrs.level?.value ?? 1;
	return new VitalsSnapshotBuilder()
		.withHp(playbookData ? new ValueMax(attrs.hp?.value ?? 0, playbookData.hp ?? 0) : new ValueMax(0, 0))
		.withDamage(playbookData?.damage ?? null)
		.withArmor(attrs.armour?.value ?? 0)
		.withLevel(level)
		.withXp(new ValueMax(attrs.xp?.value ?? 0, 6 + level * 2))
		.build();
}

function _buildPlaybookSection(playbookData, background, instinct, appearance, origin) {
	const savedBg      = background.selectedSlug || null;
	const savedChoices = background.choices;
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
			.withMoves((b.moves ?? []).map(_toSlug))
			.withChoices(choices)
			.build();
	});

	const instinctOptions = (playbookData.instincts ?? []).map(({ word, description }) => {
		const value = `${word} — ${description}`;
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
		new OriginOptionSnapshot(region, names, region === savedOrigin)
	);

	return new PlaybookSnapshotBuilder()
		.withSlug(playbookData.slug)
		.withName(playbookData.name)
		.withImg(playbookData.img ?? null)
		.withDescription(playbookData.description ?? null)
		.withStatsNote(playbookData.statsNote ?? null)
		.withBackground(new BackgroundSection(savedBg, bgOptions))
		.withInstinct(new InstinctSection(savedInstinct, instinctOptions))
		.withAppearance(new AppearanceSection(appearanceOptions))
		.withOrigin(new OriginSection(savedOrigin, originOptions))
		.build();
}

function _buildMoveEntry(entry, source, moveResourcesMap, bgSlugs = new Set()) {
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
	const sourceLabel = entry.isStarting ? (bgSlugs.has(_toSlug(entry.name)) ? "Background" : "Starting") : null;
	return new MoveSnapshotBuilder()
		.withId(entry.compendiumId)
		.withCompendiumId(entry.compendiumId)
		.withOwnedId(entry.ownedIds[0] ?? null)
		.withName(entry.name)
		.withDescription(entry.description)
		.withRollType(entry.rollType)
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
		.build();
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

function _buildMovelist(categories, other) {
	const playbookCat = categories.find(c => c.key === "playbook");
	const basicCat    = categories.find(c => c.key === "basic");
	const otherCats   = categories.filter(c => c.key !== "basic" && c.key !== "playbook");
	return new MovelistBuilder()
		.withPlaybookMoves(playbookCat?.moves ?? [])
		.withBasicMoves(basicCat?.moves ?? [])
		.withOtherGroups(otherCats.map(cat => new MoveGroupSnapshot(cat.key, cat.title, cat.moves)))
		.withOtherMoves(other)
		.withStartingMovesNote(playbookCat?.note ?? null)
		.build();
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
