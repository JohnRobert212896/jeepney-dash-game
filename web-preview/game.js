import {
  CONFIG,
  applyCrash,
  clamp,
  collectCoin,
  collectFuel,
  collectPassenger,
  createRunState,
  drainFuel,
  missPassenger,
  moveLane,
  rectanglesOverlap,
  speedForDistance,
  updateScore,
} from "./game-core.js";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const ui = {
  menu: document.querySelector("#menuOverlay"),
  pause: document.querySelector("#pauseOverlay"),
  gameOver: document.querySelector("#gameOverOverlay"),
  controls: document.querySelector("#driveControls"),
  start: document.querySelector("#startButton"),
  restart: document.querySelector("#restartButton"),
  resume: document.querySelector("#resumeButton"),
  left: document.querySelector("#leftButton"),
  right: document.querySelector("#rightButton"),
  brake: document.querySelector("#brakeButton"),
  pauseButton: document.querySelector("#pauseButton"),
  soundButton: document.querySelector("#soundButton"),
  menuBest: document.querySelector("#menuBest"),
  finalScore: document.querySelector("#finalScore"),
  finalDistance: document.querySelector("#finalDistance"),
  finalFare: document.querySelector("#finalFare"),
  finalBest: document.querySelector("#finalBest"),
  gameOverReason: document.querySelector("#gameOverReason"),
  status: document.querySelector("#status"),
};

const COLORS = Object.freeze({
  ink: "#071426",
  navy: "#0b1f3a",
  road: "#263442",
  edge: "#d8e1e8",
  yellow: "#ffd34d",
  orange: "#ff8a2b",
  cyan: "#65c9ff",
  green: "#4bd38b",
  red: "#ff5964",
  white: "#f8fbff",
});

let bestScore = loadBestScore();
let run = createRunState(bestScore);
let running = false;
let paused = false;
let braking = false;
let brakePointer = false;
let soundEnabled = true;
let audioContext = null;

let worldSpeed = 315;
let roadOffset = 0;
let sceneryOffset = 0;
let invulnerableFor = 0;
let shake = 0;
let obstacleTimer = 0.9;
let coinTimer = 0.35;
let passengerTimer = 2.4;
let fuelTimer = 9;
let lastFrame = performance.now();
let swipe = null;

const obstacles = [];
const coins = [];
const passengerStops = [];
const fuelPickups = [];
const floaters = [];
const particles = [];

ui.menuBest.textContent = `Best score: ${bestScore}`;
ui.pauseButton.hidden = true;
resizeCanvas();

window.addEventListener("resize", resizeCanvas, { passive: true });
ui.start.addEventListener("click", startGame);
ui.restart.addEventListener("click", startGame);
ui.resume.addEventListener("click", resumeGame);
ui.pauseButton.addEventListener("click", togglePause);
ui.soundButton.addEventListener("click", toggleSound);

bindTap(ui.left, () => steer(-1));
bindTap(ui.right, () => steer(1));

ui.brake.addEventListener("pointerdown", (event) => {
  if (!running || paused) return;
  event.preventDefault();
  ui.brake.setPointerCapture?.(event.pointerId);
  brakePointer = true;
  braking = true;
  ui.brake.classList.add("active");
});

for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
  ui.brake.addEventListener(eventName, releaseBrake);
}

canvas.addEventListener("pointerdown", (event) => {
  if (!running || paused) return;
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  swipe = { id: event.pointerId, startX: event.clientX, used: false };
});

canvas.addEventListener("pointermove", (event) => {
  if (!swipe || swipe.id !== event.pointerId || swipe.used || !running || paused) return;
  const threshold = Math.max(36, canvas.getBoundingClientRect().width * 0.095);
  const difference = event.clientX - swipe.startX;
  if (Math.abs(difference) >= threshold) {
    steer(difference > 0 ? 1 : -1);
    swipe.used = true;
  }
});

for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
  canvas.addEventListener(eventName, () => { swipe = null; });
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  if (event.repeat && event.code !== "Space") return;
  if (event.code === "ArrowLeft" || event.code === "KeyA") steer(-1);
  if (event.code === "ArrowRight" || event.code === "KeyD") steer(1);
  if (event.code === "Space" && running && !paused) {
    braking = true;
    ui.brake.classList.add("active");
  }
  if (event.code === "KeyP" || event.code === "Escape") togglePause();
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    braking = brakePointer;
    if (!braking) ui.brake.classList.remove("active");
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && !paused) pauseGame();
});

requestAnimationFrame(frame);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}


function bindTap(element, action) {
  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    element.classList.add("active");
    action();
  });
  for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
    element.addEventListener(eventName, () => element.classList.remove("active"));
  }
}


function resizeCanvas() {
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CONFIG.width * density;
  canvas.height = CONFIG.height * density;
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.imageSmoothingEnabled = true;
}


function startGame() {
  unlockAudio();
  run = createRunState(bestScore);
  running = true;
  paused = false;
  braking = false;
  brakePointer = false;
  worldSpeed = 315;
  roadOffset = 0;
  sceneryOffset = 0;
  invulnerableFor = 0;
  shake = 0;
  obstacleTimer = 0.9;
  coinTimer = 0.35;
  passengerTimer = 2.4;
  fuelTimer = 9;
  obstacles.length = 0;
  coins.length = 0;
  passengerStops.length = 0;
  fuelPickups.length = 0;
  floaters.length = 0;
  particles.length = 0;
  ui.menu.hidden = true;
  ui.pause.hidden = true;
  ui.gameOver.hidden = true;
  ui.controls.hidden = false;
  ui.pauseButton.hidden = false;
  ui.pauseButton.textContent = "Ⅱ";
  ui.status.textContent = "Nagsimula ang biyahe.";
  lastFrame = performance.now();
}


function steer(direction) {
  if (!running || paused) return;
  const previous = run.lane;
  moveLane(run, direction);
  if (run.lane !== previous) playTone(180 + run.lane * 35, 0.035, "square", 0.018);
}


function releaseBrake() {
  brakePointer = false;
  braking = false;
  ui.brake.classList.remove("active");
}


function togglePause() {
  if (!running) return;
  if (paused) resumeGame();
  else pauseGame();
}


function pauseGame() {
  if (!running) return;
  paused = true;
  releaseBrake();
  ui.pause.hidden = false;
  ui.controls.hidden = true;
  ui.pauseButton.textContent = "▶";
  ui.status.textContent = "Naka-pause ang laro.";
}


function resumeGame() {
  if (!running) return;
  paused = false;
  ui.pause.hidden = true;
  ui.controls.hidden = false;
  ui.pauseButton.textContent = "Ⅱ";
  ui.status.textContent = "Nagpatuloy ang biyahe.";
  lastFrame = performance.now();
}


function toggleSound() {
  soundEnabled = !soundEnabled;
  ui.soundButton.textContent = soundEnabled ? "🔊" : "🔇";
  ui.soundButton.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
  if (soundEnabled) {
    unlockAudio();
    playTone(440, 0.06, "sine", 0.025);
  }
}


function frame(now) {
  const delta = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  if (running && !paused) update(delta);
  else if (!running && !ui.menu.hidden) {
    roadOffset = (roadOffset + 44 * delta) % 126;
    sceneryOffset = (sceneryOffset + 20 * delta) % 210;
  }

  draw();
  requestAnimationFrame(frame);
}


function update(delta) {
  const difficulty = Math.min(run.distance / 1500, 1);
  worldSpeed = speedForDistance(run.distance, braking);
  run.playerX += (run.targetX - run.playerX) * (1 - Math.exp(-delta * 14));
  roadOffset = (roadOffset + worldSpeed * delta) % 126;
  sceneryOffset = (sceneryOffset + worldSpeed * 0.42 * delta) % 210;
  run.distance += worldSpeed * delta / 13;
  drainFuel(run, delta, difficulty, braking);
  updateScore(run);
  invulnerableFor = Math.max(0, invulnerableFor - delta);
  shake = Math.max(0, shake - delta * 22);

  if (run.fuel <= 0) {
    endGame("Naubusan ng gasolina!");
    return;
  }

  obstacleTimer -= delta;
  coinTimer -= delta;
  passengerTimer -= delta;
  fuelTimer -= delta;

  if (obstacleTimer <= 0) {
    spawnObstacle();
    obstacleTimer = randomBetween(1.05, 1.45) - difficulty * 0.24;
  }
  if (coinTimer <= 0) {
    spawnCoinLine();
    coinTimer = randomBetween(1.3, 2.1);
  }
  if (passengerTimer <= 0) {
    passengerStops.push({ lane: randomLane(), y: -125 });
    passengerTimer = randomBetween(4, 5.8);
  }
  if (fuelTimer <= 0) {
    fuelPickups.push({ lane: randomLane(), y: -90, bob: 0 });
    fuelTimer = randomBetween(10.5, 14);
  }

  updateObstacles(delta);
  updateCoins(delta);
  updatePassengers(delta);
  updateFuel(delta);
  updateEffects(delta);
}


function spawnObstacle() {
  let lane = randomLane();
  if (obstacles.some((item) => item.lane === lane && item.y < 115)) lane = (lane + randomInt(1, 2)) % 3;
  const kinds = ["car", "tricycle", "cone", "pothole"];
  const colors = ["#ef476f", "#7b61ff", "#00b4d8", "#43aa8b"];
  obstacles.push({
    lane,
    y: -108,
    kind: kinds[randomInt(0, kinds.length - 1)],
    extra: randomBetween(-15, 55),
    color: colors[randomInt(0, colors.length - 1)],
  });
}


function spawnCoinLine() {
  const lane = randomLane();
  for (let index = 0; index < 3; index += 1) {
    coins.push({ lane, y: -40 - index * 56, spin: randomBetween(0, Math.PI * 2) });
  }
}


function updateObstacles(delta) {
  for (let index = obstacles.length - 1; index >= 0; index -= 1) {
    const obstacle = obstacles[index];
    obstacle.y += (worldSpeed + obstacle.extra) * delta;
    if (rectanglesOverlap(obstacleRect(obstacle), playerRect()) && invulnerableFor <= 0) {
      applyCrash(run);
      invulnerableFor = 1.35;
      shake = 11;
      addFloater("BANG! -1 puso", run.playerX, CONFIG.playerY - 88, COLORS.red);
      burst(run.playerX, CONFIG.playerY, COLORS.orange, 13);
      playCrash();
      vibrate([35, 35, 55]);
      obstacles.splice(index, 1);
      if (run.hearts <= 0) {
        endGame("Nasira ang jeepney!");
        return;
      }
    } else if (obstacle.y > CONFIG.height + 140) {
      obstacles.splice(index, 1);
    }
  }
}


function updateCoins(delta) {
  for (let index = coins.length - 1; index >= 0; index -= 1) {
    const coin = coins[index];
    coin.y += worldSpeed * delta;
    coin.spin += delta * 5;
    const hitbox = { x: CONFIG.laneX[coin.lane] - 24, y: coin.y - 24, width: 48, height: 48 };
    if (rectanglesOverlap(hitbox, playerRect())) {
      collectCoin(run);
      addFloater("+₱1", run.playerX, CONFIG.playerY - 78, COLORS.yellow);
      burst(CONFIG.laneX[coin.lane], coin.y, COLORS.yellow, 6);
      playTone(680, 0.055, "sine", 0.035);
      coins.splice(index, 1);
    } else if (coin.y > CONFIG.height + 60) {
      coins.splice(index, 1);
    }
  }
}


function updatePassengers(delta) {
  for (let index = passengerStops.length - 1; index >= 0; index -= 1) {
    const stop = passengerStops[index];
    stop.y += worldSpeed * delta;
    const hitbox = { x: CONFIG.laneX[stop.lane] - 45, y: stop.y - 66, width: 90, height: 132 };
    if (rectanglesOverlap(hitbox, playerRect()) && braking) {
      const result = collectPassenger(run);
      addFloater(`SAKAY! +₱${result.earned}`, run.playerX, CONFIG.playerY - 94, COLORS.green);
      burst(CONFIG.laneX[stop.lane], stop.y, COLORS.green, 10);
      playPassengerSound(result.fullLoadBonus > 0);
      vibrate(18);
      passengerStops.splice(index, 1);
      if (result.fullLoadBonus > 0) {
        addFloater("PUNO! +₱80", run.playerX, CONFIG.playerY - 128, COLORS.cyan);
        ui.status.textContent = "Puno ang jeepney! May 80 piso bonus.";
      }
    } else if (stop.y > CONFIG.playerY + 120) {
      missPassenger(run);
      passengerStops.splice(index, 1);
    }
  }
}


function updateFuel(delta) {
  for (let index = fuelPickups.length - 1; index >= 0; index -= 1) {
    const pickup = fuelPickups[index];
    pickup.y += worldSpeed * delta;
    pickup.bob += delta * 4;
    const hitbox = { x: CONFIG.laneX[pickup.lane] - 30, y: pickup.y - 38, width: 60, height: 76 };
    if (rectanglesOverlap(hitbox, playerRect())) {
      const amount = Math.round(collectFuel(run, 28));
      addFloater(`GAS +${amount}`, run.playerX, CONFIG.playerY - 82, COLORS.cyan);
      burst(CONFIG.laneX[pickup.lane], pickup.y, COLORS.cyan, 10);
      playTone(330, 0.15, "triangle", 0.04);
      fuelPickups.splice(index, 1);
    } else if (pickup.y > CONFIG.height + 90) {
      fuelPickups.splice(index, 1);
    }
  }
}


function updateEffects(delta) {
  for (let index = floaters.length - 1; index >= 0; index -= 1) {
    floaters[index].y -= 42 * delta;
    floaters[index].life -= delta;
    if (floaters[index].life <= 0) floaters.splice(index, 1);
  }
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 85 * delta;
    particle.life -= delta;
    if (particle.life <= 0) particles.splice(index, 1);
  }
}


function endGame(reason) {
  if (!running) return;
  running = false;
  paused = false;
  releaseBrake();
  updateScore(run);
  if (run.score > bestScore) {
    bestScore = run.score;
    saveBestScore(bestScore);
  }
  ui.controls.hidden = true;
  ui.pauseButton.hidden = true;
  ui.gameOverReason.textContent = reason;
  ui.finalScore.textContent = run.score;
  ui.finalDistance.textContent = `${Math.floor(run.distance)}m`;
  ui.finalFare.textContent = `₱${run.fare}`;
  ui.finalBest.textContent = `Best score: ${bestScore}`;
  ui.menuBest.textContent = `Best score: ${bestScore}`;
  ui.gameOver.hidden = false;
  ui.status.textContent = `${reason} Ang score mo ay ${run.score}.`;
}


function playerRect() {
  return { x: run.playerX - 38, y: CONFIG.playerY - 61, width: 76, height: 122 };
}


function obstacleRect(obstacle) {
  const x = CONFIG.laneX[obstacle.lane];
  if (obstacle.kind === "cone") return { x: x - 24, y: obstacle.y - 30, width: 48, height: 60 };
  if (obstacle.kind === "pothole") return { x: x - 42, y: obstacle.y - 22, width: 84, height: 44 };
  if (obstacle.kind === "tricycle") return { x: x - 40, y: obstacle.y - 55, width: 80, height: 110 };
  return { x: x - 38, y: obstacle.y - 59, width: 76, height: 118 };
}


function addFloater(text, x, y, color) {
  floaters.push({ text, x, y, color, life: 1.05 });
}


function burst(x, y, color, count) {
  for (let index = 0; index < count; index += 1) {
    particles.push({
      x,
      y,
      color,
      size: randomBetween(3, 8),
      vx: randomBetween(-110, 110),
      vy: randomBetween(-160, -45),
      life: randomBetween(0.35, 0.75),
    });
  }
}


function draw() {
  ctx.save();
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  if (shake > 0) ctx.translate(randomBetween(-shake, shake), randomBetween(-shake, shake));
  drawScenery();
  drawRoad();
  passengerStops.forEach(drawPassengerStop);
  fuelPickups.forEach(drawFuel);
  coins.forEach(drawCoin);
  obstacles.forEach(drawObstacle);
  drawJeepney();
  drawParticles();
  drawFloaters();
  ctx.restore();
  drawHud();
}


function drawScenery() {
  ctx.fillStyle = "#173d4f";
  ctx.fillRect(0, CONFIG.roadTop, CONFIG.roadLeft, CONFIG.height - CONFIG.roadTop);
  ctx.fillRect(CONFIG.roadRight, CONFIG.roadTop, CONFIG.width - CONFIG.roadRight, CONFIG.height - CONFIG.roadTop);
  for (let index = 0; index < 7; index += 1) {
    const y = ((index * 168 + sceneryOffset) % 1176) - 168;
    const warm = index % 2 === 0 ? "#f9c74f" : "#90be6d";
    ctx.fillStyle = "#26556c";
    roundedRect(5, y, 48, 116, 6);
    ctx.fillStyle = warm;
    ctx.fillRect(13, y + 22, 13, 16);
    ctx.fillRect(32, y + 22, 13, 16);
    ctx.fillStyle = "#204960";
    roundedRect(487, y + 42, 48, 126, 6);
    ctx.fillStyle = warm;
    ctx.fillRect(495, y + 66, 13, 16);
    ctx.fillRect(514, y + 66, 13, 16);
    ctx.fillStyle = "#44a36f";
    circle(30, y + 143, 18);
    circle(510, y + 18, 20);
  }
}


function drawRoad() {
  ctx.fillStyle = COLORS.road;
  ctx.fillRect(CONFIG.roadLeft, CONFIG.roadTop, CONFIG.roadRight - CONFIG.roadLeft, CONFIG.height - CONFIG.roadTop);
  ctx.fillStyle = COLORS.edge;
  ctx.fillRect(CONFIG.roadLeft, CONFIG.roadTop, 9, CONFIG.height - CONFIG.roadTop);
  ctx.fillRect(CONFIG.roadRight - 9, CONFIG.roadTop, 9, CONFIG.height - CONFIG.roadTop);
  ctx.fillStyle = "rgb(255 255 255 / 58%)";
  for (const dividerX of [201, 339]) {
    for (let index = 0; index < 10; index += 1) {
      const y = CONFIG.roadTop - 95 + index * 126 + roadOffset;
      roundedRect(dividerX - 4, y, 8, 64, 4);
    }
  }
}


function drawObstacle(obstacle) {
  const x = CONFIG.laneX[obstacle.lane];
  const y = obstacle.y;
  if (obstacle.kind === "pothole") {
    ctx.save();
    ctx.scale(1, 0.55);
    ctx.fillStyle = "#111923";
    circle(x, y / 0.55, 40);
    ctx.fillStyle = "#1d2630";
    circle(x - 9, (y - 3) / 0.55, 20);
    ctx.restore();
    return;
  }
  if (obstacle.kind === "cone") {
    ctx.fillStyle = COLORS.orange;
    polygon([[x, y - 34], [x - 27, y + 29], [x + 27, y + 29]]);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x - 31, y + 23, 62, 12);
    return;
  }
  ctx.fillStyle = "#101722";
  roundedRect(x - 41, y - 60, 82, 120, 13);
  ctx.fillStyle = obstacle.color;
  roundedRect(x - 35, y - 54, 70, 108, 11);
  ctx.fillStyle = "#8de1ff";
  roundedRect(x - 27, y - 36, 54, 35, 6);
  ctx.fillStyle = "#fff1a8";
  roundedRect(x - 26, y + 26, 18, 9, 3);
  roundedRect(x + 8, y + 26, 18, 9, 3);
  if (obstacle.kind === "tricycle") {
    ctx.fillStyle = "#101722";
    circle(x - 37, y + 31, 13);
    circle(x + 37, y + 31, 13);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(x - 4, y - 55, 8, 12);
  }
}


function drawCoin(coin) {
  const x = CONFIG.laneX[coin.lane];
  const widthScale = 0.55 + Math.abs(Math.cos(coin.spin)) * 0.45;
  ctx.fillStyle = "#9f6a13";
  ctx.save();
  ctx.translate(x, coin.y);
  ctx.scale(widthScale, 1);
  circle(0, 0, 23);
  ctx.fillStyle = COLORS.yellow;
  circle(0, 0, 18);
  ctx.fillStyle = COLORS.ink;
  text("₱", 0, 8, 22, 900, "center");
  ctx.restore();
}


function drawPassengerStop(stop) {
  const x = CONFIG.laneX[stop.lane];
  const y = stop.y;
  ctx.fillStyle = "rgb(75 211 139 / 22%)";
  roundedRect(x - 48, y - 69, 96, 138, 8);
  ctx.fillStyle = COLORS.green;
  roundedRect(x - 43, y + 48, 86, 13, 5);
  const personX = x + (stop.lane === 2 ? -27 : 27);
  const labelX = x + (stop.lane === 2 ? 20 : -20);
  ctx.fillStyle = COLORS.white;
  text("STOP", labelX, y + 59, 10, 900, "center");
  ctx.fillStyle = "#f1b98f";
  circle(personX, y - 20, 11);
  ctx.fillStyle = "#e84a5f";
  roundedRect(personX - 10, y - 8, 20, 37, 6);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(personX - 9, y + 29, 7, 21);
  ctx.fillRect(personX + 2, y + 29, 7, 21);
}


function drawFuel(pickup) {
  const x = CONFIG.laneX[pickup.lane];
  const y = pickup.y + Math.sin(pickup.bob) * 4;
  ctx.fillStyle = "rgb(101 201 255 / 18%)";
  circle(x, y, 43);
  ctx.fillStyle = "#00a7c4";
  roundedRect(x - 27, y - 35, 54, 70, 8);
  ctx.fillStyle = COLORS.white;
  roundedRect(x - 14, y - 45, 28, 13, 4);
  ctx.fillRect(x - 7, y - 23, 14, 37);
  ctx.fillRect(x - 18, y - 11, 36, 14);
}


function drawJeepney() {
  const x = run.playerX;
  const y = CONFIG.playerY;
  const flash = invulnerableFor > 0 && Math.floor(invulnerableFor * 12) % 2 === 0;
  ctx.save();
  ctx.globalAlpha = flash ? 0.42 : 1;
  ctx.fillStyle = "rgb(0 0 0 / 28%)";
  roundedRect(x - 48, y - 66, 96, 142, 16);
  const gradient = ctx.createLinearGradient(0, y - 65, 0, y + 65);
  gradient.addColorStop(0, COLORS.yellow);
  gradient.addColorStop(1, COLORS.orange);
  ctx.fillStyle = gradient;
  roundedRect(x - 42, y - 65, 84, 130, 14);
  ctx.fillStyle = COLORS.cyan;
  roundedRect(x - 36, y - 48, 72, 39, 7);
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(x - 4, y - 48, 8, 39);
  ctx.fillStyle = "#f2b62f";
  roundedRect(x - 43, y + 19, 86, 31, 7);
  ctx.fillStyle = "#d8324a";
  roundedRect(x - 29, y + 26, 58, 18, 5);
  ctx.fillStyle = COLORS.white;
  text("SAKAY", x, y + 40, 13, 900, "center");
  ctx.fillStyle = "#121a25";
  roundedRect(x - 48, y - 44, 8, 34, 4);
  roundedRect(x + 40, y - 44, 8, 34, 4);
  roundedRect(x - 48, y + 35, 8, 34, 4);
  roundedRect(x + 40, y + 35, 8, 34, 4);
  if (braking) {
    ctx.fillStyle = COLORS.red;
    roundedRect(x - 30, y + 54, 19, 8, 3);
    roundedRect(x + 11, y + 54, 19, 8, 3);
  }
  ctx.restore();
}


function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = clamp(particle.life * 1.8, 0, 1);
    ctx.fillStyle = particle.color;
    circle(particle.x, particle.y, particle.size);
  }
  ctx.globalAlpha = 1;
}


function drawFloaters() {
  for (const floater of floaters) {
    ctx.globalAlpha = clamp(floater.life, 0, 1);
    ctx.fillStyle = floater.color;
    text(floater.text, floater.x, floater.y, 20, 900, "center");
  }
  ctx.globalAlpha = 1;
}


function drawHud() {
  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, CONFIG.width, 94);
  ctx.fillStyle = "#8ca5bd";
  text("SCORE", 18, 24, 13, 850);
  ctx.fillStyle = COLORS.white;
  text(String(run.score).padStart(6, "0"), 18, 53, 26, 900);
  ctx.fillStyle = COLORS.yellow;
  text(`₱${run.fare}`, 178, 52, 24, 900);
  ctx.fillStyle = COLORS.green;
  text(`SAKAY ${run.passengers}/8`, 278, 50, 18, 850);
  ctx.fillStyle = COLORS.red;
  text("♥".repeat(run.hearts), 399, 52, 25, 900);
  ctx.fillStyle = "#637383";
  text("♡".repeat(CONFIG.maxHearts - run.hearts), 399 + run.hearts * 25, 52, 25, 900);
  ctx.fillStyle = "#233447";
  roundedRect(18, 72, 424, 10, 5);
  ctx.fillStyle = run.fuel > 28 ? COLORS.green : COLORS.red;
  roundedRect(18, 72, 424 * run.fuel / CONFIG.maxFuel, 10, 5);
  if (run.combo > 1 && running) {
    ctx.fillStyle = COLORS.green;
    text(`SAKAY COMBO ×${run.combo}`, CONFIG.width / 2, 122, 18, 900, "center");
  }
  ctx.restore();
}


function roundedRect(x, y, width, height, radius) {
  if (width <= 0 || height <= 0) return;
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, safeRadius);
  ctx.fill();
}


function circle(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}


function polygon(points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index][0], points[index][1]);
  ctx.closePath();
  ctx.fill();
}


function text(value, x, y, size, weight = 700, align = "left") {
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x, y);
}


function randomLane() {
  return randomInt(0, 2);
}


function randomInt(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}


function randomBetween(minimum, maximum) {
  return Math.random() * (maximum - minimum) + minimum;
}


function unlockAudio() {
  if (!soundEnabled) return;
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
}


function playTone(frequency, duration, type = "sine", volume = 0.025, delay = 0) {
  if (!soundEnabled) return;
  unlockAudio();
  if (!audioContext) return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}


function playPassengerSound(fullLoad) {
  playTone(420, 0.08, "triangle", 0.035);
  playTone(560, 0.1, "triangle", 0.035, 0.07);
  if (fullLoad) playTone(760, 0.16, "triangle", 0.04, 0.15);
}


function playCrash() {
  playTone(110, 0.18, "sawtooth", 0.045);
  playTone(72, 0.25, "square", 0.025, 0.04);
}


function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}


function loadBestScore() {
  try {
    return Number.parseInt(localStorage.getItem("jeepneyDashBest") || "0", 10) || 0;
  } catch {
    return 0;
  }
}


function saveBestScore(value) {
  try {
    localStorage.setItem("jeepneyDashBest", String(value));
  } catch {
    // The game remains playable when storage is unavailable.
  }
}
