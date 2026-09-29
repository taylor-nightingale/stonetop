/**
 * How an ink bar wears into stone: which of the two textures, which stretch of it, and which way up.
 *
 * The textures alternate in the order a surface draws its bars, so neighbours differ — chosen from the
 * title instead, four plain bars came out in a row on the Playbook tab. The stretch and the flips come
 * from the title, so a bar keeps its look when the sheet redraws. The stretch is a percentage along
 * the image, which keeps the bar's window inside it however wide the bar is.
 */
export class BarGrain {
	constructor(heavy, position, flipX, flipY) {
		this.heavy    = heavy;
		this.position = position;
		this.flipX    = flipX;
		this.flipY    = flipY;
		this.classes  = [heavy && "stonetop-bar--heavy", flipX && "stonetop-bar--flip-x", flipY && "stonetop-bar--flip-y"]
			.filter(Boolean).join(" ");
		this.style    = `--bar-grain: ${position}%`;
	}

	/** `index` is the bar's place among the bars its own surface draws — the rail, the band, a tab. */
	static of(title, index) {
		const h = [...String(title ?? "")].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
		return new BarGrain(index % 2 === 1, h % 101, Boolean(h & 0x10000), Boolean(h & 0x20000));
	}
}
