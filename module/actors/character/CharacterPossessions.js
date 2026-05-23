import {
	PossessionItemSnapshotBuilder,
	PossessionsSnapshot,
	ResourceBuilder,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { OutfitItemBuilder } from "../../model/data/character/OutfitItem.js";

export class CharacterPossessions {
	constructor(flags, moves) {
		this._flags = flags;
		this._moves = moves;
	}

	get selected()    { return new Set(this._flags.getFlag("selected") ?? []); }
	get uses()        { return this._flags.getFlag("uses") ?? {}; }
	get maxUses()     { return this._flags.getFlag("maxUses") ?? {}; }
	get subChoices()  { return this._flags.getFlag("subChoices") ?? {}; }
	get choiceUses()  { return this._flags.getFlag("choiceUses") ?? {}; }

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
		const current = this.subChoices;
		const existing = current[possessionSlug] ?? [];
		if (existing.includes(choiceSlug)) return;
		await this._flags.setFlag("subChoices", { ...current, [possessionSlug]: [...existing, choiceSlug] });
	}

	async removeSubChoice(possessionSlug, choiceSlug) {
		const current = this.subChoices;
		const existing = current[possessionSlug] ?? [];
		await this._flags.setFlag("subChoices", { ...current, [possessionSlug]: existing.filter(s => s !== choiceSlug) });
	}

	async selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs) {
		const current = this.subChoices;
		const existing = current[possessionSlug] ?? [];
		const filtered = existing.filter(s => !exclusiveSlugs.includes(s));
		const updated = filtered.includes(choiceSlug) ? filtered : [...filtered, choiceSlug];
		await this._flags.setFlag("subChoices", { ...current, [possessionSlug]: updated });
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
		const subChoicesMap = this.subChoices;
		const items = [];
		for (const opt of specialPossessions.options ?? []) {
			if (!preselected.has(opt.slug) && !selectedSlugs.has(opt.slug)) continue;
			for (const item of opt.outfitItems ?? []) {
				items.push(_buildPossessionOutfitItem(item));
			}
			const selected = new Set(subChoicesMap[opt.slug] ?? []);
			for (const choice of opt.choices?.options ?? []) {
				if (!selected.has(choice.slug)) continue;
				for (const item of choice.outfitItems ?? []) {
					items.push(_buildPossessionOutfitItem(item));
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
				.withChoices(null)
				.withChoiceGroups(null)
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
