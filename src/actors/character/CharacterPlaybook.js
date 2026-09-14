import {PlaybookSnapshotBuilder} from "../../model/snapshot/character/CharacterSnapshot.js";
import {IntroductionsSnapshot} from "../../model/snapshot/character/PlaybookSnapshot.js";
import {ChoiceValues} from "../../model/snapshot/character/ChoiceGroup.js";
import {buildChoiceGroup} from "../../model/snapshot/character/buildChoiceGroup.js";
import {InstinctController} from "./InstinctController.js";
import {GrantSource, ItemGrantSet} from "../../model/data/ItemGrant.js";
import {Background} from "../../model/data/character/Background.js";
import {rich} from "../../model/snapshot/RichText.js";

export class CharacterPlaybook {
	constructor(actor, background, factory, origin, vitals, moves, selection) {
		this._actor = actor;
		this._background = background;
		this._origin = origin;
		this._vitals = vitals;
		this._moves = moves;
		this._selection = selection;
		this._ctrl = factory.forSingleton("playbook", "choiceValues");
		this._instinct = new InstinctController(this._ctrl);
	}

	async getData() {
		const item = [...this._actor.items].find(i => i.type === "playbook");
		if (!item) return null;
		return {...item.system, name: item.name, img: item.img};
	}

	getSlug() {
		return this._selection.slug;
	}

	/** The slugs of the moves a background grants — `backgrounds[].moves` is a slug list, not names. */
	async getBackgroundMoveSlugs(bgSelectedSlug) {
		const data = await this.getData();
		if (!data) return new Set();
		return new Set(Background.find(data, bgSelectedSlug)?.moveSlugs ?? []);
	}

	async selectBackground(slug) {
		const catKey = `playbook-${this.getSlug()}`;
		const oldSlug = this._background.selectedSlug;
		const oldMoveSlugs = await this.getBackgroundMoveSlugs(oldSlug);
		await this._background.selectBackground(slug);
		const newMoveSlugs = await this.getBackgroundMoveSlugs(slug);
		for (const moveSlug of oldMoveSlugs) {
			if (!newMoveSlugs.has(moveSlug)) await this._moves.decrementMove(catKey, moveSlug);
		}
		for (const moveSlug of newMoveSlugs) {
			if (!oldMoveSlugs.has(moveSlug)) await this._moves.incrementMove(catKey, moveSlug);
		}
		// A background's own moves are items only it grants, so the switch hands the old one's back
		// before handing out the new one's.
		if (oldSlug) await this._moves.removeCategory(Background.categoryKeyFor(oldSlug));
		const background = Background.of(this._background.selectedBackground(await this.getData()));
		const granted    = background?.grantedMoveSlugs ?? [];
		await this._moves.addCategory(Background.categoryKeyFor(slug), background?.label, granted, granted);
	}

	// What choosing a playbook does to the character itself. The items it grants are not here — those
	// are the playbook's grant sets, applied by the router.
	async selectPlaybook(stonetopPlaybook) {
		await this._selection.select(stonetopPlaybook.slug);
		await this._vitals.updateVitalsFromPlaybook(stonetopPlaybook);
	}

	// The moves a playbook grants. The ones the chosen background hands you seed acquired alongside the
	// playbook's own starting moves — a background is picked before the playbook is applied, so there is
	// nothing to increment afterwards.
	async moveGrants(stonetopPlaybook) {
		return this._moves.playbookGrants(stonetopPlaybook, this._backgroundMoves(stonetopPlaybook));
	}

	_backgroundMoves(stonetopPlaybook) {
		return Background.of(this._background.selectedBackground(stonetopPlaybook))?.moveSlugs ?? [];
	}

	/** The moves the chosen background hands you of its own: whatever its choice group links (the same
	 *  structural collector an arcanum's card asks). They live in a category of the background's, which
	 *  is what keeps them on the background and off the moves tab. */
	async backgroundMoveGrants(stonetopPlaybook) {
		const background = Background.of(this._background.selectedBackground(stonetopPlaybook));
		const slugs      = background?.grantedMoveSlugs ?? [];
		const catKey     = Background.categoryKeyFor(this._background.selectedSlug);
		if (!slugs.length) return ItemGrantSet.empty(GrantSource.forCategoryKey(catKey));
		return this._moves.categoryGrants(catKey, background.label, slugs, slugs);
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
