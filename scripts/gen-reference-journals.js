// scripts/gen-reference-journals.js
// Generates packs/src/reference-journals/ from existing pack source files.
// Run with: node scripts/gen-reference-journals.js

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root    = path.join(__dirname, "..");
// Item sources live under the stonetop-items pack-source dir; reference journals
// are staged from this output dir into the merged "Stonetop" journal pack (pack.js).
const src     = path.join(root, "packs", "src", "stonetop-items");
const outDir  = path.join(root, "packs", "src", "stonetop-journals", "reference-journals");

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// Deterministic 16-char id derived from a stable key. Compendium ids must stay
// stable across releases or updating worlds re-seed duplicate journals (the seeder
// matches by compendiumSource uuid — see SeedCompendiums.js), so we never use a
// random id: re-running this generator must be idempotent.
function deterministicId(key) {
    const bytes = crypto.createHash("sha256").update(key).digest();
    let id = "";
    for (let i = 0; i < 16; i++) id += CHARS[bytes[i] % CHARS.length];
    return id;
}

// Reuse the ids already committed for a journal so regeneration keeps existing
// content stable; only genuinely new journals/pages get a fresh (deterministic) id.
async function loadExistingIds(filename) {
    try {
        const doc = JSON.parse(await fs.readFile(path.join(outDir, filename), "utf8"));
        const pages = {};
        for (const p of doc.pages ?? []) if (p?.name) pages[p.name] = p._id;
        return { journalId: doc._id, folder: doc.folder ?? null, pages };
    } catch { return { journalId: null, folder: null, pages: {} }; }
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function readJsonDir(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return []; }
    const docs = [];
    for (const e of entries.filter(e => e.isFile() && e.name.endsWith(".json") && !e.name.startsWith("_"))) {
        docs.push(JSON.parse(await fs.readFile(path.join(dir, e.name), "utf8")));
    }
    return docs.sort((a, b) => a.name.localeCompare(b.name));
}

async function readJsonDirRecursive(dir, filter = () => true) {
    const results = [];
    async function walk(d) {
        let entries;
        try { entries = await fs.readdir(d, { withFileTypes: true }); }
        catch { return; }
        for (const e of entries) {
            if (e.isDirectory()) { await walk(path.join(d, e.name)); }
            else if (e.isFile() && e.name.endsWith(".json") && !e.name.startsWith("_")) {
                const doc = JSON.parse(await fs.readFile(path.join(d, e.name), "utf8"));
                if (filter(doc)) results.push(doc);
            }
        }
    }
    await walk(dir);
    return results.sort((a, b) => a.name.localeCompare(b.name));
}

function makePage(journalId, name, content, sort, existing = { pages: {} }) {
    const pageId = existing.pages?.[name] ?? deterministicId(`${journalId}::${name}`);
    return {
        _id:   pageId,
        _key:  `!journal.pages!${journalId}.${pageId}`,
        name,
        type:  "text",
        title: { show: true, level: 1 },
        image: { caption: "" },
        text:  { format: 1, content },
        video: { controls: true, volume: 0.5 },
        src:   null,
        system: {},
        sort,
        ownership: { default: -1 },
        flags: {},
    };
}

function makeJournal(name, existing, pages) {
    const id = existing.journalId ?? deterministicId(name);
    return {
        _id:       id,
        _key:      `!journal!${id}`,
        name,
        ownership: { default: 0 },
        flags:     { stonetop: {} },
        folder:    existing.folder ?? null,
        sort:      0,
        pages:     pages(id),
    };
}

// ── Move content builder ──────────────────────────────────────────────────

function moveHtml(doc) {
    const desc = doc.system?.description ?? "";
    const roll = doc.system?.rollType ? `<p><em>Roll +${doc.system.rollType.toUpperCase()}</em></p>` : "";
    return `${roll}${desc}`;
}

function moveSectionHtml(moves) {
    return moves.map(m =>
        `<h3>${m.name}</h3>${moveHtml(m)}`
    ).join("\n");
}

// ── 1. Moves Reference Journal ────────────────────────────────────────────

async function buildMovesJournal() {
    const basic     = await readJsonDir(path.join(src, "basic-moves"));
    const expedition = await readJsonDir(path.join(src, "expedition-moves"));
    const homefront = await readJsonDir(path.join(src, "homefront-moves"));
    const follower  = await readJsonDir(path.join(src, "follower-moves"));
    const special   = await readJsonDir(path.join(src, "special-moves"));

    // Post-death moves: ghost / revenant / thrall
    const ghost    = await readJsonDir(path.join(src, "post-death-moves", "ghost"));
    const revenant = await readJsonDir(path.join(src, "post-death-moves", "revenant"));
    const thrall   = await readJsonDir(path.join(src, "post-death-moves", "thrall"));

    const sections = [
        { name: "Basic Moves",       moves: basic },
        { name: "Expedition Moves",  moves: expedition },
        { name: "Homefront Moves",   moves: homefront },
        { name: "Follower Moves",    moves: follower },
        { name: "Special Moves",     moves: special },
        { name: "Post-Death: Ghost",    moves: ghost },
        { name: "Post-Death: Revenant", moves: revenant },
        { name: "Post-Death: Thrall",   moves: thrall },
    ].filter(s => s.moves.length);

    const existing = await loadExistingIds("moves.json");
    return makeJournal("Reference: Moves", existing, (id) =>
        sections.map(({ name, moves }, i) =>
            makePage(id, name, moveSectionHtml(moves), (i + 1) * 100000, existing)
        )
    );
}

// ── 2. Playbook Moves Journal ─────────────────────────────────────────────

async function buildPlaybookMovesJournal() {
    const PLAYBOOKS = [
        "the-blessed", "the-fox", "the-heavy", "the-judge",
        "the-lightbearer", "the-marshal", "the-ranger",
        "the-seeker", "the-would-be-hero",
    ];

    const sections = [];
    for (const slug of PLAYBOOKS) {
        const moves = await readJsonDir(path.join(src, "playbook-moves", slug));
        if (!moves.length) continue;
        const playbookName = moves[0]?.system?.playbook ?? slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        sections.push({ name: playbookName, moves });
    }

    const existing = await loadExistingIds("playbook-moves.json");
    return makeJournal("Reference: Playbook Moves", existing, (id) =>
        sections.map(({ name, moves }, i) =>
            makePage(id, name, moveSectionHtml(moves), (i + 1) * 100000, existing)
        )
    );
}

// ── 3. Inventory Items Journal ────────────────────────────────────────────

async function buildInventoryJournal() {
    const items = await readJsonDir(path.join(src, "inventory-items"));

    // Group into small / regular columns
    const small   = items.filter(i => i.flags?.stonetop?.inventoryColumn === "small");
    const regular = items.filter(i => i.flags?.stonetop?.inventoryColumn !== "small");

    function itemRow(item) {
        const st    = item.flags?.stonetop ?? {};
        const tags  = st.note  ? ` ${st.note}` : "";
        const wt    = st.weight != null ? st.weight : "";
        const res   = st.resource?.labels?.length
            ? ` (${st.resource.labels.map(l => `○ ${l}`).join(", ")})`
            : st.resource?.max ? ` (${Array(st.resource.max).fill("○").join("")})` : "";
        return `<tr><td>${item.name}${tags}</td><td style="text-align:center">${wt}</td><td>${res}</td></tr>`;
    }

    function table(items) {
        if (!items.length) return "";
        return `<table><thead><tr><th>Item</th><th>Wt</th><th>Uses/Notes</th></tr></thead><tbody>
${items.map(itemRow).join("\n")}
</tbody></table>`;
    }

    const content =
        `<h3>Regular Items</h3>${table(regular)}<h3>Small Items</h3>${table(small)}`;

    const existing = await loadExistingIds("inventory-items.json");
    return makeJournal("Reference: Inventory Items", existing, (id) => [
        makePage(id, "Inventory Items", content, 100000, existing),
    ]);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
    await fs.mkdir(outDir, { recursive: true });

    const [movesJournal, playbookJournal, inventoryJournal] = await Promise.all([
        buildMovesJournal(),
        buildPlaybookMovesJournal(),
        buildInventoryJournal(),
    ]);

    const writes = [
        ["moves.json",            movesJournal],
        ["playbook-moves.json",   playbookJournal],
        ["inventory-items.json",  inventoryJournal],
    ];

    await Promise.all(writes.map(([name, data]) =>
        fs.writeFile(path.join(outDir, name), JSON.stringify(data, null, 2))
    ));

    console.log("✓ Written to packs/src/stonetop-journals/reference-journals/");
    for (const [name, data] of writes) {
        console.log(`  ${name} (${data.pages.length} page${data.pages.length !== 1 ? "s" : ""})`);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
