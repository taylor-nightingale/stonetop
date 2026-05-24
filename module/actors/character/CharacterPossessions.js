import {
	PossessionItemSnapshotBuilder,
	PossessionsSnapshot,
	ResourceBuilder,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { OutfitItemBuilder } from "../../model/data/character/OutfitItem.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";

export class CharacterPossessions {
	constructor(flags, moves) {
		this._flags = flags;
		this._moves = moves;
	}

	get selected()      { return new Set(this._flags.getFlag("selected") ?? []); }
	get uses()          { return this._flags.getFlag("uses") ?? {}; }
	get maxUses()       { return this._flags.getFlag("maxUses") ?? {}; }
	get _pickValues()   { return new ChoiceValues(this._flags.getFlag("pickValues") ?? {}); }
	get choiceUses()    { return this._flags.getFlag("choiceUses") ?? {}; }

	async select(slug) {
		const s = this.selected;
		s.add(slug);
		await this._flags.setFlag("selected", [...s]);
	}

	async deselect(slug) {
		const s = this.selected;
		s.delete(slug);
		await this._flags.setFlag("selected", [...s]);
	}

	async setUses(slug, count) {
		await this._flags.setFlag("uses", { ...this.uses, [slug]: count });
	}

	async addSubChoice(possessionSlug, choiceSlug) {
		await this._flags.setFlag("pickValues", this._pickValues.set(possessionSlug, choiceSlug, 1).toRaw());
	}

	async removeSubChoice(possessionSlug, choiceSlug) {
		await this._flags.setFlag("pickValues", this._pickValues.set(possessionSlug, choiceSlug, 0).toRaw());
	}

	async selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs) {
		let cv = this._pickValues;
		for (const s of exclusiveSlugs) cv = cv.set(possessionSlug, s, 0);
		await this._flags.setFlag("pickValues", cv.set(possessionSlug, choiceSlug, 1).toRaw());
	}

	async setChoiceUses(possessionSlug, choiceSlug, count) {
		const key = `${possessionSlug}:${choiceSlug}`;
		await this._flags.setFlag("choiceUses", { ...this.choiceUses, [key]: count });
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

	getOutfitItems(specialPossessions) {
		if (!specialPossessions) return [];
		const selectedSlugs = this.selected;
		const preselected   = new Set(specialPossessions.preselected ?? []);
		const cv            = this._pickValues;
		const items = [];
		for (const opt of specialPossessions.options ?? []) {
			if (!preselected.has(opt.slug) && !selectedSlugs.has(opt.slug)) continue;
			for (const item of opt.outfitItems ?? []) {
				items.push(_buildPossessionOutfitItem(item));
			}
			for (const row of (opt.choices?.list ?? [])) {
				if (row.type !== "pick") continue;
				for (const choice of row.options ?? []) {
					if (cv.getCount(opt.slug, choice.slug) === 0) continue;
					for (const item of choice.outfitItems ?? []) {
						items.push(_buildPossessionOutfitItem(item));
					}
				}
			}
		}
		return items;
	}

	buildSnapshot(specialPossessions, actorLevel) {
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

function _buildPossessionOutfitItem(data) {
	return new OutfitItemBuilder()
		.withSlug(data.slug)
		.withName(data.name)
		.withWeight(data.weight ?? 1)
		.withNote(data.note ?? null)
		.withInventoryColumn(data.inventoryColumn ?? "regular")
		.withResource(data.resource ?? null)
		.withTwoCol(data.twoCol ?? false)
		.withBreakBefore(data.breakBefore ?? false)
		.withOwnedId(null)
		.build();
}
