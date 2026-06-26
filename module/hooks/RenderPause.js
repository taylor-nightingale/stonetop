import {info} from "../utils/logger.js";

export function onRenderPause() {

	info("Overriding the default pause spinner.");
	const pause = document.getElementById("pause");
	if (!pause) return;
	const caption = pause.querySelector("figcaption, label, p");
	if (caption) caption.innerText = "Time Frozen";

}
