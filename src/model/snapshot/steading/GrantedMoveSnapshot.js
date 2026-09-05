import { moveIcon } from "../../../actors/embeddedMoves.js";
import { toSlug } from "../../../utils/slug.js";

/**
 * A move an improvement CONFERS, as the sheet draws it.
 *
 * Deliberately thin — a name and an icon. The move's own words are already on the line that grants
 * it (the book writes these as a trigger and three result tiers, and that prose IS the result's
 * text), so a full move card here would print the same sentences twice. What the sheet adds is the
 * one thing the prose cannot: something to roll.
 */
export class GrantedMoveSnapshot {
	constructor(entry) {
		this.slug = entry?.system?.slug ?? toSlug(entry?.name ?? "");
		this.name = entry?.name ?? this.slug;
		this.icon = moveIcon(entry);
	}
}
