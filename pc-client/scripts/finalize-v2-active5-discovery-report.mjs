import fs from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: node finalize-v2-active5-discovery-report.mjs input.csv output.csv");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { field += char; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') { row.push(field); field = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); if (row.length > 1) rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csv(rows) {
  return rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n") + "\n";
}

const rows = parseCsv(fs.readFileSync(input, "utf8"));
const [header, ...body] = rows;
const columns = Object.fromEntries(header.map((value, index) => [value, index]));
const catalog404 = new Set(["pieces-for-developers", "zoom-workplace", "anytype-desktop"]);
const externalUnavailable = new Set(["opera-one", "vrew-desktop", "gitbutler-desktop"]);
for (const row of body) {
  const id = row[columns.productId];
  if (catalog404.has(id)) {
    row[columns.status] = "FAIL";
    row[columns.reason] = "catalog/artifact FAIL: configured official download-page returned HTTP 404 during bounded probe";
  } else if (externalUnavailable.has(id)) {
    row[columns.status] = "BLOCKED";
    row[columns.reason] = "external network BLOCKED: configured official page returned temporary or regional HTTP failure during bounded probe";
  } else if (id === "blender" && row[columns.status] === "FAIL") {
    row[columns.reason] = "catalog/artifact FAIL: download completed at 47,755 bytes before pause although task reserved 536,918,667 bytes; artifact response needs review";
  }
}
fs.writeFileSync(output, csv([header, ...body]));
const result = Object.fromEntries(["PASS", "BLOCKED", "FAIL"].map((status) => [status, body.filter((row) => row[columns.status] === status).length]));
console.log(JSON.stringify({ rows: body.length, result }));
