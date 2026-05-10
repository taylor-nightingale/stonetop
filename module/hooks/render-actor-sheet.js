import { StonetopCharacterActor } from "../actors/character/character-actor.js";

export async function onRenderActorSheet(sheet, html) {
	html[0]?.closest(".app")?.classList.add("stonetop");
	switch (sheet.actor.type) {
		case "character": return new StonetopCharacterActor(sheet.actor).renderSheet(sheet, html);
	}
}
