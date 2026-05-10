export class StonetopCharacterActor {
	constructor(actor) {
		this._actor = actor;
	}

	// -- Lifecycle --------------------------------------------------
	async onPlaybookAdded(documents) {
		const playbook = documents.find(d => d.type === "playbook");
		if (!playbook) return;
		const hp = playbook.flags?.stonetop?.hp;
		const damage = playbook.flags?.stonetop?.damage;
		if (!hp || !damage) return;
		await this._actor.update({
			"system.attributes.hp.max": hp,
			"system.attributes.hp.value": hp,
			"system.attributes.damage.value": damage,
		});
	}

	// -- Sheet Rendering --------------------------------------------
	async renderSheet(sheet, html) {
		const nav = html.find("nav.sheet-tabs[data-group='primary']");
		if (!nav.length) return;

		const flags = await this._getPlaybookFlags();
		const saved = this._actor.flags?.stonetop?.creation ?? {};
		const creation = StonetopCharacterActor.buildCreation(flags, saved);

		nav.prepend('<a class="item" data-tab="creation">Creation</a>');

		const content = await renderTemplate(
			"modules/stonetop/templates/actor/creation-tab.hbs",
			{ creation }
		);
		html.find(".sheet-body").prepend(content);

		if (!saved.background) sheet._tabs?.[0]?.activate("creation");

		html.find(".creation-choice").on("change", async ev => {
			const el = ev.currentTarget;
			const { field } = el.dataset;
			const value = el.type === "checkbox" ? el.checked : el.value;
			await this._actor.setFlag("stonetop", `creation.${field}`, value);
		});
	}

	// PBTA tracks the selected playbook as a slug in actor.system.playbook (e.g. "the-blessed").
	// The compendium is the authoritative source — the embedded item is unreliable after re-selection.
	async _getPlaybookFlags() {
		const slug = this._actor.system?.playbook;
		if (!slug) return null;

		const pack = game.packs.get("stonetop.playbooks");
		if (!pack) return null;

		await pack.getIndex();
		const entry = pack.index.find(e => StonetopCharacterActor._slugify(e.name) === slug);
		if (!entry) return null;

		const doc = await pack.getDocument(entry._id);
		return doc?.flags?.stonetop ?? null;
	}

	// -- Static utilities -------------------------------------------

	static buildCreation(flags, saved = {}) {
		if (!flags) return null;
		const hasData = flags.backgrounds?.length || flags.instincts?.length || flags.appearance?.length;
		if (!hasData) return null;
		return {
			backgrounds: (flags.backgrounds ?? []).map(b => {
				const selected = saved.background === b.slug;
				const result = { ...b, selected };
				if (b.choices) {
					const savedChoices = saved.backgroundChoices ?? {};
					result.choices = {
						label: b.choices.label,
						countLabel: b.choices.count.join(" or "),
						options: b.choices.options.map(o => ({
							...o,
							selected: Boolean(savedChoices[o.slug]),
						})),
					};
				}
				return result;
			}),
			instincts: (flags.instincts ?? []).map(v => ({
				value: v,
				selected: saved.instinct === v,
			})),
			appearance: (flags.appearance ?? []).map((line, i) => ({
				lineIdx: i,
				options: line.map(v => ({
					value: v,
					selected: (saved.appearance ?? {})[i] === v,
				})),
			})),
		};
	}

	static _slugify(name) {
		return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
	}

	// -- PBTA Sheet Config ------------------------------------------

	static sheetConfig() {
		return {
			stats: {
				str: {label: game.i18n.localize("stonetop.character.stats.strength"), value: 0},
				dex: {label: game.i18n.localize("stonetop.character.stats.dexterity"), value: 0},
				int: {label: game.i18n.localize("stonetop.character.stats.intelligence"), value: 0},
				wis: {label: game.i18n.localize("stonetop.character.stats.wisdom"), value: 0},
				con: {label: game.i18n.localize("stonetop.character.stats.constitution"), value: 0},
				cha: {label: game.i18n.localize("stonetop.character.stats.charisma"), value: 0},
			},
			moveTypes: {
				background: {label: game.i18n.localize("stonetop.character.moveTypes.background"), moves: []},
				basic: {label: "Basic Moves", creation: true, moves: []},
				playbook: {label: "Playbook Moves", playbook: true, moves: []},
				special: {label: "Special Moves", creation: true, moves: []},
				follower: {label: "Follower Moves", creation: true, moves: []},
				expedition: {label: "Expedition Moves", creation: true, moves: []},
				homefront: {label: "Homefront Moves", creation: true, moves: []},
			},
			attributes: {
				// -- TOP -------------------------------------------------------
				instinct: {
					position: "Top",
					type: "LongText",
					label: game.i18n.localize("stonetop.character.attributes.instinct"),
					value: "",
				},
				xp: {
					position: "Top",
					type: "Xp",
					label: game.i18n.localize("stonetop.character.attributes.xp"),
					max: 20,
					steps: Array.from({length: 20}, () => false),
				},
				level: {
					position: "Top",
					type: "Number",
					label: game.i18n.localize("stonetop.character.attributes.level"),
					value: 1,
				},
				stock: {
					position: "Top",
					type: "Clock",
					label: game.i18n.localize("stonetop.character.attributes.stock"),
					value: 0,
					max: 3,
					steps: Array.from({length: 3}, () => false),
					playbook: "the-blessed",
				},
				favor: {
					position: "Top",
					type: "Resource",
					label: game.i18n.localize("stonetop.character.attributes.favor"),
					playbook: "the-judge",
					value: 0,
					max: 4,
				},
				// -- LEFT ------------------------------------------------------
				debilities: {
					label: "Debilities",
					type: "LabeledCheckboxes",
					condition: true,
					options: {
						weakened: {label: "Weakened", value: false, stat: ["str", "dex"]},
						dazed: {label: "Dazed", value: false, stat: ["int", "wis"]},
						miserable: {label: "Miserable", value: false, stat: ["con", "cha"]},
					},
				},
				omen: {
					position: "Left",
					type: "Clock",
					label: game.i18n.localize("stonetop.character.attributes.omen"),
					playbook: "the-would-be-hero",
					value: 0,
					max: 3,
					steps: [false, false, false],
				},
				resolve: {
					position: "Left",
					type: "Clock",
					label: game.i18n.localize("stonetop.character.attributes.resolve"),
					playbook: "the-would-be-hero",
					default: 0,
					max: 2,
					steps: [false, false],
				},
				hp: {
					position: "Left",
					type: "Resource",
					label: "HP",
					value: 16,
					max: 16,
					min: 0,
				},
				armour: {
					type: "Number",
					label: "Armour",
					position: "Left",
					value: 0,
				},
				damage: {
					position: "Left",
					type: "Roll",
					label: "Damage",
					description: "The damage your character deals.",
					value: "d4",
				},
				load: {
					position: "Left",
					type: "ListOne",
					label: "Load",
					options: [{label: "Light", value: 3}, {label: "Normal", value: 6}, {label: "Heavy", value: 9}],
				},
			},
			equipmentTypes: {
				special: {label: "Special Possessions", items: []},
				gear: {label: "Gear", items: []},
			},
		};
	}
}
