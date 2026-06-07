import {
	PossessionItemSnapshotBuilder,
	PossessionsSnapshot,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { ResourceController } from "./ResourceController.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { EmbeddedOutfitItemBuilder } from "../../model/data/character/EmbeddedOutfitItem.js";
import { Possession } from "../../model/data/character/Possession.js";

export class CharacterPossessions {
	constructor(actor, moves, outfitItems = null, possessionRepo = null) {
		this._actor          = actor;
		this._moves          = moves;
		this._outfitItems    = outfitItems;
		this._possessionRepo = possessionRepo;
	}

	get selected() {
		return new Set(
			[...this._actor.items]
				.filter(i => i.type === "possession" && i.system?.selected)
				.map(i => i.system?.slug)
				.filter(Boolean),
		);
	}

	async select(slug) {
		const item = _findPossessionItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { selected: true } }]);
		await this.syncPossessionItems(slug);
	}

	async deselect(slug) {
		const item = _findPossessionItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { selected: false } }]);
		await this._outfitItems?.deleteBySource("possession:" + slug);
	}

	async setUses(slug, count) {
		const item = _findPossessionItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { uses: count } }]);
	}

	async addSubChoice(possessionSlug, choiceSlug) {
		const item = _findPossessionItem(this._actor, possessionSlug);
		if (!item) return;
		const cv = new ChoiceValues(item.system?.pickValues ?? {});
		await this._actor.updateEmbeddedDocuments("Item", [{
			_id: item._id,
			system: { pickValues: cv.set(possessionSlug, choiceSlug, 1).toRaw() },
		}]);
		await this.syncPossessionItems(possessionSlug);
	}

	async removeSubChoice(possessionSlug, choiceSlug) {
		const item = _findPossessionItem(this._actor, possessionSlug);
		if (!item) return;
		const cv = new ChoiceValues(item.system?.pickValues ?? {});
		await this._actor.updateEmbeddedDocuments("Item", [{
			_id: item._id,
			system: { pickValues: cv.set(possessionSlug, choiceSlug, 0).toRaw() },
		}]);
		await this.syncPossessionItems(possessionSlug);
	}

	async selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs) {
		const item = _findPossessionItem(this._actor, possessionSlug);
		if (!item) return;
		let cv = new ChoiceValues(item.system?.pickValues ?? {});
		for (const s of exclusiveSlugs) cv = cv.set(possessionSlug, s, 0);
		cv = cv.set(possessionSlug, choiceSlug, 1);
		await this._actor.updateEmbeddedDocuments("Item", [{
			_id: item._id,
			system: { pickValues: cv.toRaw() },
		}]);
		await this.syncPossessionItems(possessionSlug);
	}

	async setChoiceUses(possessionSlug, choiceSlug, count) {
		const item = _findPossessionItem(this._actor, possessionSlug);
		if (!item) return;
		const current = item.system?.choiceUses ?? {};
		await this._actor.updateEmbeddedDocuments("Item", [{
			_id: item._id,
			system: { choiceUses: { ...current, [choiceSlug]: count } },
		}]);
	}

	async addPossessionsFromPlaybook(sp, playbookSlug) {
		if (!sp || !this._possessionRepo) return;
		const { preselected = [], slugs = [] } = sp;
		const preselectedSet = new Set(preselected);
		for (const slug of slugs) {
			if (_findPossessionItem(this._actor, slug)) continue;
			const possession = await this._possessionRepo.findBySlug(slug);
			if (!possession) continue;
			await this._actor.createEmbeddedDocuments("Item", [{
				name: possession.label, type: "possession",
				system: {
					slug:         possession.slug,
					label:        possession.label,
					description:  possession.description,
					resource:     possession.resource,
					outfitItems:  possession.outfitItems,
					choices:      possession.choices,
					scaling:      possession.scaling,
					sortOrder:    possession.sortOrder,
					selected:     preselectedSet.has(slug),
					preselected:  preselectedSet.has(slug),
					uses:         0,
					pickValues:   {},
					choiceUses:   {},
					playbookSlug,
				},
			}]);
			if (preselectedSet.has(slug)) await this.syncPossessionItems(slug);
		}
	}

	async removePossessionsFromPlaybook(playbookSlug) {
		if (!playbookSlug) return;
		const possessions = [...this._actor.items]
			.filter(i => i.type === "possession" && i.system?.playbookSlug === playbookSlug);
		for (const p of possessions) {
			await this._outfitItems?.deleteBySource("possession:" + p.system.slug);
		}
		const ids = possessions.map(i => i._id);
		if (ids.length) await this._actor.deleteEmbeddedDocuments("Item", ids);
	}

	async syncPossessionItems(slug) {
		if (!this._outfitItems) return;
		const item = _findPossessionItem(this._actor, slug);
		if (!item) return;
		const possession = new Possession(item.system);
		const cv = new ChoiceValues(item.system?.pickValues ?? {});
		const source = "possession:" + slug;
		const items = [];
		for (const oi of possession.outfitItems ?? []) {
			items.push(_buildEmbeddedItem(oi, source));
		}
		for (const row of (possession.choices?.list ?? [])) {
			if (row.type !== "pick") continue;
			for (const choice of row.options ?? []) {
				if (cv.getCount(slug, choice.slug) === 0) continue;
				for (const oi of choice.outfitItems ?? []) {
					items.push(_buildEmbeddedItem(oi, source));
				}
			}
		}
		await this._outfitItems.sync(source, items);
	}

	computeMaxUses(possessions, level) {
		const result = {};
		for (const p of possessions) {
			if (!p.scaling) continue;
			let bonus = 0;
			if (p.scaling.perEvenLevel) bonus += Math.floor(level / 2) * p.scaling.perEvenLevel;
			for (const mb of (p.scaling.perMove ?? [])) {
				bonus += this._moves.countOwnedBySlug(mb.moveSlug) * mb.amount;
			}
			if (bonus > 0) result[p.slug] = (p.resource?.max ?? 0) + bonus;
		}
		return result;
	}

	async buildSnapshot(actorLevel) {
		const playbookItem = [...this._actor.items].find(i => i.type === "playbook");
		const sp = playbookItem?.system?.specialPossessions ?? null;
		if (!sp) return null;
		const { pickNote, pickCount } = sp;

		const possessionItems = [...this._actor.items].filter(i => i.type === "possession");
		const playbookItems   = possessionItems.filter(i => i.system?.playbookSlug);
		const playbookSlugSet = new Set(playbookItems.map(i => i.system?.slug).filter(Boolean));
		const embeddedItems   = possessionItems.filter(
			i => !i.system?.playbookSlug && !playbookSlugSet.has(i.system?.slug),
		);

		const possessions = playbookItems.map(item => new Possession(item.system));
		const maxUsesMap  = this.computeMaxUses(possessions, actorLevel);

		const items = playbookItems.map(item => {
			const p          = new Possession(item.system);
			const isSelected = item.system?.selected ?? false;
			const isPre      = item.system?.preselected ?? false;
			const maxUses    = maxUsesMap[p.slug] ?? p.resource?.max ?? null;
			const currentUses = item.system?.uses ?? 0;
			const resourceDef = p.resource ?? null;
			const resource = resourceDef
				? ResourceController.build({ ...resourceDef, max: maxUses ?? resourceDef.max }, currentUses)
				: null;
			const pickValues = new ChoiceValues(item.system?.pickValues ?? {});
			return new PossessionItemSnapshotBuilder()
				.withSlug(p.slug)
				.withLabel(p.label)
				.withDescription(p.description ?? "")
				.withSelected(isSelected)
				.withChecked(isSelected)
				.withDisabled(isPre)
				.withPreselected(isPre)
				.withPreselectedSource(isPre ? "Starting" : null)
				.withResource(resource)
				.withUsesLabel(resourceDef?.title ?? null)
				.withChoices(isSelected && p.choices ? ChoiceGroup.fromPackData(p.choices, pickValues) : null)
				.build();
		});

		for (const item of embeddedItems) {
			const p = new Possession(item.system);
			const resourceDef = p.resource ?? null;
			const currentUses = item.system?.uses ?? 0;
			const resource = resourceDef
				? ResourceController.build({ ...resourceDef }, currentUses)
				: null;
			const pickValues = new ChoiceValues(item.system?.pickValues ?? {});
			items.push(new PossessionItemSnapshotBuilder()
				.withSlug(p.slug)
				.withLabel(p.label)
				.withDescription(p.description ?? "")
				.withSelected(true)
				.withChecked(true)
				.withDisabled(false)
				.withPreselected(false)
				.withPreselectedSource(null)
				.withResource(resource)
				.withUsesLabel(resourceDef?.title ?? null)
				.withChoices(p.choices ? ChoiceGroup.fromPackData(p.choices, pickValues) : null)
				.build());
		}

		return new PossessionsSnapshot(pickCount, pickNote, items);
	}
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _findPossessionItem(actor, slug) {
	return [...actor.items].find(i => i.type === "possession" && i.system?.slug === slug) ?? null;
}

function _buildEmbeddedItem(data, source) {
	return new EmbeddedOutfitItemBuilder()
		.withSlug(data.slug)
		.withName(data.name)
		.withWeight(data.weight ?? 1)
		.withNote(data.note ?? null)
		.withInventoryColumn(data.inventoryColumn ?? "regular")
		.withResource(data.resource ?? null)
		.withTwoCol(data.twoCol ?? false)
		.withSource(source)
		.build();
}
