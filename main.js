const NEXT_QUESTION_DELAY = 1000;
const GAME_OVER_DELAY = 1000;
const EXTENDED_RESULT_DELAY = 1000;

const GAME_MODES = {
    MENU: 'menu',
    NORMAL: 'normal',
    TIMED: 'timed',
    ENDLESS: 'endless',
    RANDOM_START: 'random_start'
};

const defaultGameData = {
    settings: {
        normalQuestions: 10,
        timedDuration: 60000,
        composerFilter: 'All',
    },
    stats: {
        highScores: { normal: 0, timed: 0, endless: 0, random_start: 0 },
        songStats: {},
    }
};

let player;
let correctAnswer = '';
let currentVideoId = '';
let gameTimer = null;
let gameData = {};
let currentPlaylist = [];
let answeredVideos = [];

let gameState = {
    mode: GAME_MODES.MENU,
    score: 0,
    totalQuestions: 0,
    endlessStreak: 0,
    timeLeftMs: 0,
    answerChecked: false,
};

const domElements = {};

function loadGameData() {
    const savedData = localStorage.getItem('blueArchiveQuizData');
    gameData = savedData ? JSON.parse(savedData) : JSON.parse(JSON.stringify(defaultGameData));
}

function saveGameData() {
    localStorage.setItem('blueArchiveQuizData', JSON.stringify(gameData));
}

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '0',
        width: '0',
        videoId: '',
        playerVars: {
            'autoplay': 0,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    document.getElementById('loading-overlay').style.display = 'none';
    document.getElementById('start-prompt').style.display = 'flex';
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        document.getElementById('pauseBtn').textContent = '一時停止';
    } else {
        document.getElementById('pauseBtn').textContent = '再生';
    }
}

function initGame() {
    gameState.mode = GAME_MODES.MENU;
    clearInterval(gameTimer);
    if (player && player.stopVideo) player.stopVideo();

    domElements.mainMenu.style.display = 'flex';
    domElements.gameView.style.display = 'none';
    domElements.settingsScreen.style.display = 'none';
    domElements.statsScreen.style.display = 'none';
    domElements.result.style.display = 'none';
    domElements.answerDetails.style.display = 'none';
}

function startGame(mode) {
    gameState.mode = mode;
    gameState.score = 0;
    gameState.totalQuestions = 0;
    gameState.endlessStreak = 0;
    gameState.answerChecked = false;
    answeredVideos = [];

    let filtered = playlist;
    if (gameData.settings.composerFilter !== 'All') {
        filtered = playlist.filter(s => s.composer.includes(gameData.settings.composerFilter));
    }
    currentPlaylist = [...filtered].sort(() => Math.random() - 0.5);

    domElements.mainMenu.style.display = 'none';
    domElements.gameView.style.display = 'flex';
    
    if (mode === GAME_MODES.TIMED) {
        gameState.timeLeftMs = gameData.settings.timedDuration;
        startTimedMode();
    }
    
    playNextQuestion();
}

function playNextQuestion() {
    gameState.answerChecked = false;
    domElements.result.style.display = 'none';
    domElements.answerDetails.style.display = 'none';
    
    const availableSongs = currentPlaylist.filter(s => !answeredVideos.includes(s.videoId));
    if (availableSongs.length === 0 || (gameState.mode === GAME_MODES.NORMAL && gameState.totalQuestions >= gameData.settings.normalQuestions)) {
        endGame();
        return;
    }

    const currentSong = availableSongs[0];
    currentVideoId = currentSong.videoId;
    correctAnswer = currentSong.title;
    answeredVideos.push(currentVideoId);
    gameState.totalQuestions++;

    updateProgress();

    const choices = generateChoices(currentSong.title);
    displayChoices(choices);

    let startSeconds = 0;
    if (gameState.mode === GAME_MODES.RANDOM_START) {
        startSeconds = Math.floor(Math.random() * 151);
    }

    player.loadVideoById({
        videoId: currentVideoId,
        startSeconds: startSeconds
    });
}

function generateChoices(correctTitle) {
    const others = playlist.filter(s => s.title !== correctTitle).sort(() => Math.random() - 0.5);
    const choices = [correctTitle, others[0].title, others[1].title, others[2].title];
    return choices.sort(() => Math.random() - 0.5);
}

function displayChoices(choices) {
    domElements.choices.innerHTML = '';
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.textContent = choice;
        btn.onclick = () => checkAnswer(choice);
        domElements.choices.appendChild(btn);
    });
}

function checkAnswer(selected) {
    if (gameState.answerChecked) return;
    gameState.answerChecked = true;

    const buttons = domElements.choices.querySelectorAll('button');
    let isCorrect = selected === correctAnswer;

    buttons.forEach(btn => {
        if (btn.textContent === correctAnswer) {
            btn.classList.add('correct');
        } else if (btn.textContent === selected && !isCorrect) {
            btn.classList.add('incorrect');
        }
    });

    if (isCorrect) {
        gameState.score++;
        domElements.result.textContent = '正解！';
        domElements.result.style.color = 'var(--green-primary)';
    } else {
        domElements.result.textContent = '不正解...';
        domElements.result.style.color = 'var(--red-primary)';
    }
    domElements.result.style.display = 'flex';

    showAnswerDetails();

    if (gameState.mode === GAME_MODES.ENDLESS && !isCorrect) {
        setTimeout(endGame, EXTENDED_RESULT_DELAY);
    } else {
        setTimeout(playNextQuestion, NEXT_QUESTION_DELAY + 500);
    }
}

function showAnswerDetails() {
    const song = playlist.find(s => s.videoId === currentVideoId);
    domElements.answerDetails.innerHTML = `
        <strong>${song.title}</strong><br>
        作曲: ${song.composer}<br>
        ${song.context ? '詳細: ' + song.context : ''}
    `;
    domElements.answerDetails.style.display = 'block';
}

function updateProgress() {
    if (gameState.mode === GAME_MODES.NORMAL || gameState.mode === GAME_MODES.RANDOM_START) {
        const progress = (gameState.totalQuestions / gameData.settings.normalQuestions) * 100;
        domElements.progressBarFill.style.width = `${progress}%`;
        domElements.progressText.textContent = `第 ${gameState.totalQuestions} 問 / 全 ${gameData.settings.normalQuestions} 問`;
    } else {
        domElements.progressBarFill.style.width = '100%';
        domElements.progressText.textContent = `第 ${gameState.totalQuestions} 問`;
    }
    domElements.scoreDisplay.textContent = `スコア: ${gameState.score}`;
}

function startTimedMode() {
    gameTimer = setInterval(() => {
        gameState.timeLeftMs -= 100;
        if (gameState.timeLeftMs <= 0) {
            clearInterval(gameTimer);
            endGame();
        }
        domElements.timeDisplay.textContent = `残り: ${(gameState.timeLeftMs / 1000).toFixed(1)}s`;
    }, 100);
}

function endGame() {
    clearInterval(gameTimer);
    if (player && player.stopVideo) player.stopVideo();

    const modeKey = gameState.mode;
    if (gameState.score > (gameData.stats.highScores[modeKey] || 0)) {
        gameData.stats.highScores[modeKey] = gameState.score;
        saveGameData();
    }

    alert(`ゲーム終了！\n最終スコア: ${gameState.score}`);
    initGame();
}

function showSettings() {
    domElements.mainMenu.style.display = 'none';
    domElements.settingsScreen.style.display = 'block';
    domElements.settingsScreen.innerHTML = `
        <h2>設定</h2>
        <div class="setting-item">
            <label>問題数 (ノーマル): </label>
            <input type="number" value="${gameData.settings.normalQuestions}" onchange="gameData.settings.normalQuestions=parseInt(this.value);saveGameData();">
        </div>
        <button onclick="initGame()">戻る</button>
    `;
}

function showStats() {
    domElements.mainMenu.style.display = 'none';
    domElements.statsScreen.style.display = 'block';
    domElements.statsScreen.innerHTML = `
        <h2>統計</h2>
        <div class="stats-grid">
            <p>ノーマル最高スコア: ${gameData.stats.highScores.normal}</p>
            <p>タイムアタック最高: ${gameData.stats.highScores.timed}</p>
            <p>エンドレス最高記録: ${gameData.stats.highScores.endless}</p>
            <p>ランダムスタート最高: ${gameData.stats.highScores.random_start || 0}</p>
        </div>
        <button onclick="initGame()">戻る</button>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    loadGameData();
    domElements.mainMenu = document.getElementById('main-menu');
    domElements.gameView = document.getElementById('game-view');
    domElements.settingsScreen = document.getElementById('settings-screen');
    domElements.statsScreen = document.getElementById('stats-screen');
    domElements.progressText = document.getElementById('progress-text');
    domElements.progressBarFill = document.getElementById('progress-bar-fill');
    domElements.scoreDisplay = document.getElementById('score');
    domElements.timeDisplay = document.getElementById('time-display');
    domElements.choices = document.getElementById('choices');
    domElements.result = document.getElementById('result');
    domElements.answerDetails = document.getElementById('answer-details');
    domElements.volumeSlider = document.getElementById('volumeSlider');

    document.getElementById('start-prompt-btn').onclick = () => {
        document.getElementById('start-prompt').style.display = 'none';
        initGame();
    };

    document.getElementById('replayBtn').onclick = () => {
        if (player) player.seekTo(0);
    };

    document.getElementById('pauseBtn').onclick = () => {
        const state = player.getPlayerState();
        state === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
    };

    domElements.volumeSlider.oninput = (e) => {
        if (player) player.setVolume(e.target.value);
    };
});
