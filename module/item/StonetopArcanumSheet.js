import { majorArcanaImg } from "../arcana-icons.js";
import { ITEM_FLAG_SCOPE } from "../actors/character/StonetopFlags.js";
import { centerArcanumTracks, wrapStonetopGlyphsInEl } from "../utils/glyphs.js";
import { markValueTooltips } from "../utils/value-tooltips.js";

export function createStonetopArcanumSheetClass(BaseItemSheet) {
	return class StonetopArcanumSheet extends BaseItemSheet {
		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "item", "stonetop-arcanum-sheet"],
				width: 460,
				height: "auto",
				template: "systems/stonetop/templates/item/arcanum-sheet.hbs",
				resizable: true,
			});
		}

		async getData() {
			const data = await super.getData();
			const flags = this.item.flags?.[ITEM_FLAG_SCOPE] ?? {};
			data.isArcanum = this.item.system?.moveType === "arcanum";

			// This is the only system item sheet registered for the "move" subtype, so
			// the sheet registry resolves it as the default for *every* move item that
			// has no explicit `flags.core.sheetClass` — including plain inventory items
			// (the Setting Overview's Livestock & Beasts links: Dog, Goat, Sheep) and
			// basic/special moves. Those carry no front/back glyph tracks, so render a
			// plain read-only readout instead of an empty Arcanum card.
			if (!data.isArcanum) {
				data.simple = {
					name:        this.item.name,
					weight:      flags.weight ?? null,
					note:        flags.note ?? "",
					description: this.item.system?.description ?? "",
				};
				return data;
			}

			// Deep-clone before transforming so we never mutate the item's live flags.
			const front = foundry.utils.deepClone(flags.front ?? {});
			const back  = foundry.utils.deepClone(flags.back ?? {});
			if (front.description)         front.description         = centerArcanumTracks(front.description);
			if (front.unlock?.description) front.unlock.description  = centerArcanumTracks(front.unlock.description);
			if (back.description)          back.description          = centerArcanumTracks(back.description);
			data.front = front;
			data.back = back;
			data.slug = flags.slug ?? "";
			data.arcanaImg = majorArcanaImg(flags.slug);
			return data;
		}

		// This is the registered sheet for every "move"-type item — arcana, plus the
		// plain inventory items (violet lotus, etc.). Give their "Value N" mentions the
		// same hover tooltip the journals and actor sheets show. Self-gated by setting.
		activateListeners(html) {
			super.activateListeners(html);
			const root = html?.[0] ?? html;
			markValueTooltips(root);
			// Render inline glyphs (◇ charge tracks, □ move boxes, ▶ arrows) as SVG, the
			// same as the character sheet's arcana cards — centerArcanumTracks only moves
			// standalone tracks onto their own line; it doesn't swap the raw Unicode for art.
			root?.querySelectorAll(".stonetop-arcanum-body").forEach(el => wrapStonetopGlyphsInEl(el));
		}
	};
}
