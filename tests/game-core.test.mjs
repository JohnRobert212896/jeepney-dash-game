import assert from "node:assert/strict";
import {
  CONFIG,
  applyCrash,
  collectCoin,
  collectFuel,
  collectPassenger,
  createRunState,
  drainFuel,
  moveLane,
  rectanglesOverlap,
  speedForDistance,
  updateScore,
} from "../web-preview/game-core.js";

const run = createRunState(1234);
assert.equal(run.lane, 1);
assert.equal(run.bestScore, 1234);
assert.equal(run.fuel, 100);

moveLane(run, -1);
moveLane(run, -1);
assert.equal(run.lane, 0, "lane movement clamps at the left edge");
moveLane(run, 1);
assert.equal(run.lane, 1);
assert.equal(run.targetX, CONFIG.laneX[1]);

assert.equal(rectanglesOverlap(
  { x: 0, y: 0, width: 10, height: 10 },
  { x: 9, y: 9, width: 10, height: 10 }
), true);
assert.equal(rectanglesOverlap(
  { x: 0, y: 0, width: 10, height: 10 },
  { x: 10, y: 10, width: 10, height: 10 }
), false);

const normalSpeed = speedForDistance(0, false);
const brakeSpeed = speedForDistance(0, true);
assert.equal(normalSpeed, 315);
assert.ok(brakeSpeed < normalSpeed, "braking reduces world speed");
assert.ok(speedForDistance(2000, false) > normalSpeed, "difficulty increases speed");

const previousFuel = run.fuel;
drainFuel(run, 1, 0, false);
assert.ok(run.fuel < previousFuel, "fuel drains during a run");
run.fuel = 92;
assert.equal(collectFuel(run, 28), 8, "fuel pickup caps at maximum fuel");
assert.equal(run.fuel, 100);

collectCoin(run);
assert.equal(run.coinCount, 1);
assert.equal(run.fare, 1);

const firstPassenger = collectPassenger(run);
const secondPassenger = collectPassenger(run);
assert.equal(firstPassenger.earned, 12);
assert.equal(secondPassenger.earned, 14, "passenger combo increases the fare");

while (run.passengers < 7) collectPassenger(run);
const fullLoad = collectPassenger(run);
assert.equal(fullLoad.fullLoadBonus, 80);
assert.equal(run.passengers, 0, "full jeepney resets capacity");

assert.equal(applyCrash(run), 2);
assert.equal(run.combo, 0);
run.distance = 100;
assert.equal(updateScore(run), Math.floor(run.distance) + run.fare * 5 + run.coinCount * 10);

console.log("Jeepney Dash core tests passed.");
