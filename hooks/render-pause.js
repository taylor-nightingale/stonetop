import {info} from "../utils/logger.js";

export function onRenderPause() {

	info("Overriding the default pause spinner.");
	const pause = document.getElementById("pause");
	pause.lastElementChild.innerText = "Time Frozen";
	pause.firstElementChild.src = "/modules/stonetop/assets/graphics/pause.png";

}
