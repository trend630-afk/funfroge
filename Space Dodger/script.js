const BEST_SCORE_KEY = "funfroge-space-dodger-best";
const STARTING_LIVES = 3;
const PLAYER_RADIUS = 17;
const MAX_ASTEROIDS = 34;
const MAX_PARTICLES = 120;

const stage = document.querySelector("#gameStage");
const canvas = document.querySelector("#gameCanvas");
const context = canvas.getContext("2d");
const scoreValue = document.querySelector("#scoreValue");
const survivalValue = document.querySelector("#survivalValue");
const bestValue = document.querySelector("#bestValue");
const livesValue = document.querySelector("#livesValue");
const sectorLabel = document.querySelector("#sectorLabel");
const shieldStatus = document.querySelector("#shieldStatus");
const shieldLabel = document.querySelector("#shieldLabel");
const gameOverlay = document.querySelector("#gameOverlay");
const overlayKicker = document.querySelector("#overlayKicker");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayCopy = document.querySelector("#overlayCopy");
const finalStats = document.querySelector("#finalStats");
const finalScore = document.querySelector("#finalScore");
const finalTime = document.querySelector("#finalTime");
const finalBest = document.querySelector("#finalBest");
const recordMessage = document.querySelector("#recordMessage");
const startButton = document.querySelector("#startButton");
const startButtonLabel = document.querySelector("#startButtonLabel");
const backGamesLink = document.querySelector("#backGamesLink");
const hitFlash = document.querySelector("#hitFlash");
const soundButton = document.querySelector("#soundButton");
const soundLabel = document.querySelector("#soundLabel");
const moveLeftButton = document.querySelector("#moveLeftButton");
const moveRightButton = document.querySelector("#moveRightButton");
const gameAnnouncement = document.querySelector("#gameAnnouncement");

let width = 0;
let height = 0;
let pixelRatio = 1;
let gameState = "ready";
let animationFrameId = null;
let lastFrameTime = 0;
let elapsedTime = 0;
let score = 0;
let bestScore = readBestScore();
let lives = STARTING_LIVES;
let shieldUntil = 0;
let invulnerableUntil = 0;
let nextAsteroidIn = 0.55;
let nextPowerupAt = 8;
let powerup = null;
let asteroids = [];
let particles = [];
let stars = [];
let soundEnabled = true;
let audioContext = null;
let activePointer = null;
let dragTargetX = null;
let leftHeld = false;
let rightHeld = false;
let hudSecond = -1;
let lastShieldLabel = "";

const player = { x: 0, y: 0, velocityX: 0, radius: PLAYER_RADIUS };
const randomRange = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);

function readBestScore() {
	try {
		const storedValue = Number(localStorage.getItem(BEST_SCORE_KEY));
		return Number.isSafeInteger(storedValue) && storedValue >= 0 ? storedValue : 0;
	} catch {
		return 0;
	}
}

function saveBestScore() {
	try {
		localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
	} catch {
		gameAnnouncement.textContent = "Best score could not be saved in this browser.";
	}
}

function formatTime(seconds) {
	const wholeSeconds = Math.max(0, Math.floor(seconds));
	const minutes = String(Math.floor(wholeSeconds / 60)).padStart(2, "0");
	const remainder = String(wholeSeconds % 60).padStart(2, "0");
	return `${minutes}:${remainder}`;
}

function updateHud(force = false) {
	const displayedSecond = Math.floor(elapsedTime);
	if (force || displayedSecond !== hudSecond) {
		hudSecond = displayedSecond;
		scoreValue.textContent = String(score);
		survivalValue.textContent = formatTime(elapsedTime);
		bestValue.textContent = String(bestScore);
		livesValue.textContent = `${lives} / ${STARTING_LIVES}`;
		livesValue.setAttribute("aria-label", `${lives} ${lives === 1 ? "life" : "lives"} remaining`);
		sectorLabel.textContent = `SECTOR ${String(Math.min(99, Math.floor(elapsedTime / 15) + 1)).padStart(2, "0")}`;
	}

	const shieldActive = shieldUntil > elapsedTime;
	shieldStatus.classList.toggle("is-active", shieldActive);
	const currentShieldLabel = shieldActive ? `SHIELD ACTIVE · ${Math.ceil(shieldUntil - elapsedTime)}s` : "SHIELD OFFLINE";
	if (currentShieldLabel !== lastShieldLabel) {
		lastShieldLabel = currentShieldLabel;
		shieldLabel.textContent = currentShieldLabel;
	}
}

function resizeCanvas() {
	const bounds = stage.getBoundingClientRect();
	width = Math.max(1, bounds.width);
	height = Math.max(1, bounds.height);
	pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = Math.round(width * pixelRatio);
	canvas.height = Math.round(height * pixelRatio);
	context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	player.y = height - 45;
	player.x = Math.max(PLAYER_RADIUS + 10, Math.min(width - PLAYER_RADIUS - 10, player.x || width / 2));
	createStars();
	drawScene();
}

function createStars() {
	const starCount = Math.max(42, Math.min(110, Math.round(width * height / 4200)));
	stars = Array.from({ length: starCount }, () => ({
		x: Math.random() * width,
		y: Math.random() * height,
		radius: randomRange(0.45, 1.5),
		twinkle: randomRange(0.3, 1),
		phase: randomRange(0, Math.PI * 2),
		speed: randomRange(0.8, 8)
	}));
}

function createAsteroid() {
	if (asteroids.length >= MAX_ASTEROIDS) return;
	const difficulty = Math.min(1, elapsedTime / 95);
	const radius = randomRange(13, 23 + difficulty * 5);
	const sides = Math.floor(randomRange(7, 11));
	const points = Array.from({ length: sides }, () => randomRange(0.75, 1.15));
	asteroids.push({
		x: randomRange(radius, Math.max(radius, width - radius)),
		y: -radius - 8,
		radius,
		sides,
		points,
		rotation: randomRange(0, Math.PI * 2),
		spin: randomRange(-1.2, 1.2),
		speed: randomRange(105, 155) + difficulty * randomRange(45, 115),
		drift: randomRange(-22, 22),
		color: Math.random() < 0.62 ? "#ff9d61" : "#ea7183"
	});
}

function createPowerup() {
	const radius = 14;
	powerup = {
		x: randomRange(radius + 5, Math.max(radius + 5, width - radius - 5)),
		y: -radius - 8,
		radius,
		phase: 0,
		speed: 95 + Math.min(55, elapsedTime * 0.45)
	};
}

function spawnParticles(x, y, color, amount = 12) {
	for (let index = 0; index < amount && particles.length < MAX_PARTICLES; index += 1) {
		const angle = Math.random() * Math.PI * 2;
		const speed = randomRange(28, 125);
		particles.push({
			x,
			y,
			velocityX: Math.cos(angle) * speed,
			velocityY: Math.sin(angle) * speed,
			life: randomRange(0.22, 0.52),
			maxLife: 0.52,
			radius: randomRange(1.1, 2.6),
			color
		});
	}
}

function getAudioContext() {
	if (!soundEnabled) return null;
	const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
	if (!AudioContextConstructor) return null;
	try {
		audioContext ??= new AudioContextConstructor();
		if (audioContext.state === "suspended") audioContext.resume();
		return audioContext;
	} catch {
		return null;
	}
}

function playTone(frequency, duration, startOffset = 0, type = "sine", volume = 0.06) {
	const audio = getAudioContext();
	if (!audio) return;
	const oscillator = audio.createOscillator();
	const gain = audio.createGain();
	const startAt = audio.currentTime + startOffset;
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, startAt);
	gain.gain.setValueAtTime(0.0001, startAt);
	gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
	oscillator.connect(gain);
	gain.connect(audio.destination);
	oscillator.start(startAt);
	oscillator.stop(startAt + duration + 0.02);
}

function playSound(effect) {
	if (!soundEnabled) return;
	if (effect === "start") {
		playTone(390, 0.12, 0, "triangle");
		playTone(620, 0.15, 0.08, "triangle");
	} else if (effect === "shield") {
		playTone(720, 0.12, 0, "sine");
		playTone(990, 0.18, 0.08, "sine");
	} else if (effect === "collision") {
		playTone(160, 0.16, 0, "sawtooth", 0.045);
		playTone(110, 0.2, 0.08, "triangle", 0.04);
	} else if (effect === "gameOver") {
		playTone(330, 0.2, 0, "sine");
		playTone(220, 0.28, 0.13, "sine");
	} else if (effect === "record") {
		playTone(660, 0.14, 0, "triangle");
		playTone(880, 0.2, 0.09, "triangle");
	}
}

function drawBackground(deltaSeconds) {
	const gradient = context.createLinearGradient(0, 0, 0, height);
	gradient.addColorStop(0, "#08121d");
	gradient.addColorStop(0.72, "#0b131c");
	gradient.addColorStop(1, "#10151d");
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);

	for (const star of stars) {
		if (gameState === "running") star.y = (star.y + star.speed * deltaSeconds) % height;
		star.phase += deltaSeconds * (0.7 + star.twinkle);
		const alpha = 0.28 + (Math.sin(star.phase) + 1) * 0.25;
		context.globalAlpha = alpha;
		context.fillStyle = star.twinkle > 0.82 ? "#8df7ef" : "#d8e8f4";
		context.beginPath();
		context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
		context.fill();
	}
	context.globalAlpha = 1;

	const horizon = context.createLinearGradient(0, height * 0.64, 0, height);
	horizon.addColorStop(0, "rgba(23, 68, 79, 0)");
	horizon.addColorStop(1, "rgba(23, 68, 79, 0.16)");
	context.fillStyle = horizon;
	context.fillRect(0, height * 0.64, width, height * 0.36);
}

function drawShip() {
	const blink = elapsedTime < invulnerableUntil && Math.floor(elapsedTime * 12) % 2 === 0;
	if (blink) return;
	context.save();
	context.translate(player.x, player.y);
	const flameLength = 8 + Math.sin(elapsedTime * 18) * 2.5;
	context.shadowColor = "#55e8ff";
	context.shadowBlur = 16;
	context.fillStyle = "#ffba67";
	context.beginPath();
	context.moveTo(-6, 16);
	context.lineTo(0, 16 + flameLength);
	context.lineTo(6, 16);
	context.closePath();
	context.fill();

	context.shadowColor = "#50e9f3";
	context.shadowBlur = 19;
	const shipGradient = context.createLinearGradient(0, -20, 0, 17);
	shipGradient.addColorStop(0, "#f4ffff");
	shipGradient.addColorStop(0.48, "#70ebf0");
	shipGradient.addColorStop(1, "#398da8");
	context.fillStyle = shipGradient;
	context.beginPath();
	context.moveTo(0, -20);
	context.lineTo(15, 13);
	context.lineTo(7, 10);
	context.lineTo(0, 15);
	context.lineTo(-7, 10);
	context.lineTo(-15, 13);
	context.closePath();
	context.fill();
	context.shadowBlur = 0;
	context.fillStyle = "#102332";
	context.beginPath();
	context.ellipse(0, 0, 4.2, 7, 0, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = "#d6ffff";
	context.beginPath();
	context.arc(0, -1, 2, 0, Math.PI * 2);
	context.fill();

	if (shieldUntil > elapsedTime) {
		context.strokeStyle = `rgba(72, 230, 232, ${0.58 + Math.sin(elapsedTime * 8) * 0.12})`;
		context.lineWidth = 2;
		context.shadowColor = "#48e6e8";
		context.shadowBlur = 15;
		context.beginPath();
		context.arc(0, 0, 28 + Math.sin(elapsedTime * 5) * 1.5, 0, Math.PI * 2);
		context.stroke();
	}
	context.restore();
}

function drawAsteroid(asteroid) {
	context.save();
	context.translate(asteroid.x, asteroid.y);
	context.rotate(asteroid.rotation);
	context.shadowColor = asteroid.color;
	context.shadowBlur = 13;
	context.fillStyle = "#4a3736";
	context.strokeStyle = asteroid.color;
	context.lineWidth = 1.6;
	context.beginPath();
	for (let point = 0; point < asteroid.sides; point += 1) {
		const angle = (point / asteroid.sides) * Math.PI * 2;
		const radius = asteroid.radius * asteroid.points[point];
		const x = Math.cos(angle) * radius;
		const y = Math.sin(angle) * radius;
		if (point === 0) context.moveTo(x, y);
		else context.lineTo(x, y);
	}
	context.closePath();
	context.fill();
	context.stroke();
	context.shadowBlur = 0;
	context.strokeStyle = "rgba(255, 196, 151, 0.34)";
	context.lineWidth = 1;
	context.beginPath();
	context.moveTo(-asteroid.radius * 0.36, -asteroid.radius * 0.12);
	context.lineTo(asteroid.radius * 0.12, -asteroid.radius * 0.32);
	context.lineTo(asteroid.radius * 0.34, asteroid.radius * 0.08);
	context.stroke();
	context.restore();
}

function drawPowerup() {
	if (!powerup) return;
	context.save();
	context.translate(powerup.x, powerup.y);
	const pulse = 1 + Math.sin(powerup.phase * 4) * 0.08;
	context.scale(pulse, pulse);
	context.shadowColor = "#53f0eb";
	context.shadowBlur = 18;
	context.fillStyle = "rgba(37, 191, 196, 0.28)";
	context.strokeStyle = "#7afff4";
	context.lineWidth = 1.7;
	context.beginPath();
	context.arc(0, 0, powerup.radius, 0, Math.PI * 2);
	context.fill();
	context.stroke();
	context.shadowBlur = 0;
	context.fillStyle = "#d8ffff";
	context.font = "bold 15px sans-serif";
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText("S", 0, 1);
	context.restore();
}

function drawParticles() {
	for (const particle of particles) {
		context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
		context.fillStyle = particle.color;
		context.shadowColor = particle.color;
		context.shadowBlur = 8;
		context.beginPath();
		context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
		context.fill();
	}
	context.globalAlpha = 1;
	context.shadowBlur = 0;
}

function drawScene(deltaSeconds = 0) {
	if (!context || width <= 0 || height <= 0) return;
	drawBackground(deltaSeconds);
	for (const asteroid of asteroids) drawAsteroid(asteroid);
	drawPowerup();
	drawParticles();
	drawShip();
}

function circleCollision(firstX, firstY, firstRadius, secondX, secondY, secondRadius) {
	const distanceX = firstX - secondX;
	const distanceY = firstY - secondY;
	const combinedRadius = firstRadius + secondRadius;
	return distanceX * distanceX + distanceY * distanceY <= combinedRadius * combinedRadius;
}

function flashHit() {
	hitFlash.classList.remove("is-visible");
	void hitFlash.offsetWidth;
	hitFlash.classList.add("is-visible");
}

function collectPowerup() {
	powerup = null;
	shieldUntil = elapsedTime + 8;
	updateHud(true);
	gameAnnouncement.textContent = "Shield active. It blocks one collision for up to eight seconds.";
	playSound("shield");
	spawnParticles(player.x, player.y, "#6ffff3", 18);
}

function handleCollision(asteroid, asteroidIndex) {
	asteroids.splice(asteroidIndex, 1);
	invulnerableUntil = elapsedTime + 1.2;
	flashHit();
	spawnParticles(player.x, player.y, "#ff8292", 17);
	if (shieldUntil > elapsedTime) {
		shieldUntil = 0;
		gameAnnouncement.textContent = "Shield absorbed the asteroid. Shield depleted.";
	} else {
		lives = Math.max(0, lives - 1);
		gameAnnouncement.textContent = `${lives} ${lives === 1 ? "life" : "lives"} remaining.`;
	}
	updateHud(true);
	playSound("collision");
	if (lives <= 0) finishGame();
}

function updateGame(deltaSeconds) {
	elapsedTime += deltaSeconds;
	score = Math.floor(elapsedTime * 10);

	const direction = Number(rightHeld) - Number(leftHeld);
	if (dragTargetX !== null) {
		player.x += (dragTargetX - player.x) * Math.min(1, deltaSeconds * 16);
		if (Math.abs(dragTargetX - player.x) < 1) dragTargetX = null;
	} else {
		player.x += direction * (285 + Math.min(60, elapsedTime * 0.6)) * deltaSeconds;
	}
	player.x = Math.max(PLAYER_RADIUS + 8, Math.min(width - PLAYER_RADIUS - 8, player.x));

	const difficulty = Math.min(1, elapsedTime / 100);
	nextAsteroidIn -= deltaSeconds;
	if (nextAsteroidIn <= 0) {
		createAsteroid();
		const minimumGap = 0.34 - difficulty * 0.08;
		const maximumGap = 0.78 - difficulty * 0.2;
		nextAsteroidIn = randomRange(minimumGap, maximumGap);
	}

	if (!powerup && elapsedTime >= nextPowerupAt) {
		createPowerup();
		nextPowerupAt = elapsedTime + randomRange(12, 18);
	}

	for (let index = asteroids.length - 1; index >= 0; index -= 1) {
		const asteroid = asteroids[index];
		asteroid.y += asteroid.speed * deltaSeconds;
		asteroid.x += asteroid.drift * deltaSeconds;
		asteroid.rotation += asteroid.spin * deltaSeconds;
		if (asteroid.x < asteroid.radius || asteroid.x > width - asteroid.radius) asteroid.drift *= -1;
		if (asteroid.y - asteroid.radius > height) {
			asteroids.splice(index, 1);
			continue;
		}
		if (elapsedTime >= invulnerableUntil && circleCollision(player.x, player.y, player.radius * 0.74, asteroid.x, asteroid.y, asteroid.radius * 0.8)) {
			handleCollision(asteroid, index);
			if (gameState !== "running") return;
		}
	}

	if (powerup) {
		powerup.y += powerup.speed * deltaSeconds;
		powerup.phase += deltaSeconds;
		if (circleCollision(player.x, player.y, player.radius + 2, powerup.x, powerup.y, powerup.radius)) collectPowerup();
		else if (powerup.y - powerup.radius > height) powerup = null;
	}

	for (let index = particles.length - 1; index >= 0; index -= 1) {
		const particle = particles[index];
		particle.life -= deltaSeconds;
		particle.x += particle.velocityX * deltaSeconds;
		particle.y += particle.velocityY * deltaSeconds;
		particle.velocityX *= 0.985;
		particle.velocityY *= 0.985;
		if (particle.life <= 0) particles.splice(index, 1);
	}

	updateHud();
	if (elapsedTime - Math.floor(elapsedTime / 15) * 15 < deltaSeconds) gameAnnouncement.textContent = `Sector ${Math.floor(elapsedTime / 15) + 1}. Asteroid field intensifying.`;
}

function animationFrame(timestamp) {
	if (gameState !== "running") {
		animationFrameId = null;
		return;
	}
	const deltaSeconds = lastFrameTime === 0 ? 0 : Math.min(0.04, Math.max(0, (timestamp - lastFrameTime) / 1000));
	lastFrameTime = timestamp;
	updateGame(deltaSeconds);
	drawScene(deltaSeconds);
	if (gameState === "running") animationFrameId = window.requestAnimationFrame(animationFrame);
	else animationFrameId = null;
}

function stopAnimationLoop() {
	if (animationFrameId !== null) {
		window.cancelAnimationFrame(animationFrameId);
		animationFrameId = null;
	}
	lastFrameTime = 0;
}

function resetGameState() {
	stopAnimationLoop();
	elapsedTime = 0;
	score = 0;
	lives = STARTING_LIVES;
	shieldUntil = 0;
	invulnerableUntil = 0;
	nextAsteroidIn = 0.55;
	nextPowerupAt = randomRange(7, 11);
	powerup = null;
	asteroids = [];
	particles = [];
	player.x = width / 2;
	player.y = height - 45;
	player.velocityX = 0;
	dragTargetX = null;
	leftHeld = false;
	rightHeld = false;
	hudSecond = -1;
	stage.classList.remove("is-playing");
	hitFlash.classList.remove("is-visible");
	updateHud(true);
}

function startGame() {
	resetGameState();
	gameState = "running";
	stage.classList.add("is-playing");
	gameOverlay.hidden = true;
	overlayKicker.textContent = "READY FOR LAUNCH";
	overlayTitle.innerHTML = "Clear skies.<br>For now.";
	overlayCopy.textContent = "Dodge the asteroid field. Collect a shield and see how long you can last.";
	finalStats.hidden = true;
	recordMessage.hidden = true;
	backGamesLink.hidden = true;
	startButtonLabel.textContent = "Start game";
	gameAnnouncement.textContent = "Game started. Use the left and right arrow keys, A and D, or touch controls to move.";
	playSound("start");
	animationFrameId = window.requestAnimationFrame(animationFrame);
}

function finishGame() {
	if (gameState !== "running") return;
	gameState = "over";
	stopAnimationLoop();
	stage.classList.remove("is-playing");
	leftHeld = false;
	rightHeld = false;
	dragTargetX = null;

	const newRecord = score > bestScore;
	if (newRecord) {
		bestScore = score;
		saveBestScore();
		playSound("record");
	}
	playSound("gameOver");
	finalScore.textContent = String(score);
	finalTime.textContent = formatTime(elapsedTime);
	finalBest.textContent = String(bestScore);
	overlayKicker.textContent = "RUN ENDED";
	overlayTitle.textContent = "MISSION FAILED";
	overlayCopy.textContent = "The asteroid field got the better of you this time.";
	finalStats.hidden = false;
	recordMessage.hidden = !newRecord;
	startButtonLabel.textContent = "Play again";
	backGamesLink.hidden = false;
	gameOverlay.hidden = false;
	updateHud(true);
	gameAnnouncement.textContent = `Mission failed. Final score ${score}. Survival time ${formatTime(elapsedTime)}.${newRecord ? " New best score." : ""}`;
}

function setMovement(direction, active) {
	if (direction === "left") leftHeld = active;
	else rightHeld = active;
}

function handleKeyDown(event) {
	const key = event.key.toLowerCase();
	if (key === "arrowleft" || key === "a") {
		event.preventDefault();
		setMovement("left", true);
	} else if (key === "arrowright" || key === "d") {
		event.preventDefault();
		setMovement("right", true);
	}
}

function handleKeyUp(event) {
	const key = event.key.toLowerCase();
	if (key === "arrowleft" || key === "a") setMovement("left", false);
	else if (key === "arrowright" || key === "d") setMovement("right", false);
}

function handleCanvasPointerDown(event) {
	if (gameState !== "running") return;
	event.preventDefault();
	activePointer = { id: event.pointerId, type: event.pointerType };
	setCanvasPointerTarget(event.clientX);
	try {
		canvas.setPointerCapture(event.pointerId);
	} catch {
		activePointer = { id: event.pointerId, type: event.pointerType };
	}
}

function setCanvasPointerTarget(clientX) {
	const bounds = canvas.getBoundingClientRect();
	dragTargetX = Math.max(PLAYER_RADIUS + 8, Math.min(width - PLAYER_RADIUS - 8, clientX - bounds.left));
}

function handleCanvasPointerMove(event) {
	if (gameState !== "running" || !activePointer || activePointer.id !== event.pointerId) return;
	event.preventDefault();
	setCanvasPointerTarget(event.clientX);
}

function handleCanvasPointerEnd(event) {
	if (activePointer?.id === event.pointerId) activePointer = null;
}

function beginButtonMovement(direction, button, event) {
	if (event.pointerType === "mouse" && event.button !== 0) return;
	event.preventDefault();
	button.classList.add("is-pressed");
	setMovement(direction, true);
	try {
		button.setPointerCapture(event.pointerId);
	} catch {
		return;
	}
}

function endButtonMovement(direction, button) {
	button.classList.remove("is-pressed");
	setMovement(direction, false);
}

function activateKeyboardButton(button, direction) {
	button.addEventListener("click", (event) => {
		if (event.detail !== 0 || gameState !== "running") return;
		dragTargetX = Math.max(PLAYER_RADIUS + 8, Math.min(width - PLAYER_RADIUS - 8, player.x + direction * 72));
	});
}

function toggleSound() {
	soundEnabled = !soundEnabled;
	soundButton.setAttribute("aria-pressed", String(soundEnabled));
	soundButton.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
	soundLabel.textContent = soundEnabled ? "Sound on" : "Sound off";
	if (soundEnabled) playTone(470, 0.07);
}

function updatePlayerOnResize() {
	resizeCanvas();
	if (gameState === "running") {
		player.y = height - 45;
		player.x = Math.max(PLAYER_RADIUS + 8, Math.min(width - PLAYER_RADIUS - 8, player.x));
	}
}

startButton.addEventListener("click", startGame);
soundButton.addEventListener("click", toggleSound);
canvas.addEventListener("pointerdown", handleCanvasPointerDown);
canvas.addEventListener("pointermove", handleCanvasPointerMove);
canvas.addEventListener("pointerup", handleCanvasPointerEnd);
canvas.addEventListener("pointercancel", handleCanvasPointerEnd);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", () => {
	leftHeld = false;
	rightHeld = false;
	activePointer = null;
});

moveLeftButton.addEventListener("pointerdown", (event) => beginButtonMovement("left", moveLeftButton, event));
moveLeftButton.addEventListener("pointerup", () => endButtonMovement("left", moveLeftButton));
moveLeftButton.addEventListener("pointercancel", () => endButtonMovement("left", moveLeftButton));
moveLeftButton.addEventListener("lostpointercapture", () => endButtonMovement("left", moveLeftButton));
moveRightButton.addEventListener("pointerdown", (event) => beginButtonMovement("right", moveRightButton, event));
moveRightButton.addEventListener("pointerup", () => endButtonMovement("right", moveRightButton));
moveRightButton.addEventListener("pointercancel", () => endButtonMovement("right", moveRightButton));
moveRightButton.addEventListener("lostpointercapture", () => endButtonMovement("right", moveRightButton));
activateKeyboardButton(moveLeftButton, -1);
activateKeyboardButton(moveRightButton, 1);

if ("ResizeObserver" in window) {
	const stageObserver = new ResizeObserver(updatePlayerOnResize);
	stageObserver.observe(stage);
} else {
	window.addEventListener("resize", updatePlayerOnResize);
}

bestValue.textContent = String(bestScore);
resizeCanvas();
updateHud(true);
