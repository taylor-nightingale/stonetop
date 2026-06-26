// GM-facing authoring sheet for "move" Item documents. The fork's only other move sheet
// (StonetopArcanumSheet) is a read-only-ish reader (arcana cards / simple readout); this one
// lets a GM edit a move's mechanics. Bound to THIS fork's MoveModel field shapes — NOT
// taylor-nightingale's (his moveResults match, but his rollStat/choices/categoryKey do not).
//
// Registered as a NON-default alternate sheet for "move": pick it via the sheet header's
// "Sheet" config. The arcanum reader stays the default so arcana cards still render normally.

const MOVE_TYPE_OPTIONS = ["basic", "playbook", "inventory", "arcanum", "special", "post-death", "homefront", "expedition", "follower"];
const ROLL_TYPE_OPTIONS = ["", "str", "dex", "con", "int", "wis", "cha", "ask"];
const COLUMN_OPTIONS    = ["regular", "small"];
const RESULT_KEYS       = ["success", "partial", "failure"];
const RESULT_DEFAULT_LABELS = { success: "10+", partial: "7-9", failure: "6-" };

const _num = (v, fallback = 0) => {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
};
const _str = v => (typeof v === "string" ? v.trim() : "");

/**
 * Build the move-document update from this editor's flat form data (the shape Foundry's
 * FormDataExtended yields). Pure + exported so it can be unit-tested without Foundry.
 *
 * Only the fields this editor manages are written — asterisk / markOptions / loadBonus /
 * shieldLoadReduction / moveEffect / replaces are absent from the returned `system` object,
 * so `document.update()`'s deep merge preserves them untouched. The null-defaulted loose
 * objects (requirement / resource / moveResults) are assembled here and set to null when
 * the GM left them entirely empty (so an empty {} default never makes a move look gated /
 * resourced — see MoveModel's looseObject() note).
 *
 * @param {Record<string, unknown>} flat  Flattened form data (e.g. "system.moveType": "basic").
 * @returns {object}  A document.update() payload.
 */
export function buildMoveUpdate(flat) {
	// Move results — keep only boxes with actual outcome TEXT. The labels are always
	// pre-filled with the canonical "10+/7-9/6-" defaults, so a label alone doesn't count
	// as filled (else every move would store an empty results block). Null when none filled.
	const results = {};
	for (const key of RESULT_KEYS) {
		const label = flat[`system.moveResults.${key}.label`];
		const value = flat[`system.moveResults.${key}.value`];
		if (_str(value)) {
			results[key] = { label: _str(label) || RESULT_DEFAULT_LABELS[key], value };
		}
	}
	const moveResults = Object.keys(results).length ? results : null;

	// Requirement — one move per line in the textarea, plus optional level / playbook gate.
	const moves = String(flat._reqMoves ?? "").split("\n").map(s => s.trim()).filter(Boolean);
	const reqLevel    = flat["system.requirement.level"];
	const reqPlaybook = _str(flat["system.requirement.playbook"]);
	const hasRequirement = moves.length > 0 || (reqLevel != null && reqLevel !== "") || !!reqPlaybook;
	const requirement = hasRequirement
		? { moves, level: (reqLevel != null && reqLevel !== "") ? _num(reqLevel, null) : null, playbook: reqPlaybook || null }
		: null;

	// Resource track (e.g. the Blessed's "Favor", max 4).
	const resTitle = _str(flat["system.resource.title"]);
	const resMax   = flat["system.resource.max"];
	const resource = (resTitle || (resMax != null && resMax !== "" && _num(resMax) > 0))
		? { title: resTitle, max: _num(resMax, 0) }
		: null;

	const update = {
		name: flat.name,
		system: {
			moveType:        flat["system.moveType"] ?? "",
			rollType:        flat["system.rollType"] ?? "",
			description:     flat["system.description"] ?? "",
			playbook:        flat["system.playbook"] ?? "",
			slug:            flat["system.slug"] ?? "",
			repeatMax:       _num(flat["system.repeatMax"], 0),
			isStartingMove:  !!flat["system.isStartingMove"],
			noXpOnMiss:      !!flat["system.noXpOnMiss"],
			weight:          _num(flat["system.weight"], 1),
			inventoryColumn: flat["system.inventoryColumn"] ?? "regular",
			armorBonus:      _num(flat["system.armorBonus"], 0),
			hpBonus:         _num(flat["system.hpBonus"], 0),
			requirement,
			resource,
			moveResults,
		},
	};
	if (flat.img) update.img = flat.img;
	return update;
}

export function createStonetopMoveSheetClass(BaseItemSheet) {
	return class StonetopMoveSheet extends BaseItemSheet {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes:   ["stonetop", "sheet", "item", "stonetop-move-editor"],
				width:     480,
				height:    640,
				template:  "systems/stonetop/templates/item/move-sheet.hbs",
				resizable: true,
			});
		}

		async getData() {
			const data = await super.getData();
			const sys = this.item.system ?? {};
			// Make the template's {{system.*}} / {{item.*}} resolution version-independent.
			data.item   = this.item;
			data.system = sys;

			data.moveTypeOptions = MOVE_TYPE_OPTIONS;
			data.rollTypeOptions = ROLL_TYPE_OPTIONS;
			data.columnOptions   = COLUMN_OPTIONS;

			// Pre-fill the three result boxes so they render even when moveResults is null,
			// with the canonical PbtA outcome labels as placeholders.
			const mr = sys.moveResults ?? {};
			data.results = RESULT_KEYS.map(key => ({
				key,
				label: mr?.[key]?.label ?? RESULT_DEFAULT_LABELS[key],
				value: mr?.[key]?.value ?? "",
			}));

			data.reqMovesText = (sys.requirement?.moves ?? []).join("\n");
			data.reqLevel     = sys.requirement?.level ?? "";
			data.reqPlaybook  = sys.requirement?.playbook ?? "";
			data.resourceTitle = sys.resource?.title ?? "";
			data.resourceMax   = sys.resource?.max ?? "";
			return data;
		}

		async _updateObject(_event, formData) {
			return this.item.update(buildMoveUpdate(formData));
		}
	};
}
