import {
	PossessionItemSnapshotBuilder,
	PossessionsSnapshot,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { ResourceController } from "./ResourceController.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { EmbeddedOutfitItemBuilder } from "../../model/data/character/EmbeddedOutfitItem.js";

export class CharacterPossessions {
	constructor(actor, moves, outfitItems = null, playbook = null, possessionRepo = null) {
		this._actor          = actor;
		this._moves          = moves;
		this._outfitItems    = outfitItems;
		this._playbook       = playbook;
		this._possessionRepo = possessionRepo;
	}

	get selected()      { return new Set(this._actor.system?.possessions?.selected   ?? []); }
	get uses()          { return this._actor.system?.possessions?.uses               ?? {}; }
	get maxUses()       { return this._actor.system?.possessions?.maxUses            ?? {}; }
	get _pickValues()   { return new ChoiceValues(this._actor.system?.possessions?.pickValues ?? {}); }
	get choiceUses()    { return this._actor.system?.possessions?.choiceUses         ?? {}; }

	async select(slug) {
		const s = this.selected;
		s.add(slug);
		await this._actor.update({ "system.possessions.selected": [...s] });
		await this.syncPossessionItems(slug);
	}

	async deselect(slug) {
		const s = this.selected;
		s.delete(slug);
		await this._actor.update({ "system.possessions.selected": [...s] });
		await this._outfitItems?.deleteBySource("possession:" + slug);
	}

	async setUses(slug, count) {
		await this._actor.update({ "system.possessions.uses": { ...this.uses, [slug]: count } });
	}

	async addSubChoice(possessionSlug, choiceSlug) {
		await this._actor.update({ "system.possessions.pickValues": this._pickValues.set(possessionSlug, choiceSlug, 1).toRaw() });
		await this.syncPossessionItems(possessionSlug);
	}

	async removeSubChoice(possessionSlug, choiceSlug) {
		await this._actor.update({ "system.possessions.pickValues": this._pickValues.set(possessionSlug, choiceSlug, 0).toRaw() });
		await this.syncPossessionItems(possessionSlug);
	}

	async selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs) {
		let cv = this._pickValues;
		for (const s of exclusiveSlugs) cv = cv.set(possessionSlug, s, 0);
		await this._actor.update({ "system.possessions.pickValues": cv.set(possessionSlug, choiceSlug, 1).toRaw() });
		await this.syncPossessionItems(possessionSlug);
	}

	async setChoiceUses(possessionSlug, choiceSlug, count) {
		const key = `${possessionSlug}:${choiceSlug}`;
		await this._actor.update({ "system.possessions.choiceUses": { ...this.choiceUses, [key]: count } });
	}

	async syncPossessionItems(slug) {
		if (!this._outfitItems || !this._possessionRepo) return;
		const possession = await this._possessionRepo.findBySlug(slug);
		if (!possession) return;
		const cv = this._pickValues;
		const source = "possession:" + slug;
		const items = [];
		for (const item of possession.outfitItems ?? []) {
			items.push(_buildEmbeddedItem(item, source));
		}
		for (const row of (possession.choices?.list ?? [])) {
			if (row.type !== "pick") continue;
			for (const choice of row.options ?? []) {
				if (cv.getCount(slug, choice.slug) === 0) continue;
				for (const item of choice.outfitItems ?? []) {
					items.push(_buildEmbeddedItem(item, source));
				}
			}
		}
		await this._outfitItems.sync(source, items);
	}

	computeMaxUses(possessions, level) {
		const result = { ...this.maxUses };
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
		const playbookData = await this._playbook?.getData();
		const sp = playbookData?.specialPossessions ?? null;
		if (!sp) return null;
		const { pickNote, pickCount, preselected = [], slugs = [] } = sp;
		const possessions = await this._possessionRepo?.findBySlugs(slugs) ?? [];
		const maxUsesMap = this.computeMaxUses(possessions, actorLevel);
		const selectedSlugs = this.selected;
		const usesMap = this.uses;
		const preselectedSet = new Set(preselected);

		const items = possessions.map(p => {
			const isPre = preselectedSet.has(p.slug);
			const isSelected = isPre || selectedSlugs.has(p.slug);
			const maxUses = maxUsesMap[p.slug] ?? p.resource?.max ?? null;
			const currentUses = isSelected ? (usesMap[p.slug] ?? 0) : 0;
			const resourceDef = p.resource ?? null;
			const resource = resourceDef
				? ResourceController.build({ ...resourceDef, max: maxUses ?? resourceDef.max }, currentUses)
				: null;
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
				.withChoices(isSelected && p.choices ? ChoiceGroup.fromPackData(p.choices, this._pickValues) : null)
				.build();
		});

		return new PossessionsSnapshot(pickCount, pickNote, items);
	}
}

// ── Private helpers ───────────────────────────────────────────────────────────

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
