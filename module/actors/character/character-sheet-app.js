import {getPlaybookFlags} from "./character-actor.js";

export function buildSheetContext(flags, saved = {}) {
	if (!flags) return {
		hasPlaybook: false,
		backgrounds: [],
		instincts: [],
		appearance: [],
		origins: [],
		savedInstinct: ""
	};

	const savedBg = saved.background ?? "";
	const savedInstinct = saved.instinct ?? "";
	const savedAppearance = saved.appearance ?? {};
	const savedOrigin = saved.origin ?? "";
	const savedChoices = saved.backgroundChoices ?? {};

	return {
		hasPlaybook: true,
		backgrounds: (flags.backgrounds ?? []).map(b => {
			const result = {...b, selected: b.slug === savedBg};
			if (b.choices) {
				result.choices = {
					label: b.choices.label,
					countLabel: b.choices.count.join(" or "),
					options: b.choices.options.map(o => ({
						...o,
						checked: Boolean(savedChoices[o.slug]),
					})),
				};
			}
			return result;
		}),
		instincts: (flags.instincts ?? []).map(({word, description}) => ({
			word,
			description,
			value: `${word} — ${description}`,
			selected: `${word} — ${description}` === savedInstinct,
		})),
		savedInstinct,
		appearance: (flags.appearance ?? []).map((opts, i) => ({
			lineIdx: i,
			options: opts.map(v => ({value: v, selected: savedAppearance[i] === v})),
		})),
		origins: (flags.origin ?? []).map(({region, names}) => ({
			region,
			names,
			selected: region === savedOrigin,
		})),
		savedOrigin,
	};
}

function sortGroup(moves, groupNames) {
	const dependents = new Map();
	const roots = [];
	for (const move of moves) {
		if (!move.requires || !groupNames.has(move.requires)) {
			roots.push(move);
		} else {
			if (!dependents.has(move.requires)) dependents.set(move.requires, []);
			dependents.get(move.requires).push(move);
		}
	}
	roots.sort((a, b) => a.name.localeCompare(b.name));
	for (const deps of dependents.values()) deps.sort((a, b) => a.name.localeCompare(b.name));
	const result = [];
	const visited = new Set();

	function visit(move) {
		if (visited.has(move.name)) return;
		visited.add(move.name);
		result.push(move);
		for (const child of dependents.get(move.name) ?? []) visit(child);
	}

	for (const root of roots) visit(root);
	moves.filter(m => !visited.has(m.name)).sort((a, b) => a.name.localeCompare(b.name)).forEach(m => result.push(m));
	return result;
}

export function sortPlaybookMoves(moves) {
	const groups = new Map();
	for (const move of moves) {
		const key = move.minLevel ?? 0;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(move);
	}
	const result = [];
	for (const level of [...groups.keys()].sort((a, b) => a - b)) {
		const group = groups.get(level);
		result.push(...sortGroup(group, new Set(group.map(m => m.name))));
	}
	return result;
}

const OTHER_MOVE_TYPES = ["background", "special", "follower", "expedition", "homefront"];

export function buildMovelistContext(entries, ownedAllByName, bgMoveNames, actorLevel, actorPlaybook) {
	return entries.map(e => {
		const ownedInstances = ownedAllByName.get(e.name) ?? [];
		const isStarting = e.system?.isStartingMove || bgMoveNames.has(e.name);
		const req = e.system?.requirement ?? null;
		const requiresMoves = req?.moves ?? [];
		const requiresPlaybook = req?.playbook ?? null;
		const minLevel = req?.level ?? null;
		const repeatMax = e.system?.repeatMax ?? 1;
		const repeatable = repeatMax > 1;
		const locked = !isStarting && !!(
			requiresMoves.some(m => !ownedAllByName.has(m)) ||
			(requiresPlaybook && requiresPlaybook !== actorPlaybook) ||
			(minLevel && actorLevel < minLevel)
		);
		const lastOwnedId = ownedInstances[ownedInstances.length - 1]?._id ?? null;
		return {
			name: e.name,
			description: e.system?.description ?? "",
			compendiumId: e._id,
			owned: ownedInstances.length > 0,
			ownedId: lastOwnedId,
			rollType: e.system?.stat ?? null,
			isStarting,
			locked,
			requires: requiresMoves[0] ?? null,
			requiresLabel: requiresMoves.length > 0 ? requiresMoves.join(", ") : null,
			requiresPlaybook,
			minLevel,
			repeatable,
			repeatChecks: repeatable ? Array.from({length: repeatMax}, (_, i) => ({
				checked: i < ownedInstances.length,
				ownedId: i < ownedInstances.length ? lastOwnedId : null,
				disabled: isStarting || locked || (!(i < ownedInstances.length) && i !== ownedInstances.length),
			})) : null,
			resourceMax: e.system?.resourceMax ?? null,
		};
	});
}

async function ensureStartingMoves(actor) {
	const playbookName = actor.system?.playbook?.name;
	if (!playbookName) return;
	const pack = game.packs.get("stonetop.playbook-moves");
	if (!pack) return;
	await pack.getIndex({
		fields: ["system.playbook", "system.isStartingMove", "system.requirement",
			"system.stat", "system.description", "system.repeatMax", "system.resourceMax"]
	});
	const ownedNames = new Set(actor.items.filter(i => i.type === "move").map(i => i.name));

	const flags = await getPlaybookFlags(actor);
	const selectedBg = actor.getFlag("stonetop", "background") ?? "";
	const background = flags?.backgrounds?.find(b => b.slug === selectedBg);
	const bgMoveNames = new Set(background?.moves ?? []);

	const missing = pack.index.filter(e =>
		e.system?.playbook === playbookName &&
		(e.system?.isStartingMove || bgMoveNames.has(e.name)) &&
		!ownedNames.has(e.name)
	);
	if (!missing.length) return;
	const docs = await Promise.all(missing.map(e => pack.getDocument(e._id)));
	await actor.createEmbeddedDocuments("Item", docs.map(d => d.toObject()));
}

export async function getMovelistContext(actor) {
	await ensureStartingMoves(actor);

	const playbookName = actor.system?.playbook?.name ?? null;
	const actorLevel = actor.system?.attributes?.level?.value ?? 1;
	const selectedBg = actor.getFlag("stonetop", "background") ?? "";

	const ownedAllByName = new Map();
	for (const item of actor.items.filter(i => i.type === "move")) {
		if (!ownedAllByName.has(item.name)) ownedAllByName.set(item.name, []);
		ownedAllByName.get(item.name).push(item);
	}

	const flags = await getPlaybookFlags(actor);
	const background = flags?.backgrounds?.find(b => b.slug === selectedBg);
	const bgMoveNames = new Set(background?.moves ?? []);

	let playbookMoves = [];
	if (playbookName) {
		const pack = game.packs.get("stonetop.playbook-moves");
		await pack.getIndex({
			fields: ["system.playbook", "system.isStartingMove", "system.requirement",
				"system.stat", "system.description",
				"system.repeatMax", "system.resourceMax"],
		});
		const entries = pack.index.filter(e => e.system?.playbook === playbookName);
		playbookMoves = sortPlaybookMoves(buildMovelistContext(entries, ownedAllByName, bgMoveNames, actorLevel, playbookName));

		const moveResources = actor.getFlag("stonetop", "moveResources") ?? {};
		for (const move of playbookMoves) {
			if (!move.resourceMax) continue;
			const current = moveResources[move.name] ?? 0;
			move.resourceChecks = Array.from({length: move.resourceMax}, (_, i) => ({
				checked: i < current,
			}));
		}
	}

	let basicMoves = [];
	const basicPack = game.packs.get("stonetop.basic-moves");
	if (basicPack) {
		await basicPack.getIndex({fields: ["system.stat"]});
		basicMoves = basicPack.index.map(e => {
			const instances = ownedAllByName.get(e.name) ?? [];
			return {
				name: e.name,
				compendiumId: e._id,
				ownedId: instances[0]?._id ?? null,
				rollType: e.system?.stat ?? null,
				owned: instances.length > 0
			};
		});
	}

	const otherGroups = OTHER_MOVE_TYPES.reduce((acc, t) => {
		const items = actor.items.filter(i => i.type === "move" && i.system?.moveType === t);
		if (items.length) acc.push({
			key: t,
			label: t.charAt(0).toUpperCase() + t.slice(1) + " Moves",
			moves: items.map(i => ({name: i.name, ownedId: i._id, rollType: i.system?.stat ?? null})),
		});
		return acc;
	}, []);

	return {playbookMoves, basicMoves, otherGroups, startingMovesNote: flags?.startingMovesNote ?? null};
}

export function createStonetopCharacterSheetClass(Base) {
	return class StonetopCharacterSheet extends Base {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["pbta", "stonetop", "sheet", "actor", "character"],
				tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves"}],
			});
		}

		get template() {
			return "modules/stonetop/templates/actor/character.hbs";
		}

		async getData() {
			const context = await super.getData();
			const flags = await getPlaybookFlags(this.actor);
			const saved = {
				background: this.actor.getFlag("stonetop", "background") ?? "",
				instinct: this.actor.getFlag("stonetop", "instinct") ?? "",
				appearance: this.actor.getFlag("stonetop", "appearance") ?? {},
				origin: this.actor.getFlag("stonetop", "origin") ?? "",
				backgroundChoices: this.actor.getFlag("stonetop", "backgroundChoices") ?? {},
			};
			context.stonetop = buildSheetContext(flags, saved);
			context.stonetop.movelist = await getMovelistContext(this.actor);
			return context;
		}

		activateListeners(html) {
			super.activateListeners(html);
			html.find(".cell--stats .stat-value").each((_, el) => {
				el.value = el.value.replace(/^\+/, "");
			});
			if (!this.isEditable) return;
			html.find("[name=stonetop-background]").on("change", this._onBackgroundChange.bind(this));
			html.find("[name=stonetop-instinct]").on("change", ev => {
				const val = ev.currentTarget.value;
				html.find(".stonetop-instinct-custom").val(val);
				this.actor.setFlag("stonetop", "instinct", val);
			});
			html.find(".stonetop-instinct-custom").on("change", ev =>
				this.actor.setFlag("stonetop", "instinct", ev.currentTarget.value.trim()));
			html.find(".stonetop-appearance-radio").on("change", this._onAppearanceChange.bind(this));
			html.find("[name=stonetop-origin]").on("change", ev =>
				this.actor.setFlag("stonetop", "origin", ev.currentTarget.value));
			html.find(".stonetop-origin-name").on("click", this._onOriginNameClick.bind(this));
			html.find(".stonetop-move-check").on("change", this._onMoveCheck.bind(this));
			html.find(".stonetop-repeat-check").on("change", this._onRepeatCheck.bind(this));
			html.find(".stonetop-bg-choice").on("change", this._onBgChoiceChange.bind(this));
			html[0].addEventListener("click", ev => {
				const circle = ev.target.closest(".stonetop-move-resource-check");
				if (!circle) return;
				ev.stopPropagation();
				ev.stopImmediatePropagation();
				this._onMoveResourceChange({currentTarget: circle});
			}, true);
		}

		async _onBackgroundChange(ev) {
			const slug = ev.currentTarget.value;
			await this.actor.setFlag("stonetop", "background", slug);
		}

		async _onAppearanceChange(ev) {
			const el = ev.currentTarget;
			const lineIdx = Number(el.dataset.line);
			const saved = this.actor.getFlag("stonetop", "appearance") ?? {};
			await this.actor.setFlag("stonetop", "appearance", {...saved, [lineIdx]: el.value});
		}

		async _onOriginNameClick(ev) {
			const name = ev.currentTarget.textContent.trim();
			await this.actor.update({name});
		}

		async _onMoveCheck(ev) {
			const el = ev.currentTarget;
			if (el.checked) {
				const pack = game.packs.get("stonetop.playbook-moves");
				const doc = await pack.getDocument(el.dataset.compendiumId);
				await this.actor.createEmbeddedDocuments("Item", [doc.toObject()]);
			} else {
				const ownedId = el.dataset.ownedId;
				if (ownedId) await this.actor.deleteEmbeddedDocuments("Item", [ownedId]);
			}
		}

		async _onRepeatCheck(ev) {
			const el = ev.currentTarget;
			if (el.checked) {
				const pack = game.packs.get("stonetop.playbook-moves");
				const doc = await pack.getDocument(el.dataset.compendiumId);
				await this.actor.createEmbeddedDocuments("Item", [doc.toObject()]);
			} else {
				const ownedId = el.dataset.ownedId;
				if (ownedId) await this.actor.deleteEmbeddedDocuments("Item", [ownedId]);
			}
		}

		async _onMoveResourceChange(ev) {
			const el = ev.currentTarget;
			const moveName = el.dataset.moveName;
			const index = Number(el.dataset.index);
			const isChecked = el.classList.contains("is-checked");
			const newValue = isChecked ? index : index + 1;
			const current = this.actor.getFlag("stonetop", "moveResources") ?? {};
			await this.actor.setFlag("stonetop", "moveResources", {...current, [moveName]: newValue});
		}

		async _onBgChoiceChange(ev) {
			const el = ev.currentTarget;
			const saved = this.actor.getFlag("stonetop", "backgroundChoices") ?? {};
			await this.actor.setFlag("stonetop", "backgroundChoices", {...saved, [el.dataset.slug]: el.checked});
		}
	};
}
