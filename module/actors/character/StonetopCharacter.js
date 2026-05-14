import {MoveResources} from "./MoveResources.js";
import {StonetopFlags} from "./StonetopFlags.js";
import {CharacterBackgrounds} from "./CharacterBackgrounds.js";
import {CharacterInstincts} from "./CharacterInstincts.js";
import {CharacterAppearance} from "./CharacterAppearance.js";
import {CharacterOrigin} from "./CharacterOrigin.js";
import {CharacterPossessions} from "./CharacterPossessions.js";
import {FoundryPlaybookRepository} from "./repositories/FoundryPlaybookRepository.js";
import {FoundryPlaybookMoveRepository} from "./repositories/FoundryPlaybookMoveRepository.js";
import {FoundryBasicMoveRepository} from "./repositories/FoundryBasicMoveRepository.js";
import {CharacterSheetData} from "./CharacterSheetData.js";

const OTHER_MOVE_TYPES = ["background", "special", "follower", "expedition", "homefront"];

export class StonetopCharacter {
	constructor(actor, playbookRepository, playbookMoveRepository, basicMoveRepository) {
		this._actor = actor;
		this._playbookRepo = playbookRepository;
		this._playbookMoveRepo = playbookMoveRepository;
		this._basicMoveRepo = basicMoveRepository;
		this._background = new CharacterBackgrounds(new StonetopFlags(actor, "background"));
		this._instinct = new CharacterInstincts(new StonetopFlags(actor, "instinct"));
		this._appearance = new CharacterAppearance(new StonetopFlags(actor, "appearance"));
		this._origin = new CharacterOrigin(new StonetopFlags(actor, "origin"));
		this._moveResources = new MoveResources(new StonetopFlags(actor, "moves"));
		this._possessions = new CharacterPossessions(new StonetopFlags(actor, "possessions"));
	}

	static create(actor) {
		return new StonetopCharacter(
			actor,
			new FoundryPlaybookRepository(),
			new FoundryPlaybookMoveRepository(),
			new FoundryBasicMoveRepository(),
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
		const playbookData = await this.playbook();
		if (!playbookData) return new CharacterSheetData();

		const savedBg = this._background.selectedSlug;
		const savedInstinct = this._instinct.selectedValue;
		const savedAppearance = this._appearance.saved;
		const savedOrigin = this._origin.selected;
		const savedChoices = this._background.choices;

		const data = new CharacterSheetData();
		data.hasPlaybook = true;
		data.backgrounds = (playbookData.backgrounds ?? []).map(b => {
			const result = { ...b, selected: b.slug === savedBg };
			if (b.choices) {
				result.choices = {
					label: b.choices.label,
					countLabel: b.choices.count.join(" or "),
					options: b.choices.options.map(o => ({
						...o,
						checked: Boolean(savedChoices[o.slug]),
					})),
				};
			}
			return result;
		});
		data.instincts = (playbookData.instincts ?? []).map(({ word, description }) => ({
			word,
			description,
			value: `${word} — ${description}`,
			selected: `${word} — ${description}` === savedInstinct,
		}));
		data.savedInstinct = savedInstinct;
		data.appearance = (playbookData.appearance ?? []).map((opts, i) => ({
			lineIdx: i,
			options: opts.map(v => ({ value: v, selected: savedAppearance[i] === v })),
		}));
		data.origins = (playbookData.origin ?? []).map(({ region, names }) => ({
			region,
			names,
			selected: region === savedOrigin,
		}));
		data.savedOrigin = savedOrigin;
		data.movelist = await this.getMoves();
		const background = (playbookData.backgrounds ?? []).find(b => b.slug === this._background.selectedSlug);
		const extraPreselected = background?.extraPossessions ?? [];
		data.possessions = this.buildPossessionsContext(
			playbookData.specialPossessions,
			this._possessions.selected,
			this._possessions.uses,
			this._possessions.maxUses,
			extraPreselected,
			this._possessions.subChoices,
			this._possessions.choiceUses,
		);
		return data;
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
				const maxUses = maxUsesMap[opt.slug] ?? opt.uses ?? null;
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
					usesLabel: opt.usesLabel ?? null,
					usesChecks: isSelected && maxUses
						? Array.from({ length: maxUses }, (_, i) => ({ checked: i < (usesMap[opt.slug] ?? 0) }))
						: null,
					choices: isSelected && opt.choices ? {
						pickCount: opt.choices.pickCount,
						options: opt.choices.options.map(c => {
							const picked = pickedSubs.includes(c.slug);
							const cMaxUses = c.uses ?? null;
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
				if (!move.resourceMax) continue;
				const current = moveResourcesMap[move.name] ?? 0;
				move.resourceChecks = Array.from({ length: move.resourceMax }, (_, i) => ({
					checked: i < current,
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
				rollType: e.system?.stat ?? null,
				owned: instances.length > 0,
			};
		});

		const otherGroups = OTHER_MOVE_TYPES.reduce((acc, t) => {
			const items = this._actor.items.filter(i => i.type === "move" && i.system?.moveType === t);
			if (items.length) acc.push({
				key: t,
				label: t.charAt(0).toUpperCase() + t.slice(1) + " Moves",
				moves: items.map(i => ({ name: i.name, ownedId: i._id, rollType: i.system?.stat ?? null })),
			});
			return acc;
		}, []);

		return { playbookMoves, basicMoves, otherGroups, startingMovesNote: playbookData?.startingMovesNote ?? null };
	}

	buildMovelistContext(entries, ownedAllByName, bgMoveNames, actorLevel, actorPlaybook) {
		return entries.map(e => {
			const ownedInstances = ownedAllByName.get(e.name) ?? [];
			const isFromPlaybook = !!e.system?.isStartingMove;
			const isFromBackground = bgMoveNames.has(e.name);
			const isStarting = isFromPlaybook || isFromBackground;
			const source = isFromPlaybook ? "Starting" : isFromBackground ? "Background" : null;
			const req = e.system?.requirement ?? null;
			const requiresMoves = req?.moves ?? [];
			const requiresPlaybook = req?.playbook ?? null;
			const minLevel = req?.level ?? null;
			const repeatMax = e.system?.repeatMax ?? 1;
			const repeatable = repeatMax > 1;
			const locked = !isStarting && !!(
				requiresMoves.some(m => !ownedAllByName.has(m)) ||
				(requiresPlaybook && requiresPlaybook !== actorPlaybook) ||
				(minLevel && actorLevel < minLevel)
			);
			const lastOwnedId = ownedInstances[ownedInstances.length - 1]?._id ?? null;
			return {
				name: e.name,
				description: e.system?.description ?? "",
				compendiumId: e._id,
				owned: ownedInstances.length > 0,
				ownedId: lastOwnedId,
				rollType: e.system?.stat ?? null,
				isStarting,
				source,
				locked,
				requires: requiresMoves[0] ?? null,
				requiresLabel: requiresMoves.length > 0 ? requiresMoves.join(", ") : null,
				requiresPlaybook,
				minLevel,
				repeatable,
				repeatChecks: repeatable ? Array.from({ length: repeatMax }, (_, i) => ({
					checked: i < ownedInstances.length,
					ownedId: i < ownedInstances.length ? lastOwnedId : null,
					disabled: isStarting || locked || (!(i < ownedInstances.length) && i !== ownedInstances.length),
				})) : null,
				resourceMax: e.system?.resourceMax ?? null,
			};
		});
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
		if (!missing.length) return;
		const docs = await Promise.all(missing.map(e => this._playbookMoveRepo.getDocument(e._id)));
		await this._actor.createEmbeddedDocuments("Item", docs.filter(Boolean).map(d => d.toObject()));
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
		if (!hp || !damage) return;
		await this._actor.update({
			"system.attributes.hp.max": hp,
			"system.attributes.hp.value": hp,
			"system.attributes.damage.value": damage,
		});
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
