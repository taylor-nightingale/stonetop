/**
 * The sidebar's Actors tab, with the playbook beside each character's name.
 *
 * A directory renders its rows through `_entryPartial` — core's own `SceneDirectory` overrides
 * exactly this static, and the mechanism is unchanged between v13 and v14. Pointing it at our own
 * copy of core's row is what keeps the note in a template: the alternative, rewriting the rendered
 * markup in a `renderActorDirectory` hook, builds game text out of JS strings and re-does it on
 * every render.
 *
 * Built from whatever class is registered rather than from `ActorDirectory` itself, so a module that
 * got there first keeps its behaviour — the same courtesy the document classes extend.
 */
export function createStonetopActorDirectoryClass(BaseDirectory) {
	return class StonetopActorDirectory extends BaseDirectory {
		static _entryPartial = "systems/stonetop/templates/sidebar/actor-entry.hbs";
	};
}
