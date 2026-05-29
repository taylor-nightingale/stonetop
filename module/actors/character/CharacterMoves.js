import {
	MoveCategorySnapshotBuilder,
	MoveSnapshotBuilder,
	MovelistBuilder,
	RequirementSnapshot,
	ResourceBuilder,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import {ValueMax} from "../../model/snapshot/character/VitalsSnapshot.js";

export class CharacterMoves {
	constructor(moveRepo, flags, actor) {
		this._moveRepo = moveRepo;
		this._flags = flags;
		this._actor = actor;
	}

	_getCategories() {
		return this._flags?.getFlag("categories") ?? [];
	}

	async _setCategories(cats) {
		await this._flags?.setFlag("categories", cats);
	}

	_findCategory(key) {
		return this._getCategories().find(c => c.key === key) ?? null;
	}

	async _updateCategory(key, fn) {
		await this._setCategories(this._getCategories().map(c => c.key === key ? fn(c) : c));
	}

	async initBasicMoves() {
		if (this._findCategory("basic")) return;
		const entries = await this._moveRepo.getBasicMoves();
		const flagMoves = entries.map(m => _toFlagMove(m, true));
		const docs = await Promise.all(entries.map(m => this._moveRepo.getBasicMoveDocument(m.id)));
		const created = await this._actor.createEmbeddedDocuments("Item",
			docs.filter(Boolean).map(d => _withMoveType(d.toObject(), "basic"))
		);
		_assignOwnedIds(flagMoves, created);
		await this._setCategories([
			...this._getCategories(),
			{
				key: "basic",
				label: "Basic Moves",
				renderStyle: "side-bar",
				allowAdditional: false,
				note: null,
				moves: flagMoves
			},
		]);
	}

	async initPlaybookCategory(playbookData) {
		const existing = this._getCategories().find(c => c.key.startsWith("playbook-"));
		if (existing) await this.removeCategory(existing.key);
		const entries = await this._moveRepo.getPlaybookMoves(playbookData.name);
		const sorted = this.sortPlaybookMoves(entries);
		const catKey = `playbook-${playbookData.slug}`;
		const flagMoves = sorted.map(m => _toFlagMove(m, m.isStarting));
		const startingEntries = sorted.filter(m => m.isStarting);
		let created = [];
		if (startingEntries.length) {
			const docs = await Promise.all(startingEntries.map(e => this._moveRepo.getPlaybookMoveDocument(e.id)));
			created = await this._actor.createEmbeddedDocuments("Item",
				docs.filter(Boolean).map(d => _withMoveType(d.toObject(), catKey))
			);
		}
		_assignOwnedIds(flagMoves, created);
		const filtered = this._getCategories().filter(c => !c.key.startsWith("playbook-"));
		await this._setCategories([
			{
				key: catKey,
				label: playbookData.name,
				renderStyle: "standard",
				allowAdditional: false,
				note: playbookData.startingMovesNote ?? null,
				moves: flagMoves
			},
			...filtered,
		]);
	}

	async addCategory(key, label, slug) {
		if (this._findCategory(key)) return;
		const entries = await this._moveRepo.getPostDeathMoves(slug);
		const flagMoves = entries.map(m => _toFlagMove(m, true));
		const created = await this._addCategoryMoves(key, entries);
		_assignOwnedIds(flagMoves, created);
		await this._setCategories([
			...this._getCategories(),
			{key, label, renderStyle: "standard", allowAdditional: false, note: null, moves: flagMoves},
		]);
	}

	async removeCategory(key) {
		const cat = this._findCategory(key);
		if (!cat) return;
		const ids = cat.moves.flatMap(m => m.ownedIds ?? []);
		if (ids.length) await this._actor.deleteEmbeddedDocuments("Item", ids);
		await this._setCategories(this._getCategories().filter(c => c.key !== key));
	}

	async incrementMove(categoryKey, moveName) {
		const cat = this._findCategory(categoryKey);
		const move = cat?.moves.find(m => m.name === moveName);
		if (!move || move.selection.value >= move.selection.max) return;
		const created = await this._actor.createEmbeddedDocuments("Item", [{
			name: moveName, type: "move",
			system: {moveType: categoryKey, rollType: move.rollType ?? "", description: move.description ?? ""},
		}]);
		const newId = created[0]?._id ?? null;
		await this._updateCategory(categoryKey, c => ({
			...c,
			moves: c.moves.map(m => m.name !== moveName ? m : {
				...m,
				selection: {...m.selection, value: m.selection.value + 1},
				ownedIds: newId ? [...(m.ownedIds ?? []), newId] : (m.ownedIds ?? []),
			}),
		}));
	}

	async decrementMove(categoryKey, moveName) {
		const cat = this._findCategory(categoryKey);
		const move = cat?.moves.find(m => m.name === moveName);
		if (!move || move.selection.value === 0) return;
		if (move.isStarting && move.selection.value <= 1) return;
		const ownedIds = move.ownedIds ?? [];
		const idToRemove = ownedIds.at(-1) ?? null;
		if (idToRemove) await this._actor.deleteEmbeddedDocuments("Item", [idToRemove]);
		await this._updateCategory(categoryKey, c => ({
			...c,
			moves: c.moves.map(m => m.name !== moveName ? m : {
				...m,
				selection: {...m.selection, value: m.selection.value - 1},
				ownedIds: ownedIds.slice(0, -1),
			}),
		}));
	}

	async addMoveToOther(moveData) {
		let cats = this._getCategories();
		let otherCat = cats.find(c => c.key === "other");
		if (!otherCat) {
			otherCat = {
				key: "other",
				label: "Other Moves",
				renderStyle: "standard",
				allowAdditional: true,
				note: null,
				moves: []
			};
			cats = [...cats, otherCat];
		}
		if (otherCat.moves.some(m => m.name === moveData.name)) return false;
		const created = await this._actor.createEmbeddedDocuments("Item", [{
			name: moveData.name, type: "move",
			system: {
				moveType: "other",
				rollType: moveData.system?.rollType ?? "",
				description: moveData.system?.description ?? ""
			},
		}]);
		const newId = created[0]?._id ?? null;
		const flagMove = {
			name: moveData.name, compendiumId: null,
			rollType: moveData.system?.rollType ?? null,
			description: moveData.system?.description ?? "",
			isStarting: false, requirement: null,
			selection: {max: 1, value: 1},
			ownedIds: newId ? [newId] : [],
			resource: null,
		};
		await this._setCategories(cats.map(c => c.key !== "other" ? c : {...c, moves: [...c.moves, flagMove]}));
		return true;
	}

	async deleteMove(moveName) {
		const cat = this._findCategory("other");
		const move = cat?.moves.find(m => m.name === moveName);
		if (!move) return;
		const ids = move.ownedIds ?? [];
		if (ids.length) await this._actor.deleteEmbeddedDocuments("Item", ids);
		await this._updateCategory("other", c => ({...c, moves: c.moves.filter(m => m.name !== moveName)}));
	}

	async setMoveResourceCurrent(categoryKey, moveName, current) {
		await this._updateCategory(categoryKey, c => ({
			...c,
			moves: c.moves.map(m => !m.resource || m.name !== moveName ? m : {...m, resource: {...m.resource, current}}),
		}));
	}

	buildSnapshot() {
		const cats = this._getCategories();
		const level = this._actor.system?.attributes?.level?.value ?? 1;
		const acquiredByName = _acquiredNames(cats);
		const categories = cats.map(cat => new MoveCategorySnapshotBuilder()
			.withKey(cat.key).withLabel(cat.label).withRenderStyle(cat.renderStyle)
			.withAllowAdditional(cat.allowAdditional).withNote(cat.note ?? null)
			.withMoves(cat.moves.map(m => _buildMoveSnapshot(m, cat.key, _computeSelectable(m), _requirementsMet(m, level, acquiredByName))))
			.build()
		);
		return new MovelistBuilder().withCategories(categories).build();
	}

	countOwnedByName(moveName) {
		const move = this._getCategories().flatMap(c => c.moves).find(m => m.name === moveName);
		return move?.selection.value ?? 0;
	}

	getMoveSnapshotsForCategory(key) {
		const cat = this._findCategory(key);
		if (!cat) return [];
		const level = this._actor.system?.attributes?.level?.value ?? 1;
		const acquiredByName = _acquiredNames(this._getCategories());
		return cat.moves.map(m => _buildMoveSnapshot(m, key, _computeSelectable(m), _requirementsMet(m, level, acquiredByName)));
	}

	async onDropMove(itemData) {
		for (const cat of this._getCategories()) {
			const existing = cat.moves.find(m => m.name === itemData.name);
			if (existing) {
				if (existing.selection.value < existing.selection.max) {
					await this.incrementMove(cat.key, itemData.name);
					return true;
				}
				return false;
			}
		}
		return this.addMoveToOther(itemData);
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

	async _addCategoryMoves(moveType, entries) {
		if (!entries.length) return [];
		return this._actor.createEmbeddedDocuments("Item", entries.map(m => ({
			name: m.name, type: "move",
			system: {moveType, rollType: m.rollType ?? "", description: m.description ?? ""},
		})));
	}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _toFlagMove(move, selected) {
	return {
		name: move.name, compendiumId: move.id ?? null,
		rollType: move.rollType ?? null, description: move.description ?? "",
		isStarting: selected,
		requirement: move.requirement ? {
			moves: move.requirement.moves ?? [],
			level: move.requirement.level ?? null,
			playbook: move.requirement.playbook ?? null,
		} : null,
		selection: {max: move.repeatMax ?? 1, value: selected ? 1 : 0},
		ownedIds: [],
		resource: move.resource ? {
			max: move.resource.max,
			title: move.resource.title ?? null,
			labels: move.resource.labels ?? [],
			current: 0,
		} : null,
	};
}

function _withMoveType(obj, moveType) {
	return {...obj, system: {...obj.system, moveType}};
}

function _assignOwnedIds(flagMoves, createdDocs) {
	const idsByName = new Map();
	for (const doc of (createdDocs ?? [])) {
		if (!idsByName.has(doc.name)) idsByName.set(doc.name, []);
		idsByName.get(doc.name).push(doc._id);
	}
	for (const m of flagMoves) {
		const ids = idsByName.get(m.name);
		if (ids?.length) m.ownedIds = ids;
	}
}

function _acquiredNames(cats) {
	return new Set(cats.flatMap(c => c.moves).filter(m => m.selection.value > 0).map(m => m.name));
}

function _computeSelectable(move) {
	return move.selection.value < move.selection.max;
}

function _requirementsMet(move, level, acquiredByName) {
	const req = move.requirement;
	if (!req) return true;
	if (req.level && level < req.level) return false;
	if ((req.moves ?? []).some(name => !acquiredByName.has(name))) return false;
	return true;
}

function _buildMoveSnapshot(move, categoryKey, selectable, requirementsMet) {
	const resource = move.resource
		? new ResourceBuilder()
			.withCurrent(move.resource.current).withMax(move.resource.max)
			.withTitle(move.resource.title ?? null).withLabels(move.resource.labels ?? [])
			.build()
		: null;
	const req = move.requirement;
	const reqParts = [...(req?.moves ?? []), req?.level ? `Level ${req.level}` : ""].filter(Boolean);
	const requirement = reqParts.length
		? new RequirementSnapshot(reqParts.join(", "), requirementsMet)
		: null;
	return new MoveSnapshotBuilder()
		.withId(move.compendiumId ?? null)
		.withOwnedId((move.ownedIds ?? []).at(-1) ?? null)
		.withName(move.name)
		.withDescription(move.description ?? "")
		.withRollType(move.rollType ?? null)
		.withIsStarting(move.isStarting)
		.withSource({type: categoryKey})
		.withSourceLabel(null)
		.withSelection(new ValueMax(move.selection.value, move.selection.max))
		.withSelectable(selectable)
		.withRequirement(requirement)
		.withRequiresLabel(requirement?.label ?? null)
		.withResource(resource)
		.build();
}

function _sortGroup(moves, groupNames) {
	const dependents = new Map();
	const roots = [];
	for (const move of moves) {
		if (!move.requires || !groupNames.has(move.requires)) roots.push(move);
		else {
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
