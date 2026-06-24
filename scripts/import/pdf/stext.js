import { execFileSync } from "child_process";

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
function decode(s) {
	return String(s)
		.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
		.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m]);
}

/**
 * Parse `mutool draw -F stext` XML into pages of lines. Each line:
 *   { bbox:[x0,y0,x1,y1], text, font, size, spans:[{font, size, text}] }
 * `spans` preserve per-font runs (so inline bold/italic survive); `font`/`size` are the line's
 * dominant run (most characters). Span text is rebuilt from the per-char `c` attributes.
 */
export function parseStext(xml) {
	const pages = [];
	const pageRe = /<page\b[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"[^>]*>([\s\S]*?)<\/page>/g;
	let pm;
	while ((pm = pageRe.exec(xml))) {
		const width = Number(pm[1]);
		const height = Number(pm[2]);
		const lines = [];
		const lineRe = /<line\b([^>]*)>([\s\S]*?)<\/line>/g;
		let lm;
		while ((lm = lineRe.exec(pm[3]))) {
			const attrs = lm[1];
			const bboxStr = (attrs.match(/\bbbox="([^"]*)"/) || [])[1];
			const bbox = bboxStr ? bboxStr.split(/\s+/).map(Number) : [0, 0, 0, 0];

			const spans = [];
			const fontRe = /<font\b[^>]*\bname="([^"]*)"[^>]*\bsize="([^"]*)"[^>]*>([\s\S]*?)<\/font>/g;
			let fm;
			while ((fm = fontRe.exec(lm[2]))) {
				let text = "";
				const charRe = /<char\b[^>]*\bc="([^"]*)"/g;
				let cm;
				while ((cm = charRe.exec(fm[3]))) text += decode(cm[1]);
				if (text) spans.push({ font: fm[1], size: Number(fm[2]), text });
			}
			// Prefer the line's own text attribute (mutool's canonical join); fall back to spans.
			const textAttr = (attrs.match(/\btext="([^"]*)"/) || [])[1];
			const text = textAttr != null ? decode(textAttr) : spans.map((s) => s.text).join("");
			if (!text.trim()) continue;

			const dominant = spans.reduce((a, b) => (b.text.length > (a?.text.length ?? 0) ? b : a), null);
			lines.push({ bbox, text, font: dominant?.font ?? "", size: dominant?.size ?? 0, spans });
		}
		pages.push({ width, height, lines });
	}
	return pages;
}

/** Run mutool for a page range (e.g. "12-13") and parse. */
export function loadStext(pdfPath, range) {
	const xml = execFileSync("mutool", ["draw", "-F", "stext", "-o", "-", pdfPath, String(range)], {
		encoding: "utf8", maxBuffer: 1 << 28,
	});
	return parseStext(xml);
}
