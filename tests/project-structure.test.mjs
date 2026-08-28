import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const requiredFiles = [
  "README.md",
  "godot/project.godot",
  "godot/main.tscn",
  "godot/scripts/main.gd",
  "web-preview/index.html",
  "web-preview/styles.css",
  "web-preview/game-core.js",
  "web-preview/game.js",
  "web-preview/manifest.webmanifest",
  "web-preview/sw.js",
  "web-preview/assets/icon-192.png",
  "web-preview/assets/icon-512.png",
];

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, file)), `required project file is missing: ${file}`);
}

const project = fs.readFileSync(path.join(root, "godot/project.godot"), "utf8");
const scene = fs.readFileSync(path.join(root, "godot/main.tscn"), "utf8");
const script = fs.readFileSync(path.join(root, "godot/scripts/main.gd"), "utf8");
assert.match(project, /run\/main_scene="res:\/\/main\.tscn"/);
assert.match(scene, /res:\/\/scripts\/main\.gd/);
assert.match(script, /extends Node2D/);
assert.match(script, /func start_game\(\)/);
assert.match(script, /func update_passenger_stops\(delta: float\)/);

const manifest = JSON.parse(fs.readFileSync(path.join(root, "web-preview/manifest.webmanifest"), "utf8"));
assert.equal(manifest.display, "standalone");
assert.equal(manifest.orientation, "portrait");
assert.equal(manifest.icons.length, 3);

const html = fs.readFileSync(path.join(root, "web-preview/index.html"), "utf8");
assert.match(html, /<meta name="viewport"/);
assert.match(html, /id="gameCanvas"/);
assert.match(html, /id="brakeButton"/);

console.log("Jeepney Dash project structure test passed.");
