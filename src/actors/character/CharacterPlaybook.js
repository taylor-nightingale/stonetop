import { PlaybookSnapshotBuilder } from "../../model/snapshot/character/CharacterSnapshot.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { InstinctController } from "./InstinctController.js";

export class CharacterPlaybook {
	constructor(actor, background, factory, origin) {
		this._actor      = actor;
		this._background = background;
		this._origin     = origin;
		this._ctrl       = factory.forItemType("playbook", "choiceValues");
		this._instinct   = new InstinctController(this._ctrl);
	}

	setVitals(vitals) { this._vitals = vitals; }
	setMoves(moves)   { this._moves  = moves; }

	async getData() {
		const item = [...this._actor.items].find(i => i.type === "playbook");
		if (!item) return null;
		return { ...item.system, name: item.name, img: item.img };
	}

	getSlug() {
		return this._actor.system?.playbookSlug || null;
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
		await this._actor.update({ "system.playbookSlug": stonetopPlaybook.slug });
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

	async selectChoice(groupSlug, optionSlug, siblingsCsv) {
		if (groupSlug === "instinct")
			await this._instinct.selectOption(optionSlug, siblingsCsv);
		else
			await this._ctrl.selectOption(groupSlug, optionSlug, siblingsCsv);
	}

	async selectCustomInstinct(text) {
		await this._instinct.selectCustom(text);
	}

	async setChoiceCount(groupSlug, optionSlug, count) {
		await this._ctrl.setCount(groupSlug, optionSlug, count);
	}

	async setChoiceText(groupSlug, optionSlug, text) {
		if (groupSlug === "instinct")
			await this._instinct.setText(optionSlug, text);
		else
			await this._ctrl.setText(groupSlug, optionSlug, text);
	}

	async buildPlaybookSnapshot() {
		const data = await this.getData();
		if (!data) return null;
		const choiceValues     = new ChoiceValues(data.choiceValues ?? {});
		const instinctGroup    = data.instinct ? ChoiceGroup.fromPackData(data.instinct, choiceValues) : null;
		const instinctSelected = InstinctController.computeSelected(instinctGroup, choiceValues);
		const choices          = (data.choices ?? []).map(g => ChoiceGroup.fromPackData(g, choiceValues));
		const appearanceGroup  = choices.find(c => c.slug === "appearance") ?? null;
		const loreGroups       = choices.filter(c => c.slug !== "appearance");
		const background       = await this._background.buildSnapshot(data.backgrounds ?? []);
		return new PlaybookSnapshotBuilder()
			.withSlug(data.slug)
			.withName(data.name)
			.withImg(data.img ?? null)
			.withDescription(data.description ?? null)
			.withStatsNote(data.statsNote ?? null)
			.withChoices(choices)
			.withInstinctGroup(instinctGroup)
			.withInstinctSelected(instinctSelected)
			.withAppearanceGroup(appearanceGroup)
			.withLoreGroups(loreGroups)
			.withBackground(background)
			.withOrigin(this._origin.buildSnapshot(data.origin ?? []))
			.build();
	}
}
