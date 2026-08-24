import {FakeActorScaffold} from "./FakeActorScaffold.js";

// Builds a fake `npc`-type actor (flat creature system) for StonetopNpc / NPC-sheet tests. Owns the
// npc system shape; composes a FakeActorScaffold for the shared name/items/flags/handoff plumbing,
// so tests never poke fields onto the actor after build() — see [[no-direct-mutation-after-builder]].
export class FakeNpcActorBuilder {
	_scaffold = new FakeActorScaffold("Grix");
	_hp = {value: 0, max: 0};
	_armor = "";
	_damage = "";
	_specialQuality = "";
	_instinct = "";
	_description = "";
	_moves = "";
	_tagList = "";
	_tagOptions = [];

	// Shared plumbing — delegated to the scaffold.
	withName(name)  { this._scaffold.setName(name); return this; }
	withItems(items) { this._scaffold.setItems(items); return this; }
	addItem(item)   { this._scaffold.addItem(item); return this; }
	// Wire the typed-actor wrapper (e.g. a => new StonetopNpc(a)) without assigning typedActor after build().
	withTypedActor(factory) { this._scaffold.setTypedActor(factory); return this; }
	withFlag(key, value) { this._scaffold.flagsBuilder.withFlag(key, value); return this; }
	withFlags(flags) { this._scaffold.flagsBuilder.withFlags(flags); return this; }

	withHp(current, max)  { this._hp = {value: current, max}; return this; }
	withArmor(armor)      { this._armor = armor; return this; }
	withDamage(damage)    { this._damage = damage; return this; }
	withSpecialQuality(v) { this._specialQuality = v; return this; }
	withInstinct(instinct) { this._instinct = instinct; return this; }
	withDescription(desc) { this._description = desc; return this; }
	withMoves(moves)      { this._moves = moves; return this; }
	withTagList(tagList)  { this._tagList = tagList; return this; }
	withTagOptions(opts)  { this._tagOptions = opts; return this; }

	buildSystem() {
		return {
			hp:             this._hp,
			armor:          this._armor,
			damage:         this._damage,
			specialQuality: this._specialQuality,
			instinct:       this._instinct,
			description:    this._description,
			moves:          this._moves,
			tagList:        this._tagList,
			tagOptions:     this._tagOptions,
		};
	}

	build() {
		return this._scaffold.build("npc", this.buildSystem());
	}
}
