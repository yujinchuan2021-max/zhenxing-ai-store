import fs from "node:fs";

const [input, output, markdown, ...rechecks] = process.argv.slice(2);
if (!input || !output || !markdown || !rechecks.length) {
  throw new Error("usage: node merge-acceptance-rechecks.mjs input.csv output.csv output.md recheck.csv [...]");
}

function parse(text) {
  const records = []; let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') { field += character; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") { row.push(field); field = ""; }
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); if (row.length > 1) records.push(row); row = []; field = "";
    } else field += character;
  }
  if (field || row.length) { row.push(field); records.push(row); }
  return records;
}

function write(rows) {
  return rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n") + "\n";
}

const rows = parse(fs.readFileSync(input, "utf8"));
const [header, ...body] = rows;
const productIdColumn = header.indexOf("productId");
if (productIdColumn < 0) throw new Error("input is not an acceptance CSV");
const replacements = new Map();
for (const file of rechecks) {
  const [, replacement] = parse(fs.readFileSync(file, "utf8"));
  if (!replacement?.[productIdColumn]) throw new Error(`invalid recheck: ${file}`);
  replacements.set(replacement[productIdColumn], replacement);
}
const ids = new Set();
for (let index = 0; index < body.length; index += 1) {
  const id = body[index][productIdColumn];
  if (ids.has(id)) throw new Error(`duplicate productId: ${id}`);
  ids.add(id);
  if (replacements.has(id)) body[index] = replacements.get(id);
}
if ([...replacements].some(([id]) => !ids.has(id))) throw new Error("recheck product is absent from input");
fs.writeFileSync(output, write([header, ...body]));
const status = Object.fromEntries(["PASS", "BLOCKED", "FAIL"].map((value) => [value, body.filter((row) => row[header.indexOf("status")] === value).length]));
fs.writeFileSync(markdown, `# v2 active6 / 0.1.54 265 Windows desktop validation\n\n- Rows: ${body.length}; unique productIds: ${ids.size}.\n- Result: ${JSON.stringify(status)}.\n- Rechecked and replaced: ${[...replacements].join(", ")}.\n- Direct downloads use real packaged IPC with bounded bytes; no third-party installer was launched. Native cancellation confirmation remains user acceptance, not automation success.\n`, "utf8");
console.log(JSON.stringify({ rows: body.length, unique: ids.size, status, replaced: [...replacements] }));
