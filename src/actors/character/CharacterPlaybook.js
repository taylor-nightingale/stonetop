import {PlaybookSnapshotBuilder} from "../../model/snapshot/character/CharacterSnapshot.js";
import {IntroductionsSnapshot} from "../../model/snapshot/character/PlaybookSnapshot.js";
import {ChoiceValues} from "../../model/snapshot/character/ChoiceGroup.js";
import {buildChoiceGroup} from "../../model/snapshot/character/buildChoiceGroup.js";
import {InstinctController} from "./InstinctController.js";
import {rich} from "../../model/snapshot/RichText.js";

export class CharacterPlaybook {
	constructor(actor, background, factory, origin) {
		this._actor = actor;
		this._background = background;
		this._origin = origin;
		this._ctrl = factory.forSingleton("playbook", "choiceValues");
		this._instinct = new InstinctController(this._ctrl);
	}

	setVitals(vitals) {
		this._vitals = vitals;
	}

	setMoves(moves) {
		this._moves = moves;
	}

	async getData() {
		const item = [...this._actor.items].find(i => i.type === "playbook");
		if (!item) return null;
		return {...item.system, name: item.name, img: item.img};
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

	// What choosing a playbook does to the character itself. The items it grants are not here — those
	// are the playbook's grant sets, applied by the router.
	async selectPlaybook(stonetopPlaybook) {
		await this._actor.update({"system.playbookSlug": stonetopPlaybook.slug});
		await this._vitals.updateVitalsFromPlaybook(stonetopPlaybook);
	}

	// The moves a playbook grants. The ones the chosen background hands you seed acquired alongside the
	// playbook's own starting moves — a background is picked before the playbook is applied, so there is
	// nothing to increment afterwards.
	async moveGrants(stonetopPlaybook) {
		return this._moves.playbookGrants(stonetopPlaybook, this._backgroundMoves(stonetopPlaybook));
	}

	_backgroundMoves(stonetopPlaybook) {
		return stonetopPlaybook.backgrounds?.find(b => b.slug === this._background.selectedSlug)?.moves ?? [];
	}

	/** The controller for the playbook's choice values (lore, appearance, introductions, …). */
	controller() { return this._ctrl; }

	/** The playbook's instinct group is exclusive with its write-in box. */
	instinctController() { return this._instinct; }

	async selectChoice(groupSlug, optionSlug, siblingsCsv) {
		if (groupSlug === "instinct")
			await this._instinct.selectOption(groupSlug, optionSlug, siblingsCsv);
		else
			await this._ctrl.selectOption(groupSlug, optionSlug, siblingsCsv);
	}

	async selectCustomInstinct(text) {
		await this._instinct.selectCustom("instinct", text);
	}

	async setChoiceCount(groupSlug, optionSlug, count) {
		await this._ctrl.setCount(groupSlug, optionSlug, count);
	}

	async setChoiceText(groupSlug, optionSlug, text) {
		if (groupSlug === "instinct")
			await this._instinct.setText(groupSlug, optionSlug, text);
		else
			await this._ctrl.setText(groupSlug, optionSlug, text);
	}

	async buildPlaybookSnapshot() {
		const data = await this.getData();
		if (!data) return null;
		const choiceValues = new ChoiceValues(data.choiceValues ?? {});
		const instinctGroup = data.instinct ? buildChoiceGroup(data.instinct, choiceValues) : null;
		const instinctSelected = InstinctController.computeSelected(instinctGroup, choiceValues);
		const choices = (data.choices ?? []).map(g => buildChoiceGroup(g, choiceValues));
		const appearanceGroup  = data.appearance ? buildChoiceGroup(data.appearance, choiceValues) : null;
		const loreGroups = choices;
		const introData = data.introductions && !Array.isArray(data.introductions) && data.introductions.step4 ? data.introductions : null;
		const introductions = introData ? new IntroductionsSnapshot(
			rich(introData.step3 ?? null),
			introData.step4 ? buildChoiceGroup(introData.step4, choiceValues) : null,
			introData.step6 ? buildChoiceGroup(introData.step6, choiceValues) : null,
		) : null;
		const background = await this._background.buildSnapshot(data.backgrounds ?? []);
		return new PlaybookSnapshotBuilder()
			.withSlug(data.slug)
			.withName(data.name)
			.withImg(data.img ?? null)
			.withDescription(rich(data.description ?? null))
			.withStatsNote(data.statsNote ?? null)
			.withChoices(choices)
			.withInstinctGroup(instinctGroup)
			.withInstinctSelected(instinctSelected)
			.withAppearanceGroup(appearanceGroup)
			.withLoreGroups(loreGroups)
			.withBackground(background)
			.withOrigin(this._origin.buildSnapshot(data.origin ?? []))
			.withIntroductions(introductions)
			.build();
	}
}
