import { getPlaybookFlags } from "./character-actor.js";
import { setupStartingMoves } from "./character-dialogs.js";

export function buildSheetContext(flags, saved = {}) {
	if (!flags) return { hasPlaybook: false, backgrounds: [], instincts: [], appearance: [], origins: [], savedInstinct: "" };

	const savedBg         = saved.background  ?? "";
	const savedInstinct   = saved.instinct    ?? "";
	const savedAppearance = saved.appearance  ?? {};
	const savedOrigin     = saved.origin      ?? "";

	return {
		hasPlaybook: true,
		backgrounds: (flags.backgrounds ?? []).map(b => ({ ...b, selected: b.slug === savedBg })),
		instincts: (flags.instincts ?? []).map(({ word, description }) => ({
			word,
			description,
			value: `${word} — ${description}`,
			selected: `${word} — ${description}` === savedInstinct,
		})),
		savedInstinct,
		appearance: (flags.appearance ?? []).map((opts, i) => ({
			lineIdx: i,
			options: opts.map(v => ({ value: v, selected: savedAppearance[i] === v })),
		})),
		origins: (flags.origin ?? []).map(({ region, names }) => ({
			region,
			names,
			selected: region === savedOrigin,
		})),
		savedOrigin,
	};
}

const OTHER_MOVE_TYPES = ["background", "special", "follower", "expedition", "homefront"];

export function buildMovelistContext(entries, ownedByName, bgMoveNames, actorLevel) {
	return entries.map(e => {
		const owned      = ownedByName.get(e.name);
		const isStarting = e.system?.isStartingMove || bgMoveNames.has(e.name);
		const requires   = e.system?.requires ?? null;
		const minLevel   = e.system?.minLevel  ?? null;
		const locked     = !isStarting && !!(
			(requires && !ownedByName.has(requires)) ||
			(minLevel && actorLevel < minLevel)
		);
		return {
			name:         e.name,
			description:  e.system?.description ?? "",
			compendiumId: e._id,
			owned:        !!owned,
			ownedId:      owned?._id ?? null,
			rollType:     e.system?.stat ?? null,
			isStarting,
			locked,
			requires,
			minLevel,
		};
	});
}

export async function getMovelistContext(actor) {
	const playbookName = actor.system?.playbook?.name ?? null;
	const actorLevel   = actor.system?.attributes?.level?.value ?? 1;
	const selectedBg   = actor.getFlag("stonetop", "background") ?? "";

	const ownedByName = new Map(
		actor.items.filter(i => i.type === "move").map(i => [i.name, i])
	);

	const flags      = await getPlaybookFlags(actor);
	const background = flags?.backgrounds?.find(b => b.slug === selectedBg);
	const bgMoveNames = new Set(background?.moves ?? []);

	let playbookMoves = [];
	if (playbookName) {
		const pack = game.packs.get("stonetop.playbook-moves");
		await pack.getIndex({
			fields: ["system.playbook", "system.isStartingMove", "system.requires",
			         "system.minLevel", "system.stat", "system.description"],
		});
		const entries = pack.index.filter(e => e.system?.playbook === playbookName);
		playbookMoves = buildMovelistContext(entries, ownedByName, bgMoveNames, actorLevel);
	}

	let basicMoves = [];
	const basicPack = game.packs.get("stonetop.basic-moves");
	if (basicPack) {
		await basicPack.getIndex({ fields: ["system.stat"] });
		basicMoves = basicPack.index.map(e => {
			const owned = ownedByName.get(e.name);
			return { name: e.name, compendiumId: e._id, ownedId: owned?._id ?? null, rollType: e.system?.stat ?? null, owned: !!owned };
		});
	}

	const otherGroups = OTHER_MOVE_TYPES.reduce((acc, t) => {
		const items = actor.items.filter(i => i.type === "move" && i.system?.moveType === t);
		if (items.length) acc.push({
			key:   t,
			label: t.charAt(0).toUpperCase() + t.slice(1) + " Moves",
			moves: items.map(i => ({ name: i.name, ownedId: i._id, rollType: i.system?.stat ?? null })),
		});
		return acc;
	}, []);

	return { playbookMoves, basicMoves, otherGroups };
}

export function createStonetopCharacterSheetClass(Base) {
	return class StonetopCharacterSheet extends Base {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["pbta", "stonetop", "sheet", "actor", "character"],
				tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }],
			});
		}

		get template() {
			return "modules/stonetop/templates/actor/character.hbs";
		}

		async getData() {
			const context = await super.getData();
			const flags = await getPlaybookFlags(this.actor);
			const saved = {
				background:  this.actor.getFlag("stonetop", "background")  ?? "",
				instinct:    this.actor.getFlag("stonetop", "instinct")    ?? "",
				appearance:  this.actor.getFlag("stonetop", "appearance")  ?? {},
				origin:      this.actor.getFlag("stonetop", "origin")      ?? "",
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
		}

		async _onBackgroundChange(ev) {
			const slug = ev.currentTarget.value;
			const previousSlug = this.actor.getFlag("stonetop", "background") ?? "";
			await this.actor.setFlag("stonetop", "background", slug);
			if (!previousSlug) {
				const flags = await getPlaybookFlags(this.actor);
				const background = flags?.backgrounds?.find(b => b.slug === slug);
				await setupStartingMoves(this.actor, flags?.backgrounds ?? [], background, flags?.startingPickCount ?? 0);
			}
		}

		async _onAppearanceChange(ev) {
			const el = ev.currentTarget;
			const lineIdx = Number(el.dataset.line);
			const saved = this.actor.getFlag("stonetop", "appearance") ?? {};
			await this.actor.setFlag("stonetop", "appearance", { ...saved, [lineIdx]: el.value });
		}

		async _onOriginNameClick(ev) {
			const name = ev.currentTarget.textContent.trim();
			await this.actor.update({ name });
		}

		async _onMoveCheck(ev) {
			const el = ev.currentTarget;
			if (el.checked) {
				const pack = game.packs.get("stonetop.playbook-moves");
				const doc  = await pack.getDocument(el.dataset.compendiumId);
				await this.actor.createEmbeddedDocuments("Item", [doc.toObject()]);
			} else {
				const ownedId = el.dataset.ownedId;
				if (ownedId) await this.actor.deleteEmbeddedDocuments("Item", [ownedId]);
			}
		}
	};
}
