import { NpcProvenance } from "./NpcProvenance.js";

// The NPC actor a steading person becomes. No `img`: a new npc gets the house icon from
// StonetopNpc.onPreCreate, so a portrait the GM sets later is never in our way.
export class NpcDraft {
	// The villagers are the players' neighbours, so every player can read one from the start — but
	// only the GM may edit it. Foundry's ownership levels: NONE 0, LIMITED 1, OBSERVER 2, OWNER 3.
	static VISIBLE_TO_PLAYERS = { default: 2 };

	constructor(name, description, folderId, provenance) {
		this.name        = name;
		this.description = description;
		this.folderId    = folderId;
		this.provenance  = provenance;
	}

	static fromPerson(person, { folderId, provenance }) {
		return new NpcDraft(person.name, NpcDraft.describe(person), folderId, provenance);
	}

	/** Occupation and traits seed the description once, at creation — never re-synced after. */
	static describe(person) {
		return [person.occupation, person.traits]
			.map(text => (text ?? "").trim())
			.filter(Boolean)
			.join("\n\n");
	}

	toCreateData() {
		return {
			name:      this.name,
			type:      "npc",
			folder:    this.folderId,
			ownership: NpcDraft.VISIBLE_TO_PLAYERS,
			system:    { description: this.description },
			flags:     { [NpcProvenance.SCOPE]: { [NpcProvenance.KEY]: this.provenance.toRaw() } },
		};
	}
}
