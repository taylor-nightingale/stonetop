import {
	MoveCategorySnapshotBuilder,
	MoveSnapshotBuilder,
	MovelistBuilder,
	RequirementSnapshot,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { ResourceController } from "./ResourceController.js";
import { ValueMax } from "../../model/snapshot/character/VitalsSnapshot.js";
import { toSlug } from "../../utils/slug.js";
import {StonetopFlags} from "./StonetopFlags.js";

export class CharacterMoves {
	constructor(moveRepo, actor, choiceController, resourceController) {
		this._moveRepo          = moveRepo;
		this._flags             = new StonetopFlags(actor, "moves");
		this._actor             = actor;
		this._choiceController  = choiceController;
		this._resourceController = resourceController;
	}

	setVitals(vitals) { this._vitals = vitals; }

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
		const entries   = await this._moveRepo.getBasicMoves();
		const flagMoves = entries.map(m => _toFlagMove(m, true));
		const docs      = await Promise.all(entries.map(m => this._moveRepo.getBasicMoveDocument(m.id)));
		const created   = await this._actor.createEmbeddedDocuments("Item",
			docs.filter(Boolean).map(d => _withMoveType(d.toObject(), "basic"))
		);
		_assignOwnedIds(flagMoves, created);
		await this._setCategories([
			...this._getCategories(),
			{ key: "basic", label: "Basic Moves", renderStyle: "side-bar", allowAdditional: false, note: null, moves: flagMoves },
		]);
	}

	async initPlaybookCategory(playbookData) {
		const existing = this._getCategories().find(c => c.key.startsWith("playbook-"));
		if (existing) await this.removeCategory(existing.key);
		const playbookMoves  = await this._moveRepo.getPlaybookMoves(playbookData.name);
		const catKey   = `playbook-${playbookData.slug}`;
		const flagMoves = playbookMoves.map(m => _toFlagMove(m, m.isStarting));
		const startingEntries = playbookMoves.filter(m => m.isStarting);
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
			{ key: catKey, label: playbookData.name, renderStyle: "standard", allowAdditional: false, note: playbookData.startingMovesNote ?? null, moves: flagMoves },
			...filtered,
		]);
	}

	async addCategory(key, label, slug) {
		if (this._findCategory(key)) return;
		const entries   = await this._moveRepo.getPostDeathMoves(slug);
		const flagMoves = entries.map(m => _toFlagMove(m, true));
		const created   = await this._addCategoryMoves(key, entries);
		_assignOwnedIds(flagMoves, created);
		await this._setCategories([
			...this._getCategories(),
			{ key, label, renderStyle: "standard", allowAdditional: false, note: null, moves: flagMoves },
		]);
	}

	async removeCategory(key) {
		const cat = this._findCategory(key);
		if (!cat) return;
		const ids = cat.moves.flatMap(m => m.ownedIds ?? []);
		if (ids.length) await this._actor.deleteEmbeddedDocuments("Item", ids);
		await this._setCategories(this._getCategories().filter(c => c.key !== key));
	}

	async incrementMove(categoryKey, moveSlug) {
		const cat  = this._findCategory(categoryKey);
		const move = cat?.moves.find(m => m.slug === moveSlug);
		if (!move || move.selection.value >= move.selection.max) return;
		const repoBySlug = await this._moveRepo.buildSlugIndex();
		const repoMove   = repoBySlug.get(moveSlug);
		const created = await this._actor.createEmbeddedDocuments("Item", [{
			name:   repoMove?.name   ?? moveSlug,
			type:   "move",
			system: { moveType: categoryKey, rollStat: repoMove?.rollStat ?? "", description: repoMove?.description ?? "", moveResults: repoMove?.moveResults ?? null },
		}]);
		const newId = created[0]?._id ?? null;
		await this._updateCategory(categoryKey, c => ({
			...c,
			moves: c.moves.map(m => m.slug !== moveSlug ? m : {
				...m,
				selection: { ...m.selection, value: m.selection.value + 1 },
				ownedIds:  newId ? [...(m.ownedIds ?? []), newId] : (m.ownedIds ?? []),
			}),
		}));
	}

	async decrementMove(categoryKey, moveSlug) {
		const cat  = this._findCategory(categoryKey);
		const move = cat?.moves.find(m => m.slug === moveSlug);
		if (!move || move.selection.value === 0) return;
		if (move.isStarting && move.selection.value <= 1) return;
		const ownedIds  = move.ownedIds ?? [];
		const idToRemove = ownedIds.at(-1) ?? null;
		if (idToRemove) await this._actor.deleteEmbeddedDocuments("Item", [idToRemove]);
		await this._updateCategory(categoryKey, c => ({
			...c,
			moves: c.moves.map(m => m.slug !== moveSlug ? m : {
				...m,
				selection: { ...m.selection, value: m.selection.value - 1 },
				ownedIds:  ownedIds.slice(0, -1),
			}),
		}));
	}

	async addMoveToOther(moveData) {
		let cats    = this._getCategories();
		let otherCat = cats.find(c => c.key === "other");
		const moveSlug = toSlug(moveData.name);
		if (!otherCat) {
			otherCat = { key: "other", label: "Other Moves", renderStyle: "standard", allowAdditional: true, note: null, moves: [] };
			cats = [...cats, otherCat];
		}
		if (otherCat.moves.some(m => m.slug === moveSlug)) return false;
		const created = await this._actor.createEmbeddedDocuments("Item", [{
			name: moveData.name, type: "move",
			system: { moveType: "other", rollStat: moveData.system?.rollStat ?? "", description: moveData.system?.description ?? "", moveResults: moveData.system?.moveResults ?? null },
		}]);
		const newId   = created[0]?._id ?? null;
		const flagMove = {
			slug:        moveSlug,
			compendiumId: moveData._id ?? null,
			isStarting:  false,
			selection:   { max: 1, value: 1 },
			ownedIds:    newId ? [newId] : [],
		};
		await this._setCategories(cats.map(c => c.key !== "other" ? c : { ...c, moves: [...c.moves, flagMove] }));
		return true;
	}

	async deleteMove(moveSlug) {
		const cat  = this._findCategory("other");
		const move = cat?.moves.find(m => m.slug === moveSlug);
		if (!move) return;
		const ids = move.ownedIds ?? [];
		if (ids.length) await this._actor.deleteEmbeddedDocuments("Item", ids);
		await this._updateCategory("other", c => ({ ...c, moves: c.moves.filter(m => m.slug !== moveSlug) }));
	}

	async setMoveChoiceText(moveSlug, optionSlug, value) {
		await this._choiceController.setText(moveSlug, optionSlug, value);
	}

	async setMoveChoiceCount(moveSlug, optionSlug, count) {
		await this._choiceController.setCount(moveSlug, optionSlug, count);
	}

	async setMoveResourceCurrent(moveSlug, current) {
		await this._resourceController.set("moves", moveSlug, current);
	}

	async buildSnapshot() {
		const cats         = this._getCategories();
		const level        = this._vitals?.level ?? 1;
		const acquiredSlugs = _acquiredSlugs(cats);
		const repoBySlug   = await this._moveRepo.buildSlugIndex();
		const choiceController    = this._choiceController;
		const resourceController  = this._resourceController;
		const categories = await Promise.all(cats.map(async cat => {
			const moves = await Promise.all(cat.moves.map(flagMove => {
				const repoMove = repoBySlug.get(flagMove.slug) ?? null;
				return _buildMoveSnapshot(
					flagMove, repoMove, cat.key,
					_computeSelectable(flagMove),
					_requirementsMet(repoMove ?? flagMove, level, acquiredSlugs),
					choiceController, resourceController
				);
			}));
			return new MoveCategorySnapshotBuilder()
				.withKey(cat.key).withLabel(cat.label).withRenderStyle(cat.renderStyle)
				.withAllowAdditional(cat.allowAdditional).withNote(cat.note ?? null)
				.withMoves(moves).build();
		}));
		return new MovelistBuilder().withCategories(categories).build();
	}

	countOwnedBySlug(moveSlug) {
		const move = this._getCategories().flatMap(c => c.moves).find(m => m.slug === moveSlug);
		return move?.selection.value ?? 0;
	}

	async getMoveSnapshotsForCategory(key) {
		const cat = this._findCategory(key);
		if (!cat) return [];
		const level        = this._vitals?.level ?? 1;
		const acquiredSlugs = _acquiredSlugs(this._getCategories());
		const repoBySlug   = await this._moveRepo.buildSlugIndex();
		const choiceController   = this._choiceController;
		const resourceController = this._resourceController;
		return Promise.all(cat.moves.map(flagMove => {
			const repoMove = repoBySlug.get(flagMove.slug) ?? null;
			return _buildMoveSnapshot(
				flagMove, repoMove, key,
				_computeSelectable(flagMove),
				_requirementsMet(repoMove ?? flagMove, level, acquiredSlugs),
				choiceController, resourceController
			);
		}));
	}

	async onDropMove(itemData) {
		const itemSlug = toSlug(itemData.name);
		for (const cat of this._getCategories()) {
			const existing = cat.moves.find(m => m.slug === itemSlug);
			if (existing) {
				if (existing.selection.value < existing.selection.max) {
					await this.incrementMove(cat.key, existing.slug);
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
			system: { moveType, rollStat: m.rollStat ?? "", description: m.description ?? "", moveResults: m.moveResults ?? null },
		})));
	}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _toFlagMove(move, selected) {
	return {
		slug:        move.slug,
		compendiumId: move.id ?? null,
		isStarting:  selected,
		selection:   { max: move.repeatMax ?? 1, value: selected ? 1 : 0 },
		ownedIds:    [],
	};
}

function _withMoveType(obj, moveType) {
	return { ...obj, system: { ...obj.system, moveType } };
}

function _assignOwnedIds(flagMoves, createdDocs) {
	const idsBySlug = new Map();
	for (const doc of (createdDocs ?? [])) {
		const slug = toSlug(doc.name);
		if (!idsBySlug.has(slug)) idsBySlug.set(slug, []);
		idsBySlug.get(slug).push(doc._id);
	}
	for (const m of flagMoves) {
		const ids = idsBySlug.get(m.slug);
		if (ids?.length) m.ownedIds = ids;
	}
}

function _acquiredSlugs(cats) {
	return new Set(cats.flatMap(c => c.moves).filter(m => m.selection.value > 0).map(m => m.slug));
}

function _computeSelectable(flagMove) {
	return flagMove.selection.value < flagMove.selection.max;
}

function _requirementsMet(move, level, acquiredSlugs) {
	const req = move?.requirement;
	if (!req) return true;
	if (req.level && level < req.level) return false;
	if ((req.moves ?? []).some(name => !acquiredSlugs.has(toSlug(name)))) return false;
	return true;
}

async function _buildMoveSnapshot(flagMove, repoMove, categoryKey, selectable, requirementsMet, choiceController, resourceController) {
	const src    = repoMove ?? flagMove;
	const resDef = src?.resource ?? null;
	const resource = resourceController
		? resourceController.buildSnapshot("moves", resDef, flagMove.slug)
		: null;
	let choices = null;
	if (src?.choices && choiceController) {
		await choiceController.addGroup(flagMove.slug, src.choices);
		choices = choiceController.buildGroupSnapshot(flagMove.slug);
	}
	const req      = src?.requirement ?? null;
	const reqParts = [...(req?.moves ?? []), req?.level ? `Level ${req.level}` : ""].filter(Boolean);
	const requirement = reqParts.length
		? new RequirementSnapshot(reqParts.join(", "), requirementsMet)
		: null;
	return new MoveSnapshotBuilder()
		.withId(repoMove?.id ?? null)
		.withOwnedId((flagMove.ownedIds ?? []).at(-1) ?? null)
		.withSlug(flagMove.slug)
		.withName(src?.name)
		.withDescription(src?.description ?? "")
		.withRollStat(src?.rollStat ?? null)
		.withIsStarting(flagMove.isStarting)
		.withSource({ type: categoryKey })
		.withSourceLabel(null)
		.withSelection(new ValueMax(flagMove.selection.value, flagMove.selection.max))
		.withSelectable(selectable)
		.withRequirement(requirement)
		.withRequiresLabel(requirement?.label ?? null)
		.withResource(resource)
		.withChoices(choices)
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
	const result  = [];
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
