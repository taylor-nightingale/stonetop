import {
	MoveCategorySnapshotBuilder,
	MoveSnapshotBuilder,
	MovelistBuilder,
	RequirementSnapshot,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { ResourceController } from "./ResourceController.js";
import { ValueMax } from "../../model/snapshot/character/VitalsSnapshot.js";
import { toSlug } from "../../utils/slug.js";

export class CharacterMoves {
	constructor(moveRepo, actor, resourceController, factory = null) {
		this._moveRepo           = moveRepo;
		this._actor              = actor;
		this._resourceController = resourceController;
		this._factory            = factory;
	}

	setVitals(vitals) { this._vitals = vitals; }

	async initBasicMoves() {
		const entries = await this._moveRepo.getBasicMoves();
		const existing = [...this._actor.items].filter(i => i.type === "move" && i.system?.categoryKey === "basic");
		const existingSlugs = new Set(existing.map(i => toSlug(i.name)));
		const newEntries = entries.filter(m => !existingSlugs.has(m.slug));
		if (!newEntries.length) return;
		const docs = await Promise.all(newEntries.map(m => this._moveRepo.getBasicMoveDocument(m.id)));
		await this._actor.createEmbeddedDocuments("Item",
			docs.filter(Boolean).map((d, i) =>
				_withCategoryFields(d.toObject(), "basic", true, { sortOrder: existing.length + i, compendiumId: d._id ?? null })
			)
		);
	}

	async initPlaybookCategory(playbookData) {
		const existingPlaybook = [...this._actor.items]
			.filter(i => i.type === "move" && i.system?.categoryKey?.startsWith("playbook-"));
		if (existingPlaybook.length) {
			await this._actor.deleteEmbeddedDocuments("Item", existingPlaybook.map(i => i._id));
		}
		const playbookMoves = await this._moveRepo.getPlaybookMoves(playbookData.name);
		const catKey = `playbook-${playbookData.slug}`;
		const pairs = await Promise.all(
			playbookMoves.map(async (m, i) => ({ move: m, doc: await this._moveRepo.getPlaybookMoveDocument(m.id), index: i }))
		);
		await this._actor.createEmbeddedDocuments("Item",
			pairs
				.filter(({ doc }) => doc !== null)
				.map(({ move, doc, index }) => _withCategoryFields(doc.toObject(), catKey, move.isStarting, {
					sortOrder:     index,
					compendiumId:  doc._id ?? null,
					categoryLabel: playbookData.name,
					categoryNote:  playbookData.startingMovesNote ?? null,
				}))
		);
	}

	async addCategory(key, label, slug) {
		const exists = [...this._actor.items].some(i => i.type === "move" && i.system?.categoryKey === key);
		if (exists) return;
		const entries = await this._moveRepo.getInsertMoves(slug);
		const docs = await Promise.all(entries.map(m => this._moveRepo.getInsertMoveDocument(m.id)));
		await this._actor.createEmbeddedDocuments("Item",
			docs.filter(Boolean).map((doc, i) =>
				_withCategoryFields(doc.toObject(), key, true, {
					sortOrder:     i,
					compendiumId:  doc._id ?? null,
					categoryLabel: label,
				})
			)
		);
	}

	async removeCategory(key) {
		const ids = [...this._actor.items]
			.filter(i => i.type === "move" && i.system?.categoryKey === key)
			.map(i => i._id);
		if (ids.length) await this._actor.deleteEmbeddedDocuments("Item", ids);
	}

	async incrementMove(categoryKey, moveSlug) {
		const item = _findMoveItem(this._actor, categoryKey, moveSlug);
		if (!item) return;
		const count = item.system?.instanceCount ?? 0;
		if (count >= (item.system?.repeatMax ?? 1)) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { acquired: true, instanceCount: count + 1 } }]);
	}

	async decrementMove(categoryKey, moveSlug) {
		const item = _findMoveItem(this._actor, categoryKey, moveSlug);
		if (!item) return;
		const count = item.system?.instanceCount ?? 0;
		if (count === 0) return;
		if ((item.system?.isStartingMove ?? false) && count <= 1) return;
		const newCount = count - 1;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { acquired: newCount > 0, instanceCount: newCount } }]);
	}

	async addMoveToOther(moveData) {
		const moveSlug = toSlug(moveData.name);
		const existing = [...this._actor.items].filter(i => i.type === "move" && i.system?.categoryKey === "other");
		if (existing.some(i => toSlug(i.name) === moveSlug)) return false;
		await this._actor.createEmbeddedDocuments("Item", [{
			...moveData,
			name: moveData.name,
			type: "move",
			system: {
				...moveData.system,
				moveType: "other", categoryKey: "other", categoryLabel: null, categoryNote: null,
				acquired: true, instanceCount: 1, isStartingMove: false,
				sortOrder: existing.length, compendiumId: moveData._id ?? null,
			},
		}]);
		return true;
	}

	async deleteMove(moveSlug) {
		const item = [...this._actor.items].find(
			i => i.type === "move" && i.system?.categoryKey === "other" && toSlug(i.name) === moveSlug
		);
		if (!item) return;
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	async setMoveChoiceText(moveSlug, optionSlug, value) {
		const item = _findMoveItemBySlug(this._actor, moveSlug);
		if (!item?.system?.choices) return;
		await this._factory.forItem(item._id, "pickValues")
			.setText(item.system.choices.slug, optionSlug, value);
	}

	async setMoveChoiceCount(moveSlug, optionSlug, count) {
		const item = _findMoveItemBySlug(this._actor, moveSlug);
		if (!item?.system?.choices) return;
		await this._factory.forItem(item._id, "pickValues")
			.setCount(item.system.choices.slug, optionSlug, count);
	}

	async setMoveResourceCurrent(moveSlug, current) {
		await this._resourceController.set("moves", moveSlug, current);
	}

	async buildSnapshot() {
		const allMoveItems = [...this._actor.items].filter(i => i.type === "move");
		const level              = this._vitals?.level ?? 1;
		const acquiredSlugs      = _acquiredSlugs(allMoveItems);
		const resourceController = this._resourceController;

		const byCatKey = new Map();
		for (const item of allMoveItems) {
			const key = item.system?.categoryKey ?? "other";
			if (!byCatKey.has(key)) byCatKey.set(key, []);
			byCatKey.get(key).push(item);
		}
		for (const items of byCatKey.values()) {
			items.sort((a, b) => (a.system?.sortOrder ?? 999) - (b.system?.sortOrder ?? 999));
		}

		const sortedKeys = [...byCatKey.keys()].sort((a, b) => _categoryOrder(a) - _categoryOrder(b));

		const categories = await Promise.all(sortedKeys.map(async catKey => {
			const meta  = _categoryMetadata(catKey, byCatKey.get(catKey));
			const moves = await Promise.all(byCatKey.get(catKey).map(item =>
				_buildMoveSnapshot(item, catKey,
					_computeSelectable(item),
					_requirementsMet(item.system ?? null, level, acquiredSlugs),
					resourceController)
			));
			return new MoveCategorySnapshotBuilder()
				.withKey(meta.key).withLabel(meta.label).withRenderStyle(meta.renderStyle)
				.withAllowAdditional(meta.allowAdditional).withNote(meta.note)
				.withMoves(moves).build();
		}));
		return new MovelistBuilder().withCategories(categories).build();
	}

	countOwnedBySlug(moveSlug) {
		const item = [...this._actor.items].find(
			i => i.type === "move" && toSlug(i.name) === moveSlug
		);
		return item?.system?.instanceCount ?? 0;
	}

	async getMoveSnapshotsForCategory(key) {
		const items = [...this._actor.items]
			.filter(i => i.type === "move" && i.system?.categoryKey === key)
			.sort((a, b) => (a.system?.sortOrder ?? 999) - (b.system?.sortOrder ?? 999));
		if (!items.length) return [];
		const level = this._vitals?.level ?? 1;
		const allMoveItems  = [...this._actor.items].filter(i => i.type === "move");
		const acquiredSlugs = _acquiredSlugs(allMoveItems);
		return Promise.all(items.map(item =>
			_buildMoveSnapshot(item, key,
				_computeSelectable(item),
				_requirementsMet(item.system ?? null, level, acquiredSlugs),
				this._resourceController)
		));
	}

	async onDropMove(itemData) {
		const itemSlug = toSlug(itemData.name);
		const existing = [...this._actor.items].find(
			i => i.type === "move" && toSlug(i.name) === itemSlug
		);
		if (existing) {
			if (_computeSelectable(existing)) {
				await this.incrementMove(existing.system?.categoryKey, itemSlug);
				return true;
			}
			return false;
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

}

// ── Private helpers ───────────────────────────────────────────────────────────

export function withCategoryFields(obj, categoryKey, acquired = true, opts = {}) {
	return _withCategoryFields(obj, categoryKey, acquired, opts);
}

function _withCategoryFields(obj, categoryKey, acquired = true, opts = {}) {
	const instanceCount = acquired ? 1 : 0;
	return {
		...obj,
		system: {
			...obj.system,
			moveType:      categoryKey,
			categoryKey,
			acquired,
			instanceCount,
			sortOrder:     opts.sortOrder     ?? null,
			compendiumId:  opts.compendiumId  ?? null,
			categoryLabel: opts.categoryLabel ?? null,
			categoryNote:  opts.categoryNote  ?? null,
		},
	};
}

function _findMoveItem(actor, categoryKey, moveSlug) {
	return [...actor.items].find(
		i => i.type === "move" && i.system?.categoryKey === categoryKey && toSlug(i.name) === moveSlug
	) ?? null;
}

function _acquiredSlugs(moveItems) {
	return new Set(
		moveItems
			.filter(i => i.system?.acquired ?? false)
			.map(i => i.system?.slug ?? toSlug(i.name))
	);
}

function _computeSelectable(item) {
	return (item?.system?.instanceCount ?? 0) < (item?.system?.repeatMax ?? 1);
}

function _categoryOrder(key) {
	if (key.startsWith("playbook-")) return 0;
	if (key === "basic")             return 1;
	if (key.startsWith("insert-")) return 2;
	if (key === "other")             return 3;
	return 4;
}

function _categoryMetadata(catKey, catItems) {
	if (catKey === "basic") return { key: "basic", label: "Basic Moves", renderStyle: "side-bar", allowAdditional: false, note: null };
	if (catKey === "other") return { key: "other", label: "Other Moves", renderStyle: "standard", allowAdditional: true,  note: null };
	const label = catItems[0]?.system?.categoryLabel ?? catKey;
	const note  = catItems[0]?.system?.categoryNote  ?? null;
	return { key: catKey, label, renderStyle: "standard", allowAdditional: false, note };
}

function _requirementsMet(move, level, acquiredSlugs) {
	const req = move?.requirement;
	if (!req) return true;
	if (req.level && level < req.level) return false;
	if ((req.moves ?? []).some(name => !acquiredSlugs.has(toSlug(name)))) return false;
	return true;
}

async function _buildMoveSnapshot(item, categoryKey, selectable, requirementsMet, resourceController) {
	const sys    = item?.system ?? null;
	const slug   = sys?.slug ?? toSlug(item?.name ?? "");
	const resDef = sys?.resource ?? null;
	const resource = resourceController
		? resourceController.buildSnapshot("moves", resDef, slug)
		: null;
	let choices = null;
	if (sys?.choices) {
		const values = new ChoiceValues(sys.pickValues ?? {});
		choices = ChoiceGroup.fromPackData(sys.choices, values);
	}
	const req      = sys?.requirement ?? null;
	const reqParts = [...(req?.moves ?? []), req?.level ? `Level ${req.level}` : ""].filter(Boolean);
	const requirement = reqParts.length
		? new RequirementSnapshot(reqParts.join(", "), requirementsMet)
		: null;
	return new MoveSnapshotBuilder()
		.withId(sys?.compendiumId ?? null)
		.withOwnedId(item?._id ?? null)
		.withSlug(slug)
		.withName(item?.name ?? slug)
		.withDescription(sys?.description ?? "")
		.withRollStat(sys?.rollStat ?? null)
		.withIsStarting(sys?.isStartingMove ?? false)
		.withSource({ type: categoryKey })
		.withSourceLabel(null)
		.withSelection(new ValueMax(sys?.instanceCount ?? 0, sys?.repeatMax ?? 1))
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

function _findMoveItemBySlug(actor, moveSlug) {
	return [...actor.items].find(
		i => i.type === "move" && (i.system?.slug ?? toSlug(i.name)) === moveSlug
	) ?? null;
}
