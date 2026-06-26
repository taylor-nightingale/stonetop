import { FrontOnOpen } from "../../../utils/front-on-open.js";
import { getHoverDescriptionSetting } from "../../../settings.js";
import { applyGearTermTooltips } from "../../../utils/gear-term-tooltips.js";
import { wrapStonetopGlyphsInEl } from "../../../utils/glyphs.js";
import { LOAD_LEVEL_LIMITS, deriveLoadLevel } from "../../../utils/load.js";

export class OutfitMoveDialog extends Application {
	constructor(character, outfitSnapshot, onDone, options = {}) {
		super(options);
		this._frontOnOpen = new FrontOnOpen(this);
		this._character      = character;
		this._regularItems   = outfitSnapshot.regularSegments.flatMap(seg => seg.items);
		this._smallItems     = [
			...outfitSnapshot.smallItems,
			...(outfitSnapshot.smallGridItems ?? []),
		];
		this._arcanaItems    = outfitSnapshot.arcanaItems ?? [];
		this._smallItemLimit = outfitSnapshot.smallItemLimit ?? null;
		// Pack Horse raises each load cap by one; the snapshot carries the limits in
		// effect so the thresholds and the regular ◇ ceiling here match the sheet.
		this._loadLimits     = outfitSnapshot.loadLimits ?? LOAD_LEVEL_LIMITS;
		this._hasPackHorse   = outfitSnapshot.hasPackHorse ?? false;
		this._checked = {};
		for (const item of [...this._regularItems, ...this._smallItems, ...this._arcanaItems]) {
			this._checked[item.slug] = item.checked;
		}
		// "Undefined" ◇/□ marks the player reserves without assigning to an item.
		// Seeded from the last Outfit so reopening shows the current state.
		this._undefinedRegular = outfitSnapshot.regularPool?.current ?? 0;
		this._undefinedSmall   = outfitSnapshot.smallPool?.current ?? 0;
		this._onDone = onDone;
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: "stonetop-outfit-dialog",
			template: "systems/stonetop/templates/dialogs/outfit-move.hbs",
			title: game.i18n.localize("stonetop.specialMoves.outfit.title"),
			width: 560,
			height: 600,
			resizable: true,
			classes: ["stonetop", "stonetop-outfit-dialog"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	getData() {
		const regularItems = this._regularItems.map(item => ({
			slug:    item.slug,
			name:    item.name,
			note:    item.note,
			weight:  item.weight,
			checked: this._checked[item.slug] ?? false,
		}));

		const smallItems = this._smallItems.map(item => ({
			slug:    item.slug,
			name:    item.name,
			note:    item.note,
			checked: this._checked[item.slug] ?? false,
		}));

		const arcanaItems = this._arcanaItems.map(item => ({
			slug:    item.slug,
			name:    item.name,
			note:    item.note,
			weight:  item.weight,
			checked: this._checked[item.slug] ?? false,
		}));

		const smallItemLimit = this._smallItemLimit;
		const pools = this._resolvePools();

		return {
			regularItems,
			smallItems,
			arcanaItems,
			hasArcana:         arcanaItems.length > 0,
			totalMarks:        pools.totalMarks,
			loadLevel:         pools.loadLevel,
			loadLevelNone:     pools.loadLevel === null,
			loadLevelLight:    pools.loadLevel === "light",
			loadLevelNormal:   pools.loadLevel === "normal",
			loadLevelHeavy:    pools.loadLevel === "heavy",
			undefinedRegular:        pools.undefinedRegular,
			canAddUndefinedRegular:  pools.undefinedRegular < pools.undefinedRegularMax,
			canRemUndefinedRegular:  pools.undefinedRegular > 0,
			undefinedSmall:          pools.undefinedSmall,
			canAddUndefinedSmall:    pools.undefinedSmall < pools.undefinedSmallMax,
			canRemUndefinedSmall:    pools.undefinedSmall > 0,
			totalSmallMarks:   pools.totalSmallMarks,
			smallItemLimit,
			hasSmallItemLimit: smallItemLimit !== null,
			hasPackHorse:      this._hasPackHorse,
			loadBadgeLight:    `${this._loadLimits.light}`,
			loadBadgeNormal:   `${this._loadLimits.light + 1}–${this._loadLimits.normal}`,
			loadBadgeHeavy:    `${this._loadLimits.normal + 1}–${this._loadLimits.heavy}`,
		};
	}

	// Clamp the undefined ◇/□ pools to what the checked items leave room for, and
	// derive the load level from the total marks. Pure: returns the clamped values
	// without mutating the stored reserves, so un-checking an item that had narrowed
	// the room restores the marks rather than destroying them on the next render.
	// getData renders from these; _applyOutfit persists them.
	_resolvePools() {
		const checkedRegularWeight = this._computeTotalWeight();
		const undefinedRegularMax  = Math.max(0, this._loadLimits.heavy - checkedRegularWeight);
		const undefinedRegular     = Math.min(this._undefinedRegular, undefinedRegularMax);

		const checkedSmallCount = this._smallItems.filter(i => this._checked[i.slug]).length;
		const undefinedSmallMax = Math.max(0, (this._smallItemLimit ?? 9) - checkedSmallCount);
		const undefinedSmall    = Math.min(this._undefinedSmall, undefinedSmallMax);

		const totalMarks = checkedRegularWeight + undefinedRegular;
		return {
			undefinedRegular,
			undefinedRegularMax,
			undefinedSmall,
			undefinedSmallMax,
			totalMarks,
			totalSmallMarks:     checkedSmallCount + undefinedSmall,
			loadLevel:           this._loadLevelFor(totalMarks),
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();

		// Gear-term hover descriptions (e.g. "near", "forceful", "x piercing") on
		// item notes — the dialog isn't an actor sheet, so onRenderActorSheet's
		// hook never reaches it; apply them here instead.
		if (getHoverDescriptionSetting("hoverDescriptionsGearTags")) {
			html[0].querySelectorAll(".stonetop-outfit-item-note").forEach(el => applyGearTermTooltips(el));
		}

		// Skin any raw ○/◇/□ glyphs in the item notes to the same SVG marks the
		// sheets use; the tree-walker skips the template's already-classed glyph
		// spans (load badges, undefined-pool marks), so it only touches note text.
		wrapStonetopGlyphsInEl(html[0]);

		html.find(".stonetop-outfit-item-check").on("change", ev => {
			this._checked[ev.currentTarget.dataset.slug] = ev.currentTarget.checked;
			this.render(false);
		});

		html.find(".stonetop-outfit-undefined-btn").on("click", ev => {
			const delta = Number(ev.currentTarget.dataset.dir);
			// Step from the clamped display value so the buttons stay intuitive even
			// when checked items have narrowed the room below the stored reserve.
			const pools = this._resolvePools();
			if (ev.currentTarget.dataset.pool === "regular") {
				this._undefinedRegular = Math.max(0, pools.undefinedRegular + delta);
			} else {
				this._undefinedSmall = Math.max(0, pools.undefinedSmall + delta);
			}
			this.render(false);
		});

		html.find(".stonetop-outfit-confirm-btn").on("click", async () => {
			await this._applyOutfit();
			this.close();
		});
	}

	async _applyOutfit() {
		// Load is derived from the marks on the sheet, so Outfit only records the
		// checked items and the two undefined reserves.
		const { undefinedRegular, undefinedSmall } = this._resolvePools();
		await this._character.applyOutfit(this._checked, undefinedRegular, undefinedSmall);
		if (this._onDone) this._onDone();
	}

	_computeTotalWeight() {
		return [...this._regularItems, ...this._arcanaItems]
			.filter(i => this._checked[i.slug])
			.reduce((sum, i) => sum + (i.weight ?? 0), 0);
	}

	_loadLevelFor(weight) {
		// The Outfit bar has only three tiers, so fold "overloaded" back into heavy.
		const level = deriveLoadLevel(weight, this._loadLimits);
		return level === "overloaded" ? "heavy" : level;
	}
}
