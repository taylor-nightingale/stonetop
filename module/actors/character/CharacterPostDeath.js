import {
	PostDeathInsertSnapshotBuilder,
	PostDeathSectionSnapshotBuilder,
} from "../../model/PostDeathInsertSnapshot.js";
import {
	LoreOptionSnapshotBuilder,
	LoreEntrySnapshotBuilder,
	LoreSection,
	InstinctOptionSnapshotBuilder,
	InstinctSection,
	MoveSnapshotBuilder,
} from "../../model/CharacterSnapshot.js";
import { composeInstinct } from "../../utils/strings.js";

export class CharacterPostDeath {
	constructor(insertFlags, instinct, lore, insertRepo, moveRepo) {
		this._insertFlags = insertFlags;
		this._instinct    = instinct;
		this._lore        = lore;
		this._insertRepo  = insertRepo;
		this._moveRepo    = moveRepo;
	}

	get activeSlug()       { return this._insertFlags.getFlag("slug") ?? null; }
	async setActiveSlug(s) { await this._insertFlags.setFlag("slug", s); }
	get instinct()         { return this._instinct; }
	get lore()             { return this._lore; }

	async buildSnapshot() {
		const slug       = this.activeSlug;
		const allEntries = await this._insertRepo.getAll();

		let activeInsert = null;
		if (slug) {
			const data = await this._insertRepo.findBySlug(slug);
			if (data) {
				const moves = await this._moveRepo.getPostDeathMoves(slug);
				activeInsert = new PostDeathInsertSnapshotBuilder()
					.withSlug(data.slug)
					.withName(data.name)
					.withImg(data.img)
					.withDescription(data.description)
					.withInstinct(_buildInstinctSection(data.instincts, this._instinct.selectedValue))
					.withLore(buildLoreSection(data.lore, this._lore))
					.withMoves(_buildMoveSnapshots(moves))
					.build();
			}
		}
		return new PostDeathSectionSnapshotBuilder()
			.withActiveSlug(slug)
			.withActiveInsert(activeInsert)
			.withAvailableInserts(allEntries)
			.build();
	}
}

// Exported so StonetopCharacter can reuse it for the playbook lore section.
// `arcanaDisplay` (Seeker only) carries the chosen major arcanum and the drawn
// minor cards. Lore entries/options opt in via the data flags `arcanaImage`
// (entry) and `arcanaRole` (option), so this stays playbook-agnostic.
export function buildLoreSection(loreData, loreState, arcanaDisplay = null) {
	const entries = loreData.map(entry => {
		const options = (entry.options ?? []).map(opt => {
			const isText = (opt.type ?? "checkbox") === "text";
			const builder = new LoreOptionSnapshotBuilder()
				.withSlug(opt.slug)
				.withDescription(opt.description)
				.withType(opt.type ?? "checkbox")
				.withMax(isText ? 0 : (opt.max ?? 1))
				.withCount(isText ? 0 : loreState.getCount(entry.slug, opt.slug))
				.withTextValue(isText ? loreState.getText(entry.slug, opt.slug) : null);
			if (arcanaDisplay && opt.arcanaRole) {
				const selectedSlug = arcanaDisplay.roles?.[opt.arcanaRole] ?? "";
				builder.withArcanaPicker({
					role:         opt.arcanaRole,
					options:      arcanaDisplay.minorOptions,
					selectedSlug,
					selectedName: arcanaDisplay.minorOptions.find(o => o.slug === selectedSlug)?.name ?? "",
					muted:        opt.arcanaRole === "lead",
				});
			}
			return builder.build();
		});
		const builder = new LoreEntrySnapshotBuilder()
			.withSlug(entry.slug)
			.withTitle(entry.title)
			.withDescription(entry.description ?? "")
			.withOptions(options)
			.withColumnBreak(entry.columnBreak)
			.withReadonlyMerge(entry.readonlyMerge)
			.withContinuation(entry.continuation)
			.withSubheader(entry.subheader);
		if (arcanaDisplay?.major && entry.arcanaImage) {
			builder.withArcanaImage(arcanaDisplay.major);
		}
		return builder.build();
	});
	return new LoreSection(entries);
}

function _buildInstinctSection(instincts, selectedValue) {
	const options = (instincts ?? []).map(({ word, description }) => {
		const value = composeInstinct(word, description);
		return new InstinctOptionSnapshotBuilder()
			.withWord(word)
			.withDescription(description)
			.withValue(value)
			.withSelected(selectedValue === value)
			.build();
	});
	return new InstinctSection(selectedValue || null, options);
}

function _buildMoveSnapshots(entries) {
	return entries.map(e => new MoveSnapshotBuilder()
		.withId(e.id)
		.withCompendiumId(e.id)
		.withOwnedId(null)
		.withName(e.name)
		.withDescription(e.description ?? "")
		.withRollType(e.rollType)
		.withIsStarting(false)
		.withSource({ type: "post-death" })
		.withSourceLabel(null)
		.withOwned(false)
		.withOwnedIds([])
		.withLocked(false)
		.withRequirement(null)
		.withRequiresLabel(null)
		.withResource(null)
		.withRepeat(null)
		.withRepeatable(false)
		.build()
	);
}
