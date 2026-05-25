import {
	PossessionItemSnapshotBuilder,
	PossessionsSnapshot,
	ResourceBuilder,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { EmbeddedOutfitItemBuilder } from "../../model/data/character/EmbeddedOutfitItem.js";

export class CharacterPossessions {
	constructor(flags, moves, outfitItems = null, playbook = null) {
		this._flags = flags;
		this._moves = moves;
		this._outfitItems = outfitItems;
		this._playbook = playbook;
	}

	get selected()      { return new Set(this._flags.getFlag("selected") ?? []); }
	get uses()          { return this._flags.getFlag("uses") ?? {}; }
	get maxUses()       { return this._flags.getFlag("maxUses") ?? {}; }
	get _pickValues()   { return new ChoiceValues(this._flags.getFlag("pickValues") ?? {}); }
	get choiceUses()    { return this._flags.getFlag("choiceUses") ?? {}; }

	async select(slug, specialPossessions = null) {
		const s = this.selected;
		s.add(slug);
		await this._flags.setFlag("selected", [...s]);
		await this.syncPossessionItems(slug, specialPossessions);
	}

	async deselect(slug) {
		const s = this.selected;
		s.delete(slug);
		await this._flags.setFlag("selected", [...s]);
		await this._outfitItems?.deleteBySource("possession:" + slug);
	}

	async setUses(slug, count) {
		await this._flags.setFlag("uses", { ...this.uses, [slug]: count });
	}

	async addSubChoice(possessionSlug, choiceSlug, specialPossessions = null) {
		await this._flags.setFlag("pickValues", this._pickValues.set(possessionSlug, choiceSlug, 1).toRaw());
		await this.syncPossessionItems(possessionSlug, specialPossessions);
	}

	async removeSubChoice(possessionSlug, choiceSlug, specialPossessions = null) {
		await this._flags.setFlag("pickValues", this._pickValues.set(possessionSlug, choiceSlug, 0).toRaw());
		await this.syncPossessionItems(possessionSlug, specialPossessions);
	}

	async selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs, specialPossessions = null) {
		let cv = this._pickValues;
		for (const s of exclusiveSlugs) cv = cv.set(possessionSlug, s, 0);
		await this._flags.setFlag("pickValues", cv.set(possessionSlug, choiceSlug, 1).toRaw());
		await this.syncPossessionItems(possessionSlug, specialPossessions);
	}

	async setChoiceUses(possessionSlug, choiceSlug, count) {
		const key = `${possessionSlug}:${choiceSlug}`;
		await this._flags.setFlag("choiceUses", { ...this.choiceUses, [key]: count });
	}

	async syncPossessionItems(possessionSlug, specialPossessions) {
		if (!specialPossessions || !this._outfitItems) return;
		const opt = specialPossessions.options?.find(o => o.slug === possessionSlug);
		if (!opt) return;
		const cv = this._pickValues;
		const source = "possession:" + possessionSlug;
		const items = [];
		for (const item of opt.outfitItems ?? []) {
			items.push(_buildEmbeddedItem(item, source));
		}
		for (const row of (opt.choices?.list ?? [])) {
			if (row.type !== "pick") continue;
			for (const choice of row.options ?? []) {
				if (cv.getCount(possessionSlug, choice.slug) === 0) continue;
				for (const item of choice.outfitItems ?? []) {
					items.push(_buildEmbeddedItem(item, source));
				}
			}
		}
		await this._outfitItems.sync(source, items);
	}

	computeMaxUses(specialPossessions, level) {
		const result = { ...this.maxUses };
		for (const opt of (specialPossessions?.options ?? [])) {
			if (!opt.usesBonus) continue;
			let bonus = 0;
			if (opt.usesBonus.evenLevelBonus) {
				bonus += Math.floor(level / 2) * opt.usesBonus.evenLevelBonus;
			}
			for (const mb of (opt.usesBonus.moveBonus ?? [])) {
				bonus += this._moves.countOwnedByName(mb.moveName) * mb.perInstance;
			}
			if (bonus > 0) result[opt.slug] = (opt.resource?.max ?? 0) + bonus;
		}
		return result;
	}

	async buildSnapshot(actorLevel) {
		const playbookData = await this._playbook?.getData();
		const specialPossessions = playbookData?.specialPossessions ?? null;
		if (!specialPossessions) return null;
		const { pickNote, pickCount, preselected = [], options } = specialPossessions;
		const maxUsesMap = this.computeMaxUses(specialPossessions, actorLevel);
		const selectedSlugs = this.selected;
		const usesMap = this.uses;
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
				.withChoices(isSelected && opt.choices ? ChoiceGroup.fromPackData(opt.choices, this._pickValues) : null)
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
		.withBreakBefore(data.breakBefore ?? false)
		.withSource(source)
		.build();
}
