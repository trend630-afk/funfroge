const TOTAL_ROUNDS = 5;
const ROUND_DELAY_MIN_MS = 1250;
const ROUND_DELAY_MAX_MS = 3150;
const FEEDBACK_DELAY_MS = 720;
const BEST_SCORE_KEY = "funfroge-reaction-rush-best-score";
const BEST_REACTION_KEY = "funfroge-reaction-rush-best-time";

const stage = document.querySelector("#reactionStage");
const reactionPad = document.querySelector("#reactionPad");
const signalIcon = document.querySelector("#signalIcon");
const signalMessage = document.querySelector("#signalMessage");
const signalCaption = document.querySelector("#signalCaption");
const scoreValue = document.querySelector("#scoreValue");
const bestScoreValue = document.querySelector("#bestScoreValue");
const reactionValue = document.querySelector("#reactionValue");
const bestReactionValue = document.querySelector("#bestReactionValue");
const roundValue = document.querySelector("#roundValue");
const averageValue = document.querySelector("#averageValue");
const startPanel = document.querySelector("#startPanel");
const resultsPanel = document.querySelector("#resultsPanel");
const startButton = document.querySelector("#startButton");
const playAgainButton = document.querySelector("#playAgainButton");
const finalScore = document.querySelector("#finalScore");
const finalBestScore = document.querySelector("#finalBestScore");
const finalAverage = document.querySelector("#finalAverage");
const finalFastest = document.querySelector("#finalFastest");
const finalSlowest = document.querySelector("#finalSlowest");
const finalRating = document.querySelector("#finalRating");
const newBestMessage = document.querySelector("#newBestMessage");
const failedRounds = document.querySelector("#failedRounds");
const scorePop = document.querySelector("#scorePop");
const soundButton = document.querySelector("#soundButton");
const soundLabel = document.querySelector("#soundLabel");
const gameAnnouncement = document.querySelector("#gameAnnouncement");

let gameState = "start";
let roundResults = [];
let roundNumber = 0;
let score = 0;
let bestScore = readStoredInteger(BEST_SCORE_KEY, 0);
let bestReactionTime = readStoredPositiveInteger(BEST_REACTION_KEY);
let signalTimestamp = 0;
let roundTimer = null;
let soundEnabled = true;
let audioContext = null;
let newBestScoreThisGame = false;
let newBestReactionThisGame = false;

function readStoredInteger(key, fallback) {
	try {
		const storedValue = localStorage.getItem(key);
		if (storedValue === null) return fallback;
		const parsedValue = Number(storedValue);
		if (Number.isSafeInteger(parsedValue) && parsedValue >= fallback) return parsedValue;
		localStorage.removeItem(key);
	} catch {
		return fallback;
	}
	return fallback;
}

function readStoredPositiveInteger(key) {
	try {
		const storedValue = localStorage.getItem(key);
		if (storedValue === null) return null;
		const parsedValue = Number(storedValue);
		if (Number.isSafeInteger(parsedValue) && parsedValue > 0) return parsedValue;
		localStorage.removeItem(key);
	} catch {
		return null;
	}
	return null;
}

function writeStoredValue(key, value) {
	try {
		localStorage.setItem(key, String(value));
		return true;
	} catch {
		gameAnnouncement.textContent = "Your score could not be saved in this browser.";
		return false;
	}
}

function formatMilliseconds(value) {
	return value === null || value === undefined ? "—" : `${Math.round(value)} ms`;
}

function getSuccessfulTimes() {
	return roundResults
		.filter((result) => result.reactionMs !== null)
		.map((result) => result.reactionMs);
}

function getAverageReaction() {
	const successfulTimes = getSuccessfulTimes();
	if (successfulTimes.length === 0) return null;
	return Math.round(successfulTimes.reduce((total, value) => total + value, 0) / successfulTimes.length);
}

function getReactionRating(average) {
	if (average === null) return "🎯 KEEP PRACTICING";
	if (average < 200) return "🏆 AMAZING";
	if (average < 275) return "⚡ FAST";
	if (average < 375) return "👍 GOOD";
	return "🎯 KEEP PRACTICING";
}

function updateStats() {
	scoreValue.textContent = String(score);
	bestScoreValue.textContent = String(bestScore);
	bestReactionValue.textContent = formatMilliseconds(bestReactionTime);
	let latestReaction = null;
	for (let index = roundResults.length - 1; index >= 0; index -= 1) {
		if (roundResults[index].reactionMs !== null) {
			latestReaction = roundResults[index].reactionMs;
			break;
		}
	}
	reactionValue.textContent = formatMilliseconds(latestReaction);
	roundValue.textContent = `${roundNumber} / ${TOTAL_ROUNDS}`;
	averageValue.textContent = formatMilliseconds(getAverageReaction());
}

function clearRoundTimer() {
	if (roundTimer !== null) {
		window.clearTimeout(roundTimer);
		roundTimer = null;
	}
}

function setPadState(state, message, caption, icon, ariaLabel) {
	stage.dataset.state = state;
	signalMessage.textContent = message;
	signalCaption.textContent = caption;
	signalIcon.textContent = icon;
	reactionPad.setAttribute("aria-label", ariaLabel);
}

function startGame() {
	clearRoundTimer();
	gameState = "waiting";
	roundResults = [];
	roundNumber = 0;
	score = 0;
	signalTimestamp = 0;
	newBestScoreThisGame = false;
	newBestReactionThisGame = false;
	startPanel.hidden = true;
	resultsPanel.hidden = true;
	newBestMessage.hidden = true;
	failedRounds.hidden = true;
	scorePop.classList.remove("is-visible");
	updateStats();
	gameAnnouncement.textContent = "Game started. Wait for the CLICK NOW signal.";
	playSound("start");
	beginRound();
}

function beginRound() {
	if (gameState === "results") return;
	clearRoundTimer();
	roundNumber = roundResults.length + 1;
	gameState = "waiting";
	signalTimestamp = 0;
	stage.dataset.state = "waiting";
	setPadState("waiting", "WAIT...", "Hold steady. The signal is coming.", "···", "Waiting for the signal. Do not click yet.");
	updateStats();
	gameAnnouncement.textContent = `Round ${roundNumber} of ${TOTAL_ROUNDS}. Wait for CLICK NOW.`;
	const delay = ROUND_DELAY_MIN_MS + Math.random() * (ROUND_DELAY_MAX_MS - ROUND_DELAY_MIN_MS);
	roundTimer = window.setTimeout(showSignal, delay);
}

function showSignal() {
	roundTimer = null;
	if (gameState !== "waiting") return;
	gameState = "signal";
	signalTimestamp = performance.now();
	setPadState("signal", "CLICK NOW!", "Tap or press Enter / Space", "!", "Click now. The reaction timer is running.");
	gameAnnouncement.textContent = `Round ${roundNumber}. Click now.`;
	playSound("signal");
}

function handleEarlyClick() {
	if (gameState !== "waiting") return;
	clearRoundTimer();
	gameState = "feedback";
	roundResults.push({ reactionMs: null, failed: true });
	signalTimestamp = 0;
	setPadState("early", "TOO EARLY!", "This round is recorded as a miss.", "×", "Too early. This round counts as a failed reaction.");
	updateStats();
	gameAnnouncement.textContent = `Too early. Round ${roundNumber} counts as a miss.`;
	playSound("early");
	roundTimer = window.setTimeout(advanceAfterFeedback, FEEDBACK_DELAY_MS);
}

function handleSuccessfulClick() {
	if (gameState !== "signal") return;
	clearRoundTimer();
	gameState = "feedback";
	const reactionMs = Math.max(1, Math.round(performance.now() - signalTimestamp));
	signalTimestamp = 0;
	roundResults.push({ reactionMs, failed: false });
	const awardedPoints = Math.max(0, 1000 - reactionMs);
	score += awardedPoints;

	if (bestReactionTime === null || reactionMs < bestReactionTime) {
		bestReactionTime = reactionMs;
		newBestReactionThisGame = true;
		writeStoredValue(BEST_REACTION_KEY, bestReactionTime);
	}

	setPadState("success", `${reactionMs} ms`, "Nice response", "✓", `Reaction time ${reactionMs} milliseconds. Round ${roundNumber} complete.`);
	showScorePopup(awardedPoints);
	updateStats();
	gameAnnouncement.textContent = `Reaction time ${reactionMs} milliseconds. ${awardedPoints} points.`;
	playSound("success");
	roundTimer = window.setTimeout(advanceAfterFeedback, FEEDBACK_DELAY_MS);
}

function handlePadActivation() {
	if (gameState === "waiting") {
		handleEarlyClick();
	} else if (gameState === "signal") {
		handleSuccessfulClick();
	}
}

function showScorePopup(points) {
	scorePop.textContent = points > 0 ? `+${points}` : "+0";
	scorePop.classList.remove("is-visible");
	void scorePop.offsetWidth;
	scorePop.classList.add("is-visible");
}

function advanceAfterFeedback() {
	roundTimer = null;
	if (gameState !== "feedback") return;
	if (roundResults.length >= TOTAL_ROUNDS) {
		finishGame();
		return;
	}
	beginRound();
}

function finishGame() {
	clearRoundTimer();
	gameState = "results";
	const successfulTimes = getSuccessfulTimes();
	const average = getAverageReaction();
	const fastest = successfulTimes.length ? Math.min(...successfulTimes) : null;
	const slowest = successfulTimes.length ? Math.max(...successfulTimes) : null;
	const missedRounds = roundResults.filter((result) => result.failed).length;
	const isNewBestScore = score > bestScore;
	if (isNewBestScore) {
		bestScore = score;
		newBestScoreThisGame = true;
		writeStoredValue(BEST_SCORE_KEY, bestScore);
	}

	finalScore.textContent = String(score);
	finalBestScore.textContent = String(bestScore);
	finalAverage.textContent = formatMilliseconds(average);
	finalFastest.textContent = formatMilliseconds(fastest);
	finalSlowest.textContent = formatMilliseconds(slowest);
	finalRating.textContent = getReactionRating(average);
	newBestMessage.hidden = !newBestScoreThisGame;
	failedRounds.hidden = missedRounds === 0;
	failedRounds.textContent = missedRounds === 1 ? "1 failed round" : `${missedRounds} failed rounds`;
	resultsPanel.hidden = false;
	setPadState("results", "RESULTS", "Five rounds complete", "✓", "Reaction Rush results");
	updateStats();
	gameAnnouncement.textContent = `Results. Score ${score}. Average reaction ${formatMilliseconds(average)}. ${getReactionRating(average)}.`;
	if (newBestScoreThisGame || newBestReactionThisGame) playSound("newBest");
	playSound("results");
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
	const audio = getAudioContext();
	if (!audio) return;
	const oscillator = audio.createOscillator();
	const gain = audio.createGain();
	const startAt = audio.currentTime + startOffset;
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, startAt);
	gain.gain.setValueAtTime(0.0001, startAt);
	gain.gain.exponentialRampToValueAtTime(0.06, startAt + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
	oscillator.connect(gain);
	gain.connect(audio.destination);
	oscillator.start(startAt);
	oscillator.stop(startAt + duration + 0.02);
}

function playSound(effect) {
	if (!soundEnabled) return;
	if (effect === "start") {
		playTone(430, 0.1, 0, "triangle");
		playTone(650, 0.13, 0.07, "triangle");
	} else if (effect === "signal") {
		playTone(760, 0.14, 0, "sine");
		playTone(1030, 0.18, 0.06, "sine");
	} else if (effect === "success") {
		playTone(580, 0.09, 0, "triangle");
	} else if (effect === "early") {
		playTone(260, 0.18, 0, "sawtooth", 0.035);
	} else if (effect === "results") {
		playTone(500, 0.13, 0, "triangle");
		playTone(710, 0.16, 0.08, "triangle");
	} else if (effect === "newBest") {
		playTone(740, 0.15, 0, "triangle");
		playTone(990, 0.2, 0.09, "triangle");
	} else if (effect === "toggle") {
		playTone(460, 0.06, 0, "sine");
	}
}

function toggleSound() {
	soundEnabled = !soundEnabled;
	soundButton.setAttribute("aria-pressed", String(soundEnabled));
	soundButton.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
	soundLabel.textContent = soundEnabled ? "Sound on" : "Sound off";
	if (soundEnabled) playSound("toggle");
}

startButton.addEventListener("click", startGame);
playAgainButton.addEventListener("click", startGame);
reactionPad.addEventListener("click", handlePadActivation);
soundButton.addEventListener("click", toggleSound);
scorePop.addEventListener("animationend", () => scorePop.classList.remove("is-visible"));

bestScoreValue.textContent = String(bestScore);
bestReactionValue.textContent = formatMilliseconds(bestReactionTime);
updateStats();
