import { ResourceDef } from "./Resource.js";
import { normalizeRollType } from "../utils/roll-types.js";

export class MoveDefinition {
	constructor(data) {
		this.id          = data._id;
		this.name        = data.name;
		this.playbook    = data.system?.playbook        ?? null;
		this.rollType    = normalizeRollType(data.system?.rollType);
		this.description = data.system?.description     ?? null;
		this.isStarting  = data.system?.isStartingMove  ?? false;
		this.requirement = data.system?.requirement     ?? null;
		this.repeatMax   = data.system?.repeatMax       ?? null;
		this.resource    = data.system?.resource ? new ResourceDef(data.system.resource) : null;
		this.hpBonus     = data.system?.hpBonus         ?? 0;
		this.armorBonus  = data.system?.armorBonus      ?? 0;
		this.loadBonus   = data.system?.loadBonus       ?? 0;
		// Per-option marks (e.g. WBH "Potential for Greatness"): each option carries a
		// checkbox count and optional hp/armor/crewHp effect applied per checked box.
		this.markOptions = data.system?.markOptions     ?? null;
		// Would-Be Hero asterisk trigger: { basicMove, minTotal, question }. Its
		// presence marks the move with "*"; its data drives the become-a-Hero prompt.
		this.asterisk    = data.system?.asterisk        ?? null;
	}
}
