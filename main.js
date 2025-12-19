const NEXT_QUESTION_DELAY = 1500;
const GAME_OVER_DELAY = 1000;

const GAME_MODES = {
    MENU: 'menu',
    NORMAL: 'normal',
    TIMED: 'timed',
    ENDLESS: 'endless'
};

let player;
let currentVideoId = '';
let correctAnswer = '';
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
    answerChecked: false
};

const domElements = {};

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '0', width: '0', videoId: '',
        playerVars: { 'playsinline': 1, 'controls': 0, 'disablekb': 1 },
        events: { 'onReady': onPlayerReady }
    });
}

function onPlayerReady(event) {
    document.getElementById('loading-overlay').style.display = 'none';
    loadGameData();
    initGame();
}

function loadGameData() {
    const saved = localStorage.getItem('ba_quiz_data');
    gameData = saved ? JSON.parse(saved) : {
        stats: { highScores: { normal: 0, timed: 0, endless: 0 }, songStats: {} },
        settings: { normalQuestions: 10, timedDuration: 60000, composerFilter: 'All' }
    };
}

function saveGameData() {
    localStorage.setItem('ba_quiz_data', JSON.stringify(gameData));
}

function initGame() {
    gameState.mode = GAME_MODES.MENU;
    if (gameTimer) clearInterval(gameTimer);
    showScreen('main-menu');
    
    const container = document.getElementById('main-menu');
    container.innerHTML = `
        <button onclick="selectMode('${GAME_MODES.NORMAL}')" style="width:100%; margin: 10px 0;">ノーマルモード</button>
        <button onclick="selectMode('${GAME_MODES.TIMED}')" style="width:100%; margin: 10px 0;">タイムアタック</button>
        <button onclick="selectMode('${GAME_MODES.ENDLESS}')" style="width:100%; margin: 10px 0;">エンドレス</button>
    `;
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById(screenId).style.display = 'block';
}

function selectMode(mode) {
    gameState.mode = mode;
    if (mode === GAME_MODES.ENDLESS) {
        showStartPrompt();
    } else {
        setupModeSettings();
    }
}

function setupModeSettings() {
    showScreen('settings-screen');
    const container = document.getElementById('settings-screen');
    container.innerHTML = `
        <h3>設定</h3>
        <p>準備ができたら開始してください</p>
        <button onclick="showStartPrompt()" style="background: var(--blue-primary); color:white; width:100%; margin-top:20px;">クイズを開始する</button>
        <button onclick="initGame()" style="width:100%; margin-top:10px;">戻る</button>
    `;
}

function showStartPrompt() {
    const prompt = document.getElementById('start-prompt');
    prompt.style.display = 'flex';
    document.getElementById('start-prompt-btn').onclick = () => {
        prompt.style.display = 'none';
        if (player) {
            player.unMute();
            player.setVolume(domElements.volumeSlider.value);
            player.playVideo(); 
        }
        launchQuiz();
    };
}

function launchQuiz() {
    gameState.score = 0;
    gameState.totalQuestions = 0;
    gameState.endlessStreak = 0;
    answeredVideos = [];
    currentPlaylist = [...playlist];

    showScreen('game-view');
    if (gameState.mode === GAME_MODES.TIMED) {
        startTimer();
    }
    loadNextQuiz();
}

function loadNextQuiz() {
    gameState.answerChecked = false;
    document.getElementById('result').innerText = '';
    document.getElementById('answer-details').innerText = '';
    
    updateUI();

    let available = currentPlaylist.filter(v => !answeredVideos.includes(v.videoId));
    if (available.length === 0) {
        answeredVideos = [];
        available = [...currentPlaylist];
    }
    
    const song = available[Math.floor(Math.random() * available.length)];
    
    correctAnswer = song.title;
    currentVideoId = song.videoId;
    answeredVideos.push(currentVideoId);

    playMusic();
    displayChoices();
}

function playMusic() {
    if (!player) return;
    player.loadVideoById({ videoId: currentVideoId, startSeconds: 0 });
    player.unMute();
    player.playVideo();
}

function displayChoices() {
    const choices = [correctAnswer];
    while(choices.length < 4) {
        const rand = playlist[Math.floor(Math.random() * playlist.length)].title;
        if(!choices.includes(rand)) choices.push(rand);
    }
    choices.sort(() => Math.random() - 0.5);

    const container = document.getElementById('choices');
    container.innerHTML = '';
    choices.forEach(c => {
        const btn = document.createElement('button');
        btn.textContent = c;
        btn.onclick = () => checkAnswer(c, btn);
        container.appendChild(btn);
    });
}

function checkAnswer(selected, btn) {
    if (gameState.answerChecked) return;
    gameState.answerChecked = true;
    
    const buttons = document.querySelectorAll('#choices button');
    buttons.forEach(b => {
        b.disabled = true;
        if (b.textContent === correctAnswer) b.classList.add('correct');
        else if (b.textContent === selected) b.classList.add('incorrect');
    });

    if (selected === correctAnswer) {
        gameState.score++;
        gameState.endlessStreak++;
        document.getElementById('result').innerText = '✅ 正解！';
    } else {
        document.getElementById('result').innerText = `❌ 不正解... (正解: ${correctAnswer})`;
        if (gameState.mode === GAME_MODES.ENDLESS) {
            setTimeout(endGame, GAME_OVER_DELAY);
            return;
        }
    }

    gameState.totalQuestions++;
    
    if (gameState.mode === GAME_MODES.NORMAL && gameState.totalQuestions >= gameData.settings.normalQuestions) {
        setTimeout(endGame, NEXT_QUESTION_DELAY);
    } else {
        setTimeout(loadNextQuiz, NEXT_QUESTION_DELAY);
    }
}

function updateUI() {
    if (gameState.mode === GAME_MODES.NORMAL) {
        const prog = (gameState.totalQuestions / gameData.settings.normalQuestions) * 100;
        document.getElementById('progress-bar-fill').style.width = `${prog}%`;
        document.getElementById('progress-text').innerText = `第 ${gameState.totalQuestions + 1} 問 / ${gameData.settings.normalQuestions} 問`;
    }
    document.getElementById('score').innerText = `現在のスコア: ${gameState.score}`;
}

function startTimer() {
    gameState.timeLeftMs = gameData.settings.timedDuration;
    gameTimer = setInterval(() => {
        gameState.timeLeftMs -= 100;
        document.getElementById('time-display').innerText = `残り時間: ${(gameState.timeLeftMs/1000).toFixed(1)}秒`;
        if (gameState.timeLeftMs <= 0) {
            clearInterval(gameTimer);
            endGame();
        }
    }, 100);
}

function endGame() {
    if (gameTimer) clearInterval(gameTimer);
    player.stopVideo();
    alert(`終了です！\nあなたのスコア: ${gameState.score}`);
    saveGameData();
    initGame();
}

document.addEventListener('DOMContentLoaded', () => {
    domElements.volumeSlider = document.getElementById('volumeSlider');
    document.getElementById('replayBtn').onclick = () => { if(player) { player.seekTo(0); player.playVideo(); } };
    
    domElements.volumeSlider.oninput = (e) => {
        if(player) player.setVolume(e.target.value);
    };
});
