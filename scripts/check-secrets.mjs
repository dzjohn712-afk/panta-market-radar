import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const repositoryFiles = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {encoding:"utf8"}).split("\0").filter(Boolean))];
const findings = [];
// Use the configured key only for exact matching; never print its value.
let configuredKey = process.env.PANTA_API_KEY;
if (!configuredKey && existsSync(".env.local")) {
  configuredKey = readFileSync(".env.local", "utf8").match(/^\s*PANTA_API_KEY\s*=\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
}
if (configuredKey === "replace_with_your_server_side_api_key") configuredKey = undefined;

const patterns = [
  [/pk_(?:test|live)_[A-Za-z0-9_-]{12,}/, "Panta key pattern"],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, "JWT pattern"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key pattern"],
];
function inspect(file, browserAsset = false) {
  const text = readFileSync(file, "utf8");
  if (configuredKey && text.includes(configuredKey)) findings.push({file, reason:"Configured API key"});
  for (const [pattern, reason] of patterns) if (pattern.test(text)) findings.push({file, reason});
  if (browserAsset && text.includes("PANTA_API_KEY")) findings.push({file, reason:"Server credential identifier in browser asset"});
}
for (const file of repositoryFiles) {
  if (/(^|\/)\.env($|\.)/.test(file) && file !== ".env.example") findings.push({file, reason:"Environment file in repository"});
  inspect(file);
}
function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}
const browserAssets = filesUnder(".next/static");
for (const file of browserAssets) inspect(file, true);
console.log(JSON.stringify({repositoryFilesScanned:repositoryFiles.length, browserAssetsScanned:browserAssets.length,
  findings, passed:findings.length === 0}, null, 2));
if (findings.length) process.exitCode = 1;
