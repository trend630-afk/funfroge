const GAME_DURATION = 30;
const BEST_SCORE_KEY = 'neonTargetRushBestScore';
const SOUND_ENABLED_KEY = 'neonTargetRushSoundEnabled';
const DIFFICULTIES = {
	easy: { size: 94, visibleTime: 2400 },
	normal: { size: 78, visibleTime: 1700 },
	hard: { size: 62, visibleTime: 1050 },
	insane: { size: 48, visibleTime: 650 }
};

let soundEnabled = localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';
const audioState = {
	context: null,
	masterGain: null,
	activeOscillators: new Set()
};

const gameState = {
	status: 'MENU',
	difficulty: 'normal',
	score: 0,
	combo: 0,
	timeLeft: GAME_DURATION,
	targetTimeout: null,
	timerInterval: null,
	bestScore: Number(localStorage.getItem(BEST_SCORE_KEY)) || 0
};

const elements = {
	playfield: document.querySelector('#playfield'),
	targetLayer: document.querySelector('#target-layer'),
	score: document.querySelector('#score'),
	time: document.querySelector('#time'),
	combo: document.querySelector('#combo'),
	bestScore: document.querySelector('#best-score'),
	startButton: document.querySelector('#start-button'),
	pauseButton: document.querySelector('#pause-button'),
	resumeButton: document.querySelector('#resume-button'),
	restartButton: document.querySelector('#restart-button'),
	menuPanel: document.querySelector('#menu-panel'),
	pausePanel: document.querySelector('#pause-panel'),
	gameOverPanel: document.querySelector('#game-over-panel'),
	finalScore: document.querySelector('#final-score'),
	newRecord: document.querySelector('#new-record'),
	hitMessage: document.querySelector('#hit-message'),
	soundButton: document.querySelector('#sound-button'),
	difficultyButtons: document.querySelectorAll('.difficulty-button')
};

function initAudio() {
	if (!soundEnabled) return Promise.resolve(false);
	const AudioContextClass = window.AudioContext || window.webkitAudioContext;
	if (!AudioContextClass) {
		console.warn('[Audio] Web Audio API is not available.');
		return Promise.resolve(false);
	}
	if (!audioState.context) {
		audioState.context = new AudioContextClass();
		audioState.masterGain = audioState.context.createGain();
		audioState.masterGain.gain.value = 0.16;
		audioState.masterGain.connect(audioState.context.destination);
		console.log('[Audio] initialized with one AudioContext.');
	}
	console.log(`[Audio] AudioContext state: ${audioState.context.state}`);
	const resumePromise = audioState.context.state === 'suspended'
		? audioState.context.resume()
		: Promise.resolve();
	return resumePromise.then(() => {
		console.log(`[Audio] AudioContext state: ${audioState.context.state}`);
		return audioState.context.state === 'running';
	}).catch((error) => {
		console.warn('[Audio] Could not resume AudioContext.', error);
		return false;
	});
}

function stopAllSounds() {
	audioState.activeOscillators.forEach((oscillator) => {
		try { oscillator.stop(); } catch (error) { /* The oscillator may already have ended. */ }
	});
	audioState.activeOscillators.clear();
}

function playTone(toneOptions) {
	if (!soundEnabled) return;
	initAudio().then((isReady) => {
		if (!isReady || !soundEnabled) return;
		const { frequency, endFrequency = frequency, duration = 0.08, type = 'sine', volume = 0.3, delay = 0 } = toneOptions;
		const { context, masterGain, activeOscillators } = audioState;
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		const startTime = context.currentTime + delay;
		const endTime = startTime + duration;
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(frequency, startTime);
		oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), endTime);
		gain.gain.setValueAtTime(0.001, startTime);
		gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.008);
		gain.gain.exponentialRampToValueAtTime(0.001, endTime);
		oscillator.connect(gain);
		gain.connect(masterGain);
		oscillator.addEventListener('ended', () => activeOscillators.delete(oscillator), { once: true });
		activeOscillators.add(oscillator);
		oscillator.start(startTime);
		oscillator.stop(endTime + 0.01);
	});
}

function playUiClick() {
	playTone({ frequency: 440, endFrequency: 320, duration: 0.045, type: 'square', volume: 0.11 });
}

function playTargetHit() {
	if (!soundEnabled) return;
	console.log(`[Audio] target-hit sound triggered at combo ${gameState.combo}.`);
	const pitch = Math.min(900, 600 + gameState.combo * 12);
	playTone({ frequency: pitch, endFrequency: pitch * 1.2, duration: 0.11, type: 'square', volume: 0.28 });
	if ([5, 10, 20, 30].includes(gameState.combo)) {
		playTone({ frequency: pitch * 1.45, endFrequency: pitch * 1.8, duration: 0.12, type: 'sine', volume: 0.2, delay: 0.035 });
	}
}

function playMiss() {
	playTone({ frequency: 130, endFrequency: 70, duration: 0.12, type: 'sawtooth', volume: 0.16 });
}

function playDifficultyUp() {
	playTone({ frequency: 420, endFrequency: 560, duration: 0.09, type: 'square', volume: 0.14 });
	playTone({ frequency: 560, endFrequency: 760, duration: 0.1, type: 'square', volume: 0.14, delay: 0.08 });
}

function playGameOver() {
	if (soundEnabled) console.log('[Audio] game-over sound triggered.');
	playTone({ frequency: 420, endFrequency: 300, duration: 0.13, type: 'triangle', volume: 0.18 });
	playTone({ frequency: 300, endFrequency: 170, duration: 0.18, type: 'triangle', volume: 0.18, delay: 0.12 });
}

function updateSoundButton() {
	elements.soundButton.textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
	elements.soundButton.setAttribute('aria-pressed', String(soundEnabled));
}

function formatNumber(value) {
	return String(value).padStart(4, '0');
}

function updateHud() {
	elements.score.textContent = formatNumber(gameState.score);
	elements.time.textContent = gameState.timeLeft.toFixed(1).padStart(4, '0');
	elements.combo.textContent = `x${gameState.combo}`;
	elements.bestScore.textContent = formatNumber(gameState.bestScore);
}

function setPanel(panelToShow) {
	[elements.menuPanel, elements.pausePanel, elements.gameOverPanel].forEach((panel) => panel.classList.add('is-hidden'));
	if (panelToShow) panelToShow.classList.remove('is-hidden');
}

function getDifficulty() {
	return DIFFICULTIES[gameState.difficulty];
}

function clearTarget() {
	clearTimeout(gameState.targetTimeout);
	gameState.targetTimeout = null;
	elements.targetLayer.replaceChildren();
}

function spawnTarget() {
	if (gameState.status !== 'PLAYING') return;
	clearTarget();
	const difficulty = getDifficulty();
	const target = document.createElement('button');
	target.className = 'target';
	target.type = 'button';
	target.setAttribute('aria-label', 'Hit target');
	target.style.setProperty('--target-size', `${difficulty.size}px`);
	target.style.left = `${12 + Math.random() * 76}%`;
	target.style.top = `${14 + Math.random() * 72}%`;
	target.innerHTML = '<span class="target-core"></span>';
	target.addEventListener('pointerdown', (event) => {
		event.preventDefault();
		hitTarget(target);
	});
	elements.targetLayer.append(target);
	gameState.targetTimeout = setTimeout(() => {
		if (gameState.status !== 'PLAYING') return;
		gameState.combo = 0;
		playMiss();
		updateHud();
		spawnTarget();
	}, difficulty.visibleTime);
}

function hitTarget(target) {
	if (gameState.status !== 'PLAYING' || target.classList.contains('hit')) return;
	clearTimeout(gameState.targetTimeout);
	target.classList.add('hit');
	gameState.combo += 1;
	playTargetHit();
	const multiplier = Math.min(4, 1 + Math.floor((gameState.combo - 1) / 5));
	const points = 10 * multiplier;
	gameState.score += points;
	updateHud();
	showHitMessage(target, `+${points}${multiplier > 1 ? `  x${multiplier}` : ''}`);
	setTimeout(spawnTarget, 170);
}

function showHitMessage(target, text) {
	const targetRect = target.getBoundingClientRect();
	const fieldRect = elements.playfield.getBoundingClientRect();
	elements.hitMessage.textContent = text;
	elements.hitMessage.style.left = `${targetRect.left - fieldRect.left + targetRect.width / 2}px`;
	elements.hitMessage.style.top = `${targetRect.top - fieldRect.top + targetRect.height / 2}px`;
	elements.hitMessage.classList.remove('show');
	void elements.hitMessage.offsetWidth;
	elements.hitMessage.classList.add('show');
}

function startGame() {
	initAudio();
	clearTarget();
	clearInterval(gameState.timerInterval);
	gameState.status = 'PLAYING';
	gameState.score = 0;
	gameState.combo = 0;
	gameState.timeLeft = GAME_DURATION;
	elements.pauseButton.disabled = false;
	setPanel(null);
	updateHud();
	spawnTarget();
	gameState.timerInterval = setInterval(() => {
		gameState.timeLeft = Math.max(0, gameState.timeLeft - 0.1);
		updateHud();
		if (gameState.timeLeft <= 0) endGame();
	}, 100);
}

function pauseGame() {
	if (gameState.status !== 'PLAYING') return;
	gameState.status = 'PAUSED';
	clearTimeout(gameState.targetTimeout);
	clearInterval(gameState.timerInterval);
	setPanel(elements.pausePanel);
}

function resumeGame() {
	if (gameState.status !== 'PAUSED') return;
	gameState.status = 'PLAYING';
	setPanel(null);
	spawnTarget();
	gameState.timerInterval = setInterval(() => {
		gameState.timeLeft = Math.max(0, gameState.timeLeft - 0.1);
		updateHud();
		if (gameState.timeLeft <= 0) endGame();
	}, 100);
}

function endGame() {
	if (gameState.status === 'GAME_OVER') return;
	gameState.status = 'GAME_OVER';
	clearTarget();
	clearInterval(gameState.timerInterval);
	elements.pauseButton.disabled = true;
	elements.finalScore.textContent = formatNumber(gameState.score);
	const isNewRecord = gameState.score > gameState.bestScore;
	if (isNewRecord) {
		gameState.bestScore = gameState.score;
		localStorage.setItem(BEST_SCORE_KEY, String(gameState.bestScore));
	}
	elements.newRecord.classList.toggle('is-hidden', !isNewRecord);
	updateHud();
	setPanel(elements.gameOverPanel);
	playGameOver();
}

function togglePause() {
	if (gameState.status === 'PLAYING') pauseGame();
	else if (gameState.status === 'PAUSED') resumeGame();
}

elements.startButton.addEventListener('click', () => { initAudio(); playUiClick(); startGame(); });
elements.restartButton.addEventListener('click', () => { initAudio(); playUiClick(); startGame(); });
elements.pauseButton.addEventListener('click', () => { playUiClick(); togglePause(); });
elements.resumeButton.addEventListener('click', () => { playUiClick(); resumeGame(); });
elements.difficultyButtons.forEach((button) => {
	button.addEventListener('click', () => {
		playUiClick();
		const difficultyOrder = ['easy', 'normal', 'hard', 'insane'];
		const previousDifficultyIndex = difficultyOrder.indexOf(gameState.difficulty);
		gameState.difficulty = button.dataset.difficulty;
		if (difficultyOrder.indexOf(gameState.difficulty) > previousDifficultyIndex) playDifficultyUp();
		elements.difficultyButtons.forEach((option) => {
			const isSelected = option === button;
			option.classList.toggle('is-selected', isSelected);
			option.setAttribute('aria-pressed', String(isSelected));
		});
	});
});
elements.soundButton.addEventListener('click', () => {
	soundEnabled = !soundEnabled;
	localStorage.setItem(SOUND_ENABLED_KEY, String(soundEnabled));
	if (!soundEnabled) stopAllSounds();
	updateSoundButton();
});
document.addEventListener('keydown', (event) => {
	if (event.code === 'Space') {
		event.preventDefault();
		togglePause();
	}
});

updateHud();
updateSoundButton();
