import {StonetopPlaybook} from "./StonetopPlaybook.js";

export function createStonetopItemClass(BaseItem) {
	return class StonetopItem extends BaseItem {


		/**
		 *
		 * @return {StonetopPlaybook}
		 */
		asPlaybook() {
			return new StonetopPlaybook(this);
		}
	};
}
