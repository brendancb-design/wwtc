const fs = require("fs"), vm = require("vm");
const f = process.argv[2];
const src = fs.readFileSync(f, "utf8");
try { new vm.Script(src, { filename: f }); console.log("OK"); }
catch (e) {
  console.log("SYNTAX:", e.message);
  const lines = src.split(/\r?\n/);
  const ln = e.lineNumber || 0, col = e.columnNumber || 0;
  console.log("At line", ln, "col", col);
  for (let i = Math.max(0, ln - 3); i < Math.min(lines.length, ln + 2); i++) {
    console.log(String(i + 1).padStart(4, " ") + ": " + lines[i]);
  }
  process.exit(1);
}
