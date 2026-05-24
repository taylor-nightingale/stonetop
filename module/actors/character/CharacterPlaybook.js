import { PlaybookSnapshotBuilder } from "../../model/snapshot/character/CharacterSnapshot.js";
import {StonetopFlags} from "./StonetopFlags.js";

export class CharacterPlaybook {
	constructor(actor, playbookRepo, background, instinct, appearance, origin, lore) {
		this._actor      = actor;
		this._repo       = playbookRepo;
		this._flags      = new StonetopFlags(actor, "playbook");
		this._background = background;
		this._instinct   = instinct;
		this._appearance = appearance;
		this._origin     = origin;
		this._lore       = lore;
	}

	setVitals(vitals) { this._vitals = vitals; }
	setMoves(moves)   { this._moves  = moves; }

	async getData() {
		const slug = this.getSlug() ?? null;
		if (!slug) return null;
		return this._repo.findBySlug(slug);
	}

	getSlug() {
		return this._actor.system?.playbook?.slug;
	}

	async getBackgroundMoveNames(bgSelectedSlug) {
		const data = await this.getData();
		if (!data) return new Set();
		return new Set(data.backgrounds?.find(b => b.slug === bgSelectedSlug)?.moves ?? []);
	}

	async selectBackground(slug) {
		const catKey = `playbook-${this.getSlug()}`;
		const oldMoveNames = await this.getBackgroundMoveNames(this._background.selectedSlug);
		await this._background.selectBackground(slug);
		const newMoveNames = await this.getBackgroundMoveNames(slug);
		for (const name of oldMoveNames) {
			if (!newMoveNames.has(name)) await this._moves.decrementMove(catKey, name);
		}
		for (const name of newMoveNames) {
			if (!oldMoveNames.has(name)) await this._moves.incrementMove(catKey, name);
		}
	}

	async selectPlaybook(stonetopPlaybook) {
		const bgMoveNames = new Set(
			stonetopPlaybook.backgrounds?.find(b => b.slug === this._background.selectedSlug)?.moves ?? []
		);
		const catKey = `playbook-${stonetopPlaybook.slug}`;
		await Promise.all([
			this._vitals.updateVitalsFromPlaybook(stonetopPlaybook),
			this._moves.initPlaybookCategory(stonetopPlaybook),
		]);
		for (const name of bgMoveNames) {
			await this._moves.incrementMove(catKey, name);
		}
	}

	async buildPlaybookSnapshot() {
		const data = await this.getData();
		if (!data) return null;
		return new PlaybookSnapshotBuilder()
			.withSlug(data.slug)
			.withName(data.name)
			.withImg(data.img ?? null)
			.withDescription(data.description ?? null)
			.withStatsNote(data.statsNote ?? null)
			.withLore(this._lore.buildSnapshot(data.lore ?? []))
			.withBackground(this._background.buildSnapshot(data.backgrounds ?? []))
			.withInstinct(this._instinct.buildSnapshot(data.instinct ?? null))
			.withAppearance(this._appearance.buildSnapshot(data.appearance ?? []))
			.withOrigin(this._origin.buildSnapshot(data.origin ?? []))
			.build();
	}
}
