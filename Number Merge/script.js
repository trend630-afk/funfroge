const BOARD_SIZE = 4;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
const MAX_UNDO_MOVES = 5;
const BEST_SCORE_KEY = "funfroge-number-merge-best";

const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#scoreValue");
const bestElement = document.querySelector("#bestValue");
const newGameButton = document.querySelector("#newGameButton");
const undoButton = document.querySelector("#undoButton");
const soundButton = document.querySelector("#soundButton");
const toolbarSoundButton = document.querySelector("#toolbarSoundButton");
const soundLabel = document.querySelector("#soundLabel");
const toolbarSoundLabel = document.querySelector("#toolbarSoundLabel");
const gameOverPanel = document.querySelector("#gameOverPanel");
const finalScoreElement = document.querySelector("#finalScore");
const finalBestElement = document.querySelector("#finalBest");
const newBestMessage = document.querySelector("#newBestMessage");
const tryAgainButton = document.querySelector("#tryAgainButton");
const winNotice = document.querySelector("#winNotice");
const gameAnnouncement = document.querySelector("#gameAnnouncement");

let board = Array(BOARD_CELLS).fill(null);
let score = 0;
let bestScore = loadBestScore();
let nextTileId = 1;
let undoHistory = [];
let gameOver = false;
let wonThisGame = false;
let newBestThisGame = false;
let recordSoundPlayed = false;
let soundEnabled = true;
let audioContext = null;
let winNoticeTimeout = null;
let swipeStart = null;

const cellElements = Array.from({ length: BOARD_CELLS }, (_, index) => {
	const cell = document.createElement("div");
	cell.className = "cell";
	cell.setAttribute("role", "gridcell");
	cell.dataset.index = String(index);
	boardElement.append(cell);
	return cell;
});

function formatNumber(value) {
	return value.toLocaleString("en-US");
}

function loadBestScore() {
	let savedValue;
	try {
		savedValue = localStorage.getItem(BEST_SCORE_KEY);
	} catch {
		return 0;
	}

	if (savedValue === null) return 0;
	const parsedValue = Number(savedValue);
	if (Number.isSafeInteger(parsedValue) && parsedValue >= 0) return parsedValue;

	try {
		localStorage.removeItem(BEST_SCORE_KEY);
	} catch {
		return 0;
	}
	return 0;
}

function saveBestScore() {
	try {
		localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
	} catch {
		gameAnnouncement.textContent = "Best score could not be saved in this browser.";
	}
}

function cloneBoard(sourceBoard) {
	return sourceBoard.map((tile) => tile ? { ...tile } : null);
}

function getTileCount(targetBoard = board) {
	return targetBoard.reduce((count, tile) => count + (tile ? 1 : 0), 0);
}

function addRandomTile(targetBoard) {
	const emptyCells = [];
	for (let index = 0; index < BOARD_CELLS; index += 1) {
		if (!targetBoard[index]) emptyCells.push(index);
	}
	if (emptyCells.length === 0) return null;

	const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
	const tile = {
		id: nextTileId,
		value: Math.random() < 0.9 ? 2 : 4
	};
	nextTileId += 1;
	targetBoard[randomIndex] = tile;
	return tile.id;
}

function captureTileRects() {
	const rects = new Map();
	cellElements.forEach((cell) => {
		const tileElement = cell.firstElementChild;
		if (tileElement) {
			rects.set(Number(tileElement.dataset.tileId), tileElement.getBoundingClientRect());
		}
	});
	return rects;
}

function updateScoreboard(animateScore = false) {
	scoreElement.textContent = formatNumber(score);
	bestElement.textContent = formatNumber(bestScore);
	undoButton.disabled = undoHistory.length === 0;

	if (animateScore) {
		scoreElement.classList.remove("is-updated");
		void scoreElement.offsetWidth;
		scoreElement.classList.add("is-updated");
	}
}

function renderBoard({ previousRects = new Map(), mergedIds = new Set(), spawnedIds = new Set(), animateScore = false } = {}) {
	board.forEach((tile, index) => {
		const cell = cellElements[index];
		const row = Math.floor(index / BOARD_SIZE) + 1;
		const column = (index % BOARD_SIZE) + 1;
		if (!tile) {
			cell.setAttribute("aria-label", `Row ${row}, column ${column}, empty`);
			cell.replaceChildren();
			return;
		}

		cell.setAttribute("aria-label", `Row ${row}, column ${column}, ${formatNumber(tile.value)}`);
		const tileElement = document.createElement("span");
		tileElement.className = "tile";
		tileElement.dataset.tileId = String(tile.id);
		tileElement.dataset.value = String(tile.value);
		tileElement.dataset.digits = String(String(tile.value).length);
		tileElement.textContent = formatNumber(tile.value);

		if (mergedIds.has(tile.id)) {
			tileElement.classList.add("is-merged");
		} else if (spawnedIds.has(tile.id)) {
			tileElement.classList.add("is-new");
		} else if (previousRects.has(tile.id)) {
			const previousRect = previousRects.get(tile.id);
			const currentRect = cell.getBoundingClientRect();
			const offsetX = previousRect.left - currentRect.left;
			const offsetY = previousRect.top - currentRect.top;
			if (Math.abs(offsetX) > 1 || Math.abs(offsetY) > 1) {
				tileElement.classList.add("is-moving");
				tileElement.style.setProperty("--move-x", `${offsetX}px`);
				tileElement.style.setProperty("--move-y", `${offsetY}px`);
			}
		}
		cell.replaceChildren(tileElement);
	});

	gameOverPanel.hidden = !gameOver;
	updateScoreboard(animateScore);
}

function spawnInitialTiles() {
	board = Array(BOARD_CELLS).fill(null);
	const firstId = addRandomTile(board);
	const secondId = addRandomTile(board);
	renderBoard({ spawnedIds: new Set([firstId, secondId]) });
}

function startNewGame() {
	clearWinNotice();
	board = Array(BOARD_CELLS).fill(null);
	score = 0;
	undoHistory = [];
	gameOver = false;
	wonThisGame = false;
	newBestThisGame = false;
	recordSoundPlayed = false;
	gameOverPanel.hidden = true;
	newBestMessage.hidden = true;
	gameAnnouncement.textContent = "New game started. Use the arrow keys or W, A, S, D to move.";
	spawnInitialTiles();
}

function getLines(direction) {
	const lines = [];
	for (let line = 0; line < BOARD_SIZE; line += 1) {
		const indices = [];
		for (let offset = 0; offset < BOARD_SIZE; offset += 1) {
			let row;
			let column;
			if (direction === "left" || direction === "right") {
				row = line;
				column = direction === "left" ? offset : BOARD_SIZE - 1 - offset;
			} else {
				row = direction === "up" ? offset : BOARD_SIZE - 1 - offset;
				column = line;
			}
			indices.push(row * BOARD_SIZE + column);
		}
		lines.push(indices);
	}
	return lines;
}

function hasAvailableMoves(targetBoard = board) {
	if (targetBoard.some((tile) => tile === null)) return true;
	for (let row = 0; row < BOARD_SIZE; row += 1) {
		for (let column = 0; column < BOARD_SIZE; column += 1) {
			const index = row * BOARD_SIZE + column;
			const value = targetBoard[index].value;
			if (column < BOARD_SIZE - 1 && targetBoard[index + 1].value === value) return true;
			if (row < BOARD_SIZE - 1 && targetBoard[index + BOARD_SIZE].value === value) return true;
		}
	}
	return false;
}

function applyMove(direction) {
	if (gameOver) return false;
	const previousBoard = cloneBoard(board);
	const previousRects = captureTileRects();
	const nextBoard = Array(BOARD_CELLS).fill(null);
	const mergedIds = new Set();
	let gainedScore = 0;

	for (const line of getLines(direction)) {
		const packedTiles = line.map((index) => board[index]).filter(Boolean);
		const mergedLine = [];
		for (let position = 0; position < packedTiles.length; position += 1) {
			const currentTile = packedTiles[position];
			const nextTile = packedTiles[position + 1];
			if (nextTile && currentTile.value === nextTile.value) {
				const mergedTile = { id: nextTileId, value: currentTile.value * 2 };
				nextTileId += 1;
				mergedLine.push(mergedTile);
				mergedIds.add(mergedTile.id);
				gainedScore += mergedTile.value;
				position += 1;
			} else {
				mergedLine.push(currentTile);
			}
		}
		line.forEach((index, position) => {
			nextBoard[index] = mergedLine[position] ?? null;
		});
	}

	const changed = nextBoard.some((tile, index) => (tile?.id ?? null) !== (board[index]?.id ?? null));
	if (!changed) return false;

	undoHistory.push({ board: previousBoard, score });
	if (undoHistory.length > MAX_UNDO_MOVES) undoHistory.shift();
	board = nextBoard;
	score += gainedScore;

	const reachedNewBest = score > bestScore;
	if (reachedNewBest) {
		bestScore = score;
		newBestThisGame = true;
		saveBestScore();
	}

	const spawnedId = addRandomTile(board);
	renderBoard({ previousRects, mergedIds, spawnedIds: new Set(spawnedId === null ? [] : [spawnedId]), animateScore: gainedScore > 0 });

	const reached2048 = [...mergedIds].some((tileId) => board.some((tile) => tile?.id === tileId && tile.value === 2048));
	if (reached2048 && !wonThisGame) {
		wonThisGame = true;
		showWinNotice();
	}

	gameAnnouncement.textContent = gainedScore > 0
		? `${direction} move. Merged tiles for ${formatNumber(gainedScore)} points. Score ${formatNumber(score)}.`
		: `${direction} move. New tile added.`;

	if (reachedNewBest && !recordSoundPlayed) {
		playSound("record");
		recordSoundPlayed = true;
	} else if (gainedScore > 0) {
		playSound("merge");
	} else {
		playSound("move");
	}

	if (!hasAvailableMoves(board)) finishGame();
	return true;
}

function undoMove() {
	const previousState = undoHistory.pop();
	if (!previousState) return;

	const previousRects = captureTileRects();
	board = cloneBoard(previousState.board);
	score = previousState.score;
	gameOver = false;
	gameOverPanel.hidden = true;
	newBestMessage.hidden = true;
	clearWinNotice();
	renderBoard({ previousRects, animateScore: true });
	gameAnnouncement.textContent = "Previous move undone.";
}

function finishGame() {
	if (gameOver) return;
	gameOver = true;
	clearWinNotice();
	finalScoreElement.textContent = formatNumber(score);
	finalBestElement.textContent = formatNumber(bestScore);
	newBestMessage.hidden = !newBestThisGame;
	gameOverPanel.hidden = false;
	undoButton.disabled = undoHistory.length === 0;
	gameAnnouncement.textContent = `Game over. Final score ${formatNumber(score)}. Best score ${formatNumber(bestScore)}.`;
	playSound("gameOver");
}

function showWinNotice() {
	clearWinNotice();
	winNotice.textContent = "2048! Milestone reached. Keep playing to go even further.";
	winNotice.hidden = false;
	winNoticeTimeout = window.setTimeout(() => {
		winNotice.hidden = true;
		winNoticeTimeout = null;
	}, 3600);
}

function clearWinNotice() {
	if (winNoticeTimeout !== null) {
		window.clearTimeout(winNoticeTimeout);
		winNoticeTimeout = null;
	}
	winNotice.hidden = true;
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
	gain.gain.exponentialRampToValueAtTime(0.065, startTime + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
	oscillator.connect(gain);
	gain.connect(context.destination);
	oscillator.start(startTime);
	oscillator.stop(startTime + duration + 0.02);
}

function playSound(effect) {
	if (!soundEnabled) return;
	if (effect === "move") {
		playTone(270, 0.06, 0, "triangle");
	} else if (effect === "merge") {
		playTone(520, 0.11, 0, "triangle");
		playTone(700, 0.13, 0.055, "triangle");
	} else if (effect === "record") {
		playTone(740, 0.16, 0, "triangle");
		playTone(990, 0.2, 0.08, "triangle");
	} else if (effect === "gameOver") {
		playTone(340, 0.16, 0, "sine");
		playTone(245, 0.25, 0.11, "sine");
	} else if (effect === "toggle") {
		playTone(440, 0.07, 0, "sine");
	}
}

function updateSoundButtons() {
	const buttons = [soundButton, toolbarSoundButton];
	buttons.forEach((button) => {
		button.setAttribute("aria-pressed", String(soundEnabled));
		button.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
	});
	const label = soundEnabled ? "Sound on" : "Sound off";
	soundLabel.textContent = label;
	toolbarSoundLabel.textContent = label;
}

function toggleSound() {
	soundEnabled = !soundEnabled;
	updateSoundButtons();
	if (soundEnabled) playSound("toggle");
}

function handleKeydown(event) {
	if (event.altKey || event.ctrlKey || event.metaKey) return;
	if (event.target instanceof HTMLElement && event.target.isContentEditable) return;
	if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;

	const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
	const directions = {
		ArrowLeft: "left",
		ArrowRight: "right",
		ArrowUp: "up",
		ArrowDown: "down",
		a: "left",
		d: "right",
		w: "up",
		s: "down"
	};
	const direction = directions[key];
	if (!direction) return;
	event.preventDefault();
	applyMove(direction);
}

function handlePointerDown(event) {
	if (event.pointerType === "mouse" && event.button !== 0) return;
	swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
	try {
		boardElement.setPointerCapture(event.pointerId);
	} catch {
		swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
	}
}

function handlePointerUp(event) {
	if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
	const deltaX = event.clientX - swipeStart.x;
	const deltaY = event.clientY - swipeStart.y;
	swipeStart = null;
	if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 30) return;
	const direction = Math.abs(deltaX) > Math.abs(deltaY)
		? (deltaX < 0 ? "left" : "right")
		: (deltaY < 0 ? "up" : "down");
	applyMove(direction);
}

function handleAnimationEnd(event) {
	if (!event.target.classList.contains("tile")) return;
	event.target.classList.remove("is-new", "is-merged", "is-moving");
	event.target.style.removeProperty("--move-x");
	event.target.style.removeProperty("--move-y");
}

scoreElement.addEventListener("animationend", () => scoreElement.classList.remove("is-updated"));
window.addEventListener("keydown", handleKeydown);
boardElement.addEventListener("pointerdown", handlePointerDown);
boardElement.addEventListener("pointerup", handlePointerUp);
boardElement.addEventListener("pointercancel", () => { swipeStart = null; });
boardElement.addEventListener("animationend", handleAnimationEnd);
newGameButton.addEventListener("click", startNewGame);
undoButton.addEventListener("click", undoMove);
soundButton.addEventListener("click", toggleSound);
toolbarSoundButton.addEventListener("click", toggleSound);
tryAgainButton.addEventListener("click", startNewGame);

bestElement.textContent = formatNumber(bestScore);
updateSoundButtons();
startNewGame();
