const ROUND_LENGTH_MS = 30000;
const TIMER_INTERVAL_MS = 100;
const STORAGE_KEY = "funfroge-neon-target-rush-best";
const BASE_HIT_SCORE = 100;
const COMBO_BONUS = 25;
const MAX_COMBO_BONUS = 100;

const playfield = document.querySelector("#playfield");
const targetButton = document.querySelector("#target");
const startButton = document.querySelector("#startButton");
const startButtonLabel = document.querySelector("#startButtonLabel");
const soundButton = document.querySelector("#soundButton");
const soundLabel = document.querySelector("#soundLabel");
const scoreValue = document.querySelector("#scoreValue");
const timerValue = document.querySelector("#timerValue");
const hitsValue = document.querySelector("#hitsValue");
const comboValue = document.querySelector("#comboValue");
const bestValue = document.querySelector("#bestValue");
const fieldState = document.querySelector("#fieldState");
const gameOverlay = document.querySelector("#gameOverlay");
const overlayKicker = document.querySelector("#overlayKicker");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayCopy = document.querySelector("#overlayCopy");
const roundResults = document.querySelector("#roundResults");
const finalScore = document.querySelector("#finalScore");
const finalHits = document.querySelector("#finalHits");
const finalAccuracy = document.querySelector("#finalAccuracy");
const finalBest = document.querySelector("#finalBest");
const newBestMessage = document.querySelector("#newBestMessage");
const comboToast = document.querySelector("#comboToast");
const fxLayer = document.querySelector("#fxLayer");
const gameAnnouncement = document.querySelector("#gameAnnouncement");

let phase = "ready";
let score = 0;
let hits = 0;
let misses = 0;
let combo = 0;
let bestScore = readBestScore();
let deadline = 0;
let timerInterval = null;
let targetTransitionTimeout = null;
let soundEnabled = true;
let audioContext = null;

bestValue.textContent = String(bestScore);

function readBestScore() {
	try {
		const storedScore = Number(localStorage.getItem(STORAGE_KEY));
		return Number.isFinite(storedScore) && storedScore > 0 ? storedScore : 0;
	} catch {
		return 0;
	}
}

function saveBestScore() {
	try {
		localStorage.setItem(STORAGE_KEY, String(bestScore));
	} catch {
		gameAnnouncement.textContent = "Best score could not be saved in this browser.";
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

function playTone(frequency, duration, startOffset = 0, type = "sine") {
	const context = getAudioContext();
	if (!context) return;

	const oscillator = context.createOscillator();
	const gain = context.createGain();
	const startTime = context.currentTime + startOffset;

	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, startTime);
	gain.gain.setValueAtTime(0.0001, startTime);
	gain.gain.exponentialRampToValueAtTime(0.08, startTime + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
	oscillator.connect(gain);
	gain.connect(context.destination);
	oscillator.start(startTime);
	oscillator.stop(startTime + duration + 0.02);
}

function playSound(effect) {
	if (!soundEnabled) return;

	if (effect === "hit") {
		playTone(610, 0.11, 0, "triangle");
	} else if (effect === "combo") {
		playTone(720, 0.16, 0, "triangle");
		playTone(960, 0.18, 0.07, "triangle");
	} else if (effect === "end") {
		playTone(440, 0.2, 0, "sine");
		playTone(330, 0.28, 0.14, "sine");
	} else if (effect === "button") {
		playTone(480, 0.06, 0, "sine");
	}
}

function formatTime(milliseconds) {
	const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
	return `00:${String(seconds).padStart(2, "0")}`;
}

function updateScoreboard() {
	scoreValue.textContent = String(score);
	hitsValue.textContent = String(hits);
	comboValue.textContent = `x${Math.max(1, combo)}`;
}

function placeTarget() {
	const fieldWidth = playfield.clientWidth;
	const fieldHeight = playfield.clientHeight;
	const isSmallTarget = Math.random() < 0.22;
	const ordinarySize = 62 + Math.random() * 15;
	const targetSize = Math.round(Math.min(isSmallTarget ? 42 + Math.random() * 8 : ordinarySize, fieldWidth - 16, fieldHeight - 70));
	const horizontalSpace = Math.max(0, fieldWidth - targetSize - 12);
	const verticalSpace = Math.max(0, fieldHeight - targetSize - 12);

	targetButton.style.setProperty("--target-size", `${targetSize}px`);
	targetButton.style.left = `${6 + Math.random() * horizontalSpace}px`;
	targetButton.style.top = `${6 + Math.random() * verticalSpace}px`;
	targetButton.classList.remove("is-hit");
	targetButton.hidden = false;
}

function createHitEffects(x, y, awardedPoints) {
	const scorePopup = document.createElement("span");
	scorePopup.className = "score-pop";
	scorePopup.textContent = `+${awardedPoints}`;
	scorePopup.style.left = `${x}px`;
	scorePopup.style.top = `${y}px`;
	fxLayer.append(scorePopup);

	for (let index = 0; index < 9; index += 1) {
		const particle = document.createElement("span");
		const angle = (Math.PI * 2 * index) / 9;
		const distance = 25 + Math.random() * 24;
		particle.className = "particle";
		particle.style.left = `${x}px`;
		particle.style.top = `${y}px`;
		particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
		particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
		particle.style.setProperty("--particle-color", index % 3 === 0 ? "var(--cyan)" : "var(--lime)");
		fxLayer.append(particle);
	}
}

function showComboToast() {
	comboToast.textContent = `COMBO x${combo}`;
	comboToast.classList.remove("is-visible");
	void comboToast.offsetWidth;
	comboToast.classList.add("is-visible");
}

function onTargetHit(event) {
	if (phase !== "playing" || targetTransitionTimeout !== null || targetButton.hidden) return;
	event.stopPropagation();

	const targetBounds = targetButton.getBoundingClientRect();
	const fieldBounds = playfield.getBoundingClientRect();
	const hitX = (event.clientX || targetBounds.left + targetBounds.width / 2) - fieldBounds.left;
	const hitY = (event.clientY || targetBounds.top + targetBounds.height / 2) - fieldBounds.top;

	hits += 1;
	combo += 1;
	const comboBonus = Math.min(Math.max(0, combo - 1) * COMBO_BONUS, MAX_COMBO_BONUS);
	const awardedPoints = BASE_HIT_SCORE + comboBonus;
	score += awardedPoints;
	updateScoreboard();
	createHitEffects(hitX, hitY, awardedPoints);
	targetButton.classList.add("is-hit");
	gameAnnouncement.textContent = combo > 1
		? `Combo x${combo}. ${awardedPoints} points.`
		: `${awardedPoints} points.`;

	if (combo > 1) {
		showComboToast();
		playSound("combo");
	} else {
		playSound("hit");
	}

	targetTransitionTimeout = window.setTimeout(() => {
		targetTransitionTimeout = null;
		if (phase === "playing") placeTarget();
	}, 115);
}

function onEmptyFieldTap(event) {
	if (phase !== "playing" || event.target !== playfield) return;
	misses += 1;
	combo = 0;
	comboValue.textContent = "x1";
	gameAnnouncement.textContent = "Miss. Combo reset.";
	playfield.classList.remove("is-miss");
	void playfield.offsetWidth;
	playfield.classList.add("is-miss");
}

function updateTimer() {
	const remaining = deadline - performance.now();
	timerValue.textContent = formatTime(remaining);
	timerValue.setAttribute("aria-label", `${Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`);

	if (remaining <= 0) finishGame();
}

function clearRoundTimers() {
	if (timerInterval !== null) {
		window.clearInterval(timerInterval);
		timerInterval = null;
	}
	if (targetTransitionTimeout !== null) {
		window.clearTimeout(targetTransitionTimeout);
		targetTransitionTimeout = null;
	}
}

function startGame() {
	clearRoundTimers();
	phase = "playing";
	score = 0;
	hits = 0;
	misses = 0;
	combo = 0;
	deadline = performance.now() + ROUND_LENGTH_MS;
	comboToast.classList.remove("is-visible");
	fxLayer.replaceChildren();
	newBestMessage.hidden = true;
	roundResults.hidden = true;
	gameOverlay.hidden = true;
	playfield.classList.remove("is-miss");
	playfield.classList.add("is-active");
	fieldState.textContent = "IN PLAY";
	overlayKicker.textContent = "30-SECOND CHALLENGE";
	overlayTitle.textContent = "Ready to rush?";
	overlayCopy.textContent = "Hit each neon target for 100 points. Combos add up to 100 bonus points.";
	startButtonLabel.textContent = "Start game";
	timerValue.textContent = "00:30";
	timerValue.setAttribute("aria-label", "30 seconds remaining");
	updateScoreboard();
	playSound("button");
	placeTarget();
	targetButton.focus({ preventScroll: true });
	timerInterval = window.setInterval(updateTimer, TIMER_INTERVAL_MS);
}

function finishGame() {
	if (phase !== "playing") return;
	phase = "over";
	clearRoundTimers();
	targetButton.hidden = true;
	playfield.classList.remove("is-active", "is-miss");
	fieldState.textContent = "ROUND OVER";
	timerValue.textContent = "00:00";
	timerValue.setAttribute("aria-label", "0 seconds remaining");

	const accuracy = hits + misses === 0 ? 0 : Math.round((hits / (hits + misses)) * 100);
	const isNewBest = score > bestScore;
	if (isNewBest) {
		bestScore = score;
		bestValue.textContent = String(bestScore);
		saveBestScore();
	}

	finalScore.textContent = String(score);
	finalHits.textContent = String(hits);
	finalAccuracy.textContent = `${accuracy}%`;
	finalBest.textContent = String(bestScore);
	roundResults.hidden = false;
	newBestMessage.hidden = !isNewBest;
	overlayKicker.textContent = "ROUND COMPLETE";
	overlayTitle.textContent = "TIME'S UP!";
	overlayCopy.textContent = "Nice run. Ready to beat that score?";
	startButtonLabel.textContent = "Play again";
	gameOverlay.hidden = false;
	gameAnnouncement.textContent = `Time's up. Final score ${score}. ${hits} hits. Accuracy ${accuracy} percent.${isNewBest ? " New best score." : ""}`;
	playSound("end");
	startButton.focus({ preventScroll: true });
}

function toggleSound() {
	soundEnabled = !soundEnabled;
	soundButton.setAttribute("aria-pressed", String(soundEnabled));
	soundButton.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
	soundLabel.textContent = soundEnabled ? "Sound on" : "Sound off";
	if (soundEnabled) playSound("button");
}

startButton.addEventListener("click", startGame);
targetButton.addEventListener("click", onTargetHit);
playfield.addEventListener("pointerdown", onEmptyFieldTap);
soundButton.addEventListener("click", toggleSound);
fxLayer.addEventListener("animationend", (event) => {
	if (event.target.matches(".score-pop, .particle")) event.target.remove();
});
function handlePlayfieldResize() {
	if (phase === "playing" && targetTransitionTimeout === null) placeTarget();
}

if ("ResizeObserver" in window) {
	const playfieldObserver = new ResizeObserver(handlePlayfieldResize);
	playfieldObserver.observe(playfield);
} else {
	window.addEventListener("resize", handlePlayfieldResize);
}
