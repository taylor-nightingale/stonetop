// Dev helper: capture compact line/span fixtures for the sample articles from the local PDF,
// so layout tests run on real (CC-licensed) book content without the multi-MB raw stext XML.
// Run: node scripts/import/pdf/capture-fixtures.js
import { writeFileSync } from "fs";
import path from "path";
import { loadStext } from "./stext.js";
import { FORK_ROOT } from "../config.js"; // unused; kept for parity

const PDF = process.env.BOOK_PDF
	?? "helper/Book_II_-_The_Wider_World_and_Other_Wonders.pdf";
const OUT = "tests/import/pdf/fixtures";

const SAMPLES = [
	{ name: "aratis", range: "12-13" },
	{ name: "crombil", range: "32" },
	{ name: "marshedge", range: "138-140" },
];

for (const { name, range } of SAMPLES) {
	const pages = loadStext(PDF, range);
	const file = path.join(OUT, `${name}.lines.json`);
	writeFileSync(file, JSON.stringify(pages));
	const lines = pages.reduce((n, p) => n + p.lines.length, 0);
	console.log(`wrote ${file} — ${pages.length} page(s), ${lines} lines`);
}
