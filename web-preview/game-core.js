export const CONFIG = Object.freeze({
  width: 540,
  height: 960,
  roadLeft: 64,
  roadRight: 476,
  roadTop: 94,
  playerY: 712,
  laneX: Object.freeze([132, 270, 408]),
  maxFuel: 100,
  maxHearts: 3,
  capacity: 8,
});

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function rectanglesOverlap(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

export function createRunState(bestScore = 0) {
  return {
    lane: 1,
    playerX: CONFIG.laneX[1],
    targetX: CONFIG.laneX[1],
    fuel: CONFIG.maxFuel,
    hearts: CONFIG.maxHearts,
    distance: 0,
    fare: 0,
    coinCount: 0,
    passengers: 0,
    combo: 0,
    score: 0,
    bestScore,
  };
}

export function moveLane(run, direction) {
  run.lane = clamp(run.lane + Math.sign(direction), 0, CONFIG.laneX.length - 1);
  run.targetX = CONFIG.laneX[run.lane];
  return run.lane;
}

export function speedForDistance(distance, braking = false) {
  const difficulty = Math.min(distance / 1500, 1);
  const baseSpeed = 315 + difficulty * 175;
  return baseSpeed * (braking ? 0.58 : 1);
}

export function drainFuel(run, seconds, difficulty = 0, braking = false) {
  const drain = seconds * (2.05 + Math.min(difficulty, 1) * 0.8) * (braking ? 0.72 : 1);
  run.fuel = clamp(run.fuel - drain, 0, CONFIG.maxFuel);
  return run.fuel;
}

export function collectCoin(run) {
  run.coinCount += 1;
  run.fare += 1;
  updateScore(run);
  return 1;
}

export function collectFuel(run, amount = 28) {
  const previous = run.fuel;
  run.fuel = clamp(run.fuel + amount, 0, CONFIG.maxFuel);
  return run.fuel - previous;
}

export function collectPassenger(run) {
  run.combo += 1;
  run.passengers += 1;
  const earned = 12 + Math.min(run.combo - 1, 5) * 2;
  run.fare += earned;
  let fullLoadBonus = 0;
  if (run.passengers >= CONFIG.capacity) {
    fullLoadBonus = 80;
    run.fare += fullLoadBonus;
    run.passengers = 0;
  }
  updateScore(run);
  return { earned, fullLoadBonus };
}

export function missPassenger(run) {
  run.combo = 0;
}

export function applyCrash(run) {
  run.hearts = clamp(run.hearts - 1, 0, CONFIG.maxHearts);
  run.combo = 0;
  return run.hearts;
}

export function updateScore(run) {
  run.score = Math.floor(run.distance) + run.fare * 5 + run.coinCount * 10;
  return run.score;
}

