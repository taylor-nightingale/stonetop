import {PlaybookMoveEntry} from "./PlaybookMoveEntry.js";
import {MoveResources} from "./MoveResources.js";
import {StonetopFlags} from "./StonetopFlags.js";
import {CharacterBackgrounds} from "./CharacterBackgrounds.js";
import {CharacterInstincts} from "./CharacterInstincts.js";
import {CharacterAppearance} from "./CharacterAppearance.js";
import {CharacterOrigin} from "./CharacterOrigin.js";
import {CharacterPossessions} from "./CharacterPossessions.js";
import {CharacterInventory} from "./CharacterInventory.js";
import {FoundryInventoryRepository} from "./repositories/FoundryInventoryRepository.js";
import {FoundryPlaybookRepository} from "./repositories/FoundryPlaybookRepository.js";
import {FoundryPlaybookMoveRepository} from "./repositories/FoundryPlaybookMoveRepository.js";
import {FoundryBasicMoveRepository} from "./repositories/FoundryBasicMoveRepository.js";
const OTHER_MOVE_TYPES = ["background", "special", "follower", "expedition", "homefront"];

export class StonetopCharacter {
	constructor(actor, playbookRepository, playbookMoveRepository, basicMoveRepository, inventoryRepository) {
		this._actor = actor;
		this._playbookRepo = playbookRepository;
		this._playbookMoveRepo = playbookMoveRepository;
		this._basicMoveRepo = basicMoveRepository;
		this._inventoryRepo = inventoryRepository;
		this._background = new CharacterBackgrounds(new StonetopFlags(actor, "background"));
		this._instinct = new CharacterInstincts(new StonetopFlags(actor, "instinct"));
		this._appearance = new CharacterAppearance(new StonetopFlags(actor, "appearance"));
		this._origin = new CharacterOrigin(new StonetopFlags(actor, "origin"));
		this._moveResources = new MoveResources(new StonetopFlags(actor, "moves"));
		this._possessions = new CharacterPossessions(new StonetopFlags(actor, "possessions"));
		this._inventory = new CharacterInventory(new StonetopFlags(actor, "inventory"));
	}

	static create(actor) {
		return new StonetopCharacter(
			actor,
			new FoundryPlaybookRepository(),
			new FoundryPlaybookMoveRepository(),
			new FoundryBasicMoveRepository(),
			new FoundryInventoryRepository(),
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

	async buildSheetData() {
		return _adaptSnapshotForSheet(await this.buildSnapshot());
	}

	async buildSnapshot() {
		const actor = this._actor;
		const actorLevel = actor.system?.attributes?.level?.value ?? 1;
		const playbookData = await this.playbook();
		const ownedAllByName = this._buildOwnedMovesMap();
		return {
			name:      actor.name,
			playbook:  playbookData ? _buildPlaybookSection(playbookData, this._background, this._instinct, this._appearance, this._origin) : null,
			debilities: _buildDebilitiesSection(actor),
			stats:     _buildStatsSection(actor),
			vitals:    _buildVitalsSection(actor, playbookData),
			moves:     await this._buildMovesSection(playbookData, ownedAllByName, actorLevel),
			inventory: await this._buildInventorySection(playbookData, ownedAllByName, actorLevel),
			rollMode:  actor.flags?.pbta?.rollMode ?? "normal",
		};
	}

	async _buildMovesSection(playbookData, ownedAllByName, actorLevel) {
		const categories = [];

		if (playbookData) {
			const background = playbookData.backgrounds?.find(b => b.slug === this._background.selectedSlug);
			const bgMoveNames = new Set(background?.moves ?? []);
			const entries = await this._playbookMoveRepo.getMovesForPlaybook(playbookData.name);
			if (entries.length > 0) {
				const sorted = this.sortPlaybookMoves(
					this.buildMovelistContext(entries, ownedAllByName, bgMoveNames, actorLevel, playbookData.name)
				);
				const moveResourcesMap = this._moveResources.getMoveResources();
				const source = { type: "playbook", slug: playbookData.slug };
				categories.push({
					key:   "playbook",
					title: `${playbookData.name} Moves`,
					note:  playbookData.startingMovesNote ?? null,
					moves: sorted.map(m => _buildMoveEntry(m, source, moveResourcesMap)),
				});
			}
		}

		const basicEntries = await this._basicMoveRepo.getAll();
		if (basicEntries.length > 0) {
			categories.push({
				key:   "basic",
				title: "Basic Moves",
				note:  null,
				moves: basicEntries.map(e => {
					const instances = ownedAllByName.get(e.name) ?? [];
					return {
						id:          e._id,
						name:        e.name,
						description: e.system?.description ?? "",
						rollType:    e.system?.rollType ?? null,
						isStarting:  false,
						source:      { type: "basic" },
						owned:       instances.length > 0,
						ownedIds:    instances.map(i => i._id),
						locked:      false,
						requirement: null,
						resource:    null,
						repeat:      null,
					};
				}),
			});
		}

		for (const moveType of OTHER_MOVE_TYPES) {
			const items = this._actor.items.filter(i => i.type === "move" && i.system?.moveType === moveType);
			if (items.length > 0) {
				categories.push({
					key:   moveType,
					title: moveType.charAt(0).toUpperCase() + moveType.slice(1) + " Moves",
					note:  null,
					moves: items.map(i => ({
						id:          i._id,
						name:        i.name,
						description: i.system?.description ?? "",
						rollType:    i.system?.rollType ?? null,
						isStarting:  false,
						source:      { type: moveType },
						owned:       true,
						ownedIds:    [i._id],
						locked:      false,
						requirement: null,
						resource:    null,
						repeat:      null,
					})),
				});
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

		const mapItem = item => ({
			slug:        item.system.slug,
			name:        item.name,
			note:        item.system.note ?? null,
			weight:      item.system.weight ?? 0,
			checked:     checked[item.system.slug] ?? false,
			resource:    item.system.resource
				? { current: resources[item.system.slug] ?? 0, max: item.system.resource.max, title: item.system.resource.title ?? null, labels: item.system.resource.labels ?? [] }
				: null,
			isCustom:    false,
			twoCol:      item.system.twoCol ?? false,
			breakBefore: item.system.breakBefore ?? false,
		});

		const allSmall = allItems.filter(i => i.system.inventoryColumn === "small");

		let possessions = null;
		if (playbookData?.specialPossessions) {
			const maxUsesMap = this.computePossessionMaxUses(playbookData.specialPossessions, ownedAllByName, actorLevel);
			possessions = this._buildPossessionsSnapshot(playbookData.specialPossessions, maxUsesMap);
		}

		const other = this._actor.items
			.filter(i => i.type === "move" && i.system?.moveType === "other")
			.map(i => ({ id: i._id, name: i.name, description: i.system?.description ?? null, moveType: i.system?.moveType ?? null }));

		return {
			outfit: {
				load: {
					instruction: _loc("stonetop.inventory.outfit.heading"),
					selected:    loadLevel ?? null,
					options: [
						{ slug: "light",  label: "Light",  note: _loc("stonetop.inventory.outfit.light") },
						{ slug: "normal", label: "Normal", note: _loc("stonetop.inventory.outfit.normal") },
						{ slug: "heavy",  label: "Heavy",  note: _loc("stonetop.inventory.outfit.heavy") },
					],
				},
				regularItems: allItems.filter(i => i.system.inventoryColumn === "regular").map(mapItem),
				regularPool:  { current: rPool, max: 9, title: null, labels: [] },
				smallItems:   allSmall.filter(i => !i.system.smallGrid).map(mapItem),
				smallGridItems: allSmall.filter(i => i.system.smallGrid).map(mapItem),
				smallPool:    { current: sPool, max: 9, title: null, labels: [] },
			},
			possessions,
			other,
		};
	}

	_buildPossessionsSnapshot(specialPossessions, maxUsesMap) {
		const { pickNote, pickCount, preselected = [], options } = specialPossessions;
		const selectedSlugs = this._possessions.selected;
		const usesMap = this._possessions.uses;
		const preselectedSet = new Set(preselected);

		return {
			pickCount,
			pickNote,
			items: options.map(opt => {
				const isPre = preselectedSet.has(opt.slug);
				const isSelected = isPre || selectedSlugs.has(opt.slug);
				const maxUses = maxUsesMap[opt.slug] ?? opt.resource?.max ?? null;
				const currentUses = isSelected ? (usesMap[opt.slug] ?? 0) : 0;
				const resourceDef = opt.resource ?? null;
				return {
					slug:        opt.slug,
					label:       opt.label,
					description: opt.description ?? "",
					selected:    isSelected,
					disabled:    isPre,
					preselected: isPre,
					resource:    resourceDef
						? { current: currentUses, max: maxUses ?? resourceDef.max, title: resourceDef.title ?? null, labels: resourceDef.labels ?? [] }
						: null,
					choices:      null,
					choiceGroups: null,
				};
			}),
		};
	}

	async buildInventoryContext() {
		const checked = this._inventory.checked;
		const resources = this._inventory.resources;
		const loadLevel = this._inventory.loadLevel;
		const rPool = this._inventory.regularPool;
		const sPool = this._inventory.smallPool;
		const allItems = await this._inventoryRepo.getAll();

		const mapCompendium = item => ({
			slug: item.system.slug,
			label: item.name,
			note: item.system.note ?? null,
			isCustom: false,
			ownedId: null,
			checked: checked[item.system.slug] ?? false,
			breakBefore: item.system.breakBefore ?? false,
			smallGrid: item.system.smallGrid ?? false,
			twoCol: item.system.twoCol ?? false,
			resourceChecks: item.system.resource?.max
				? item.system.resource.labels.map((label, i) => ({
					label: label || null,
					checked: i < (resources[item.system.slug] ?? 0),
				}))
				: null,
			weightSlots: Array.from({ length: item.system.weight ?? 0 }, (_, i) => i),
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

		const allRegular = allItems.filter(i => i.system.inventoryColumn === "regular");
		const allSmall   = allItems.filter(i => i.system.inventoryColumn === "small");

		const flatRegular = [
			...allRegular.map(mapCompendium),
			...customItems.filter(i => i.system.inventoryColumn === "regular").map(mapCustom),
		];

		return {
			regularItems: flatRegular,
			regularSegments: _segmentByTwoCol(flatRegular),
			smallItems: allSmall.filter(i => !i.system.smallGrid).map(mapCompendium).concat(
				customItems.filter(i => i.system.inventoryColumn === "small").map(mapCustom)
			),
			smallGridItems: allSmall.filter(i => i.system.smallGrid).map(mapCompendium),
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
			const entries = await this._playbookMoveRepo.getMovesForPlaybook(playbookName);
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

		const basicEntries = await this._basicMoveRepo.getAll();
		const basicMoves = basicEntries.map(e => {
			const instances = ownedAllByName.get(e.name) ?? [];
			return {
				name: e.name,
				compendiumId: e._id,
				ownedId: instances[0]?._id ?? null,
				rollType: e.system?.rollType ?? null,
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

		const entries = await this._playbookMoveRepo.getMovesForPlaybook(playbookName);
		const ownedNames = new Set(this._actor.items.filter(i => i.type === "move").map(i => i.name));

		const playbookData = await this.playbook();
		const background = playbookData?.backgrounds?.find(b => b.slug === this._background.selectedSlug);
		const bgMoveNames = new Set(background?.moves ?? []);

		const missing = entries.filter(e =>
			(e.system?.isStartingMove || bgMoveNames.has(e.name)) && !ownedNames.has(e.name)
		);
		if (missing.length) {
			const docs = await Promise.all(missing.map(e => this._playbookMoveRepo.getDocument(e._id)));
			await this._actor.createEmbeddedDocuments("Item", docs.filter(Boolean).map(d => d.toObject()));
		}

		const basicEntries = await this._basicMoveRepo.getAll();
		const missingBasic = basicEntries.filter(e => !ownedNames.has(e.name));
		if (missingBasic.length) {
			const docs = await Promise.all(missingBasic.map(e => this._basicMoveRepo.getDocument(e._id)));
			await this._actor.createEmbeddedDocuments("Item", docs.filter(Boolean).map(d => d.toObject()));
		}
	}

	async addMove(compendiumId) {
		const doc = await this._playbookMoveRepo.getDocument(compendiumId);
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
			{ value: rawStats[key]?.value ?? 0, name, abbr },
		])
	);
}

function _buildDebilitiesSection(actor) {
	const opts = actor.system?.attributes?.debilities?.options ?? {};
	return _DEBILITY_DEFS.map(({ key, name, stats }) => ({
		key, name, stats,
		active: !!(opts[key]?.value),
	}));
}

function _buildVitalsSection(actor, playbookData) {
	const attrs = actor.system?.attributes ?? {};
	const level = attrs.level?.value ?? 1;
	return {
		hp:     playbookData ? { value: attrs.hp?.value ?? 0, max: playbookData.hp ?? 0 } : { value: 0, max: 0 },
		damage: playbookData?.damage ?? null,
		armor:  attrs.armour?.value ?? 0,
		level,
		xp:     { value: attrs.xp?.value ?? 0, max: 6 + level * 2 },
	};
}

function _buildPlaybookSection(playbookData, background, instinct, appearance, origin) {
	const savedBg      = background.selectedSlug || null;
	const savedChoices = background.choices;
	const savedInstinct = instinct.selectedValue || null;
	const savedAppearance = appearance.saved;
	const savedOrigin  = origin.selected || null;

	return {
		slug:        playbookData.slug,
		name:        playbookData.name,
		img:         playbookData.img ?? null,
		description: playbookData.description ?? null,
		statsNote:   playbookData.statsNote ?? null,
		background: {
			selected: savedBg,
			options: (playbookData.backgrounds ?? []).map(b => ({
				slug:        b.slug,
				label:       b.label,
				description: b.description ?? "",
				selected:    b.slug === savedBg,
				moves:       (b.moves ?? []).map(_toSlug),
				choices:     b.choices ? {
					label:   b.choices.label,
					count:   b.choices.count,
					options: b.choices.options.map(o => ({ slug: o.slug, label: o.label })),
					saved:   savedChoices,
				} : null,
			})),
		},
		instinct: {
			selected: savedInstinct,
			options: (playbookData.instincts ?? []).map(({ word, description }) => ({ word, description })),
		},
		appearance: {
			saved:   savedAppearance,
			options: playbookData.appearance ?? [],
		},
		origin: {
			selected: savedOrigin,
			options: (playbookData.origin ?? []).map(({ region, names }) => ({ region, names })),
		},
	};
}

function _buildMoveEntry(entry, source, moveResourcesMap) {
	const resourceDef = entry.resource;
	const resource = resourceDef
		? { current: moveResourcesMap[entry.name] ?? 0, max: resourceDef.max, title: resourceDef.title ?? null, labels: resourceDef.labels ?? [] }
		: null;
	const repeat = entry.repeatable
		? { max: entry.repeatChecks.length, current: entry.ownedIds.length }
		: null;
	const requirement = entry.requiresLabel
		? { label: entry.requiresLabel, met: !entry.locked }
		: null;
	return {
		id:          entry.compendiumId,
		name:        entry.name,
		description: entry.description,
		rollType:    entry.rollType,
		isStarting:  entry.isStarting,
		source,
		owned:       entry.owned,
		ownedIds:    entry.ownedIds,
		locked:      entry.locked,
		requirement,
		resource,
		repeat,
	};
}

// ── Sheet rendering adapter ───────────────────────────────────────────────────

function _makePoolGroups(current) {
	return [
		Array.from({ length: 3 }, (_, i) => ({ checked: i < current, index: i })),
		Array.from({ length: 3 }, (_, i) => ({ checked: (i + 3) < current, index: i + 3 })),
		Array.from({ length: 3 }, (_, i) => ({ checked: (i + 6) < current, index: i + 6 })),
	];
}

function _makeRepeatChecks(move) {
	const { max, current } = move.repeat;
	const lastOwnedId = move.ownedIds[move.ownedIds.length - 1] ?? null;
	return Array.from({ length: max }, (_, i) => ({
		checked: i < current,
		ownedId: i < current ? lastOwnedId : null,
		disabled: move.isStarting || move.locked || (!(i < current) && i !== current),
	}));
}

function _makeResourceCheckList(resource) {
	const { current, max, labels } = resource;
	return Array.from({ length: max }, (_, i) => ({
		checked: i < current,
		label: labels[i] || null,
	}));
}

function _adaptInventoryItemForSheet(item) {
	return {
		slug:        item.slug,
		label:       item.name,
		note:        item.note,
		isCustom:    item.isCustom,
		ownedId:     null,
		checked:     item.checked,
		breakBefore: item.breakBefore,
		twoCol:      item.twoCol,
		weightSlots: Array.from({ length: item.weight ?? 0 }, (_, i) => i),
		resourceChecks: item.resource ? _makeResourceCheckList(item.resource) : null,
	};
}

function _adaptSnapshotForSheet(snap) {
	const hasPlaybook = snap.playbook !== null;
	let playbookImg = null, description = null, statsNote = null;
	let backgrounds = [], instincts = [], savedInstinct = "", appearance = [], origins = [], savedOrigin = "";
	let bgSlugs = new Set();

	if (hasPlaybook) {
		const pb = snap.playbook;
		playbookImg   = pb.img;
		description   = pb.description;
		statsNote     = pb.statsNote;
		savedInstinct = pb.instinct.selected ?? "";
		savedOrigin   = pb.origin.selected ?? "";
		bgSlugs       = new Set(pb.background.options.find(b => b.selected)?.moves ?? []);

		backgrounds = pb.background.options.map(b => ({
			slug: b.slug, label: b.label, description: b.description, selected: b.selected,
			choices: b.choices ? {
				label:      b.choices.label,
				countLabel: b.choices.count.join(" or "),
				options:    b.choices.options.map(o => ({
					slug: o.slug, label: o.label, checked: !!(b.choices.saved?.[o.slug]),
				})),
			} : null,
		}));

		instincts = pb.instinct.options.map(o => {
			const value = `${o.word} — ${o.description}`;
			return { word: o.word, description: o.description, value, selected: pb.instinct.selected === value };
		});

		appearance = pb.appearance.options.map((opts, i) => ({
			lineIdx: i,
			options: opts.map(v => ({ value: v, selected: (pb.appearance.saved?.[i]) === v })),
		}));

		origins = pb.origin.options.map(o => ({
			region: o.region, names: o.names, selected: o.region === pb.origin.selected,
		}));
	}

	const adaptPlaybookMove = move => ({
		compendiumId:    move.id,
		ownedId:         move.ownedIds[0] ?? null,
		owned:           move.owned,
		rollType:        move.rollType,
		isStarting:      move.isStarting,
		locked:          move.locked,
		name:            move.name,
		description:     move.description,
		source:          move.isStarting ? (bgSlugs.has(_toSlug(move.name)) ? "Background" : "Starting") : null,
		repeatable:      move.repeat !== null,
		repeatChecks:    move.repeat ? _makeRepeatChecks(move) : null,
		resourceChecks:  move.resource ? _makeResourceCheckList(move.resource) : null,
		requiresLabel:   move.requirement?.label ?? null,
		requiresPlaybook: null,
		minLevel:        null,
	});

	const playbookCategory = snap.moves.find(c => c.key === "playbook");
	const basicCategory    = snap.moves.find(c => c.key === "basic");
	const otherCategories  = snap.moves.filter(c => c.key !== "basic" && c.key !== "playbook");

	const regularItems = snap.inventory.outfit.regularItems.map(_adaptInventoryItemForSheet);

	let possessionsCtx = null;
	if (snap.inventory.possessions) {
		const pos = snap.inventory.possessions;
		possessionsCtx = {
			pickNote: pos.pickNote,
			options:  pos.items.map(item => {
				const maxUses     = item.resource?.max ?? null;
				const currentUses = item.resource?.current ?? 0;
				return {
					slug:              item.slug,
					label:             item.label,
					description:       item.description,
					checked:           item.selected,
					preselected:       item.preselected,
					preselectedSource: item.preselected ? "Starting" : null,
					disabled:          item.disabled,
					uses:              maxUses,
					usesLabel:         item.resource?.title ?? null,
					usesChecks:        item.selected && maxUses
						? Array.from({ length: maxUses }, (_, i) => ({ checked: i < currentUses }))
						: null,
					choices:           item.choices ?? null,
					choiceGroups:      item.choiceGroups ?? null,
				};
			}),
		};
	}

	const outfit = snap.inventory.outfit;
	return {
		hasPlaybook, playbookImg, description, statsNote,
		backgrounds, instincts, savedInstinct, appearance, origins, savedOrigin,
		movelist: {
			playbookMoves:     playbookCategory?.moves.map(adaptPlaybookMove) ?? [],
			basicMoves:        (basicCategory?.moves ?? []).map(m => ({
				compendiumId: m.id, ownedId: m.ownedIds[0] ?? null, owned: m.owned, rollType: m.rollType, name: m.name,
			})),
			otherGroups:       otherCategories.map(cat => ({
				key:   cat.key,
				label: cat.title,
				moves: cat.moves.map(m => ({ ownedId: m.ownedIds[0] ?? null, rollType: m.rollType, name: m.name })),
			})),
			otherMoves:        snap.inventory.other.map(i => ({
				ownedId: i.id, rollType: null, name: i.name, description: i.description,
			})),
			startingMovesNote: playbookCategory?.note ?? null,
		},
		possessions: possessionsCtx,
		inventory: {
			loadLevelLight:   outfit.load.selected === "light",
			loadLevelNormal:  outfit.load.selected === "normal",
			loadLevelHeavy:   outfit.load.selected === "heavy",
			regularPool:      { groups: _makePoolGroups(outfit.regularPool.current) },
			regularSegments:  _segmentByTwoCol(regularItems),
			regularItems,
			smallPool:        { groups: _makePoolGroups(outfit.smallPool.current) },
			smallItems:       outfit.smallItems.map(_adaptInventoryItemForSheet),
			smallGridItems:   outfit.smallGridItems.map(_adaptInventoryItemForSheet),
		},
	};
}

function _segmentByTwoCol(items) {
	const segments = [];
	let current = null;
	for (const item of items) {
		const type = item.twoCol ? "grid" : "list";
		if (!current || current.type !== type) {
			current = { type, isGrid: type === "grid", segmentBreak: item.breakBefore ?? false, items: [] };
			segments.push(current);
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
