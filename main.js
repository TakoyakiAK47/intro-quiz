const NEXT_QUESTION_DELAY = 1000;
const GAME_OVER_DELAY = 1000;
const EXTENDED_RESULT_DELAY = 1000; 

const GAME_MODES = {
    MENU: 'menu',
    NORMAL: 'normal',
    TIMED: 'timed',
    ENDLESS: 'endless',
    ENCYCLOPEDIA: 'encyclopedia'
};

const defaultGameData = {
    settings: {
        normalQuestions: 10,
        timedDuration: 60000,
        composerFilter: 'All',
    },
    stats: {
        highScores: { normal: 0, timed: 0, endless: 0 },
        songStats: {},
    },
    achievements: {
        normal: false, hard: false, veryhard: false, hardcore: false,
        extreme: false, insane: false, torment: false, lunatic: false
    },
};


let player;
let correctAnswer = '';
let currentVideoId = '';
let gameTimer = null;
let gameData = {};
let currentPlaylist = [];
let answeredVideos = [];

let currentEncyclopediaPlaylist = [];

let gameState = {
    mode: GAME_MODES.MENU,
    score: 0,
    totalQuestions: 0,
    endlessStreak: 0,
    timeLeftMs: 0,
    answerChecked: false,
};


const domElements = {};

const INTRO_VIDEO_ID = "ISZ8lKOVapA";
let introPlayer;
let introPlayed = false;


function saveGameData() {
    try {
        localStorage.setItem('blueArchiveQuizDataV2', JSON.stringify(gameData));
    } catch (e) {
        console.error("Failed to save game data:", e);
    }
}

function loadGameData() {
    try {
        const storedData = localStorage.getItem('blueArchiveQuizDataV2');
        gameData = storedData ? JSON.parse(storedData) : defaultGameData;
        
        if (!gameData.stats) gameData.stats = defaultGameData.stats;
        if (!gameData.achievements) gameData.achievements = defaultGameData.achievements;
        
        if (typeof gameData.settings.timedDuration !== 'number') {
            gameData.settings.timedDuration = defaultGameData.settings.timedDuration;
        }
    } catch (e) {
        console.error("Failed to load game data or data corrupted. Using default.", e);
        gameData = defaultGameData;
    }
}

function updateStats(isCorrect, answerTime) {
    if (!gameData.stats.songStats[currentVideoId]) {
        gameData.stats.songStats[currentVideoId] = { correct: 0, total: 0, fastestTime: null };
    }

    gameData.stats.songStats[currentVideoId].total++;
    if (isCorrect) {
        gameData.stats.songStats[currentVideoId].correct++;
        if (gameData.stats.songStats[currentVideoId].fastestTime === null || answerTime < gameData.stats.songStats[currentVideoId].fastestTime) {
            gameData.stats.songStats[currentVideoId].fastestTime = answerTime;
        }
    }
    saveGameData();
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
    });

    domElements.mainMenu.style.display = 'none';
    domElements.gameView.style.display = 'none';
    domElements.encyclopedia.style.display = 'none';
    domElements.settingsScreen.style.display = 'none';
    domElements.statsScreen.style.display = 'none';
    domElements.startPrompt.style.display = 'none';

    switch(screenId) {
        case 'main-menu':
            domElements.mainMenu.style.display = 'flex';
            break;
        case 'game-view':
            domElements.gameView.style.display = 'flex';
            break;
        case 'encyclopedia':
            domElements.encyclopedia.style.display = 'block';
            break;
        case 'settings-screen':
            domElements.settingsScreen.style.display = 'block';
            break;
        case 'stats-screen':
            domElements.statsScreen.style.display = 'block';
            break;
    }
}

function initGame() {
    if (player && typeof player.destroy === 'function') {
        player.destroy();
        player = null;
    }
    
    if (introPlayer && typeof introPlayer.destroy === 'function') {
        introPlayer.destroy();
        introPlayer = null;
    }

    gameState.mode = GAME_MODES.MENU;
    showScreen('main-menu');

    createMainMenuButtons();

    if (!introPlayed) {
        showStartPrompt();
    }
}


function playIntroMusic() {
    if (introPlayed) return;

    domElements.startPrompt.style.display = 'none';
    introPlayed = true;

    showScreen('main-menu');

    introPlayer = new YT.Player('player', {
        height: '0',
        width: '0',
        videoId: INTRO_VIDEO_ID,
        playerVars: {
            controls: 0,
            autoplay: 1,
            loop: 1,
            mute: 0,
            rel: 0,
            playlist: INTRO_VIDEO_ID
        },
        events: {
            onReady: (e) => {
                const volume = domElements.volumeSlider ? domElements.volumeSlider.value : 25;
                e.target.setVolume(volume);
                e.target.playVideo();
            }
        }
    });
}


function showStartPrompt() {
    showScreen('main-menu');
    domElements.startPrompt.style.display = 'flex';
    domElements.startPromptBtn.textContent = 'Are you ready?';
    domElements.startPromptBtn.onclick = playIntroMusic;
}

function createMainMenuButtons() {
    domElements.mainMenu.innerHTML = '';
    
    const modes = [
        { name: 'ノーマルモード', mode: GAME_MODES.NORMAL, description: '10問のクイズに挑戦' },
        { name: 'タイムアタックモード', mode: GAME_MODES.TIMED, description: '60秒間で何問正解できるか' },
        { name: 'エンドレスモード', mode: GAME_MODES.ENDLESS, description: '間違えるまで続く耐久戦' },
    ];

    modes.forEach(m => {
        const button = document.createElement('button');
        button.textContent = m.name;
        button.onclick = () => showSettings(m.mode);
        domElements.mainMenu.appendChild(button);
    });
    
    const encyclopediaBtn = document.createElement('button');
    encyclopediaBtn.textContent = '曲の事典';
    encyclopediaBtn.onclick = () => showEncyclopedia();
    domElements.mainMenu.appendChild(encyclopediaBtn);

    const statsBtn = document.createElement('button');
    statsBtn.textContent = '成績・設定';
    statsBtn.onclick = () => showStatsScreen();
    domElements.mainMenu.appendChild(statsBtn);
}

function showSettings(mode) {
    gameState.mode = mode;
    showScreen('settings-screen');
    domElements.settingsScreen.innerHTML = `
        <h2>${mode === GAME_MODES.NORMAL ? 'ノーマルモード設定' : mode === GAME_MODES.TIMED ? 'タイムアタック設定' : 'エンドレスモード設定'}</h2>
    `;
    
    if (mode === GAME_MODES.NORMAL) {
        domElements.settingsScreen.innerHTML += `
            <div class="setting-item">
                <label for="normalQuestions">問題数:</label>
                <select id="normalQuestions">
                    <option value="5">5問</option>
                    <option value="10">10問</option>
                    <option value="20">20問</option>
                </select>
            </div>
        `;
        document.getElementById('normalQuestions').value = gameData.settings.normalQuestions;
    } else if (mode === GAME_MODES.TIMED) {
         domElements.settingsScreen.innerHTML += `
            <div class="setting-item">
                <label for="timedDuration">制限時間:</label>
                <select id="timedDuration">
                    <option value="30000">30秒</option>
                    <option value="60000">60秒</option>
                    <option value="120000">120秒</option>
                </select>
            </div>
        `;
        document.getElementById('timedDuration').value = gameData.settings.timedDuration;
    }

    const composers = ['All', ...new Set(playlist.map(s => s.composer).filter(c => c && c !== 'Unknown').sort())];
    let composerOptions = composers.map(c => `<option value="${c}">${c}</option>`).join('');

    domElements.settingsScreen.innerHTML += `
        <div class="setting-item">
            <label for="composerFilter">作曲家フィルター:</label>
            <select id="composerFilter">
                ${composerOptions}
            </select>
        </div>
        <div id="settings-buttons" style="margin-top: 2em; display: flex; justify-content: center; gap: 1em;">
            <button onclick="initGame()" style="background-color: var(--red-primary); color: white; width: 150px;">キャンセル</button>
            <button onclick="saveSettingsAndStart()" style="background-color: var(--green-primary); color: white; width: 150px;">クイズ開始</button>
        </div>
    `;
    
    document.getElementById('composerFilter').value = gameData.settings.composerFilter;
}

function saveSettingsAndStart() {
    if (gameState.mode === GAME_MODES.NORMAL) {
        gameData.settings.normalQuestions = parseInt(document.getElementById('normalQuestions').value);
    } else if (gameState.mode === GAME_MODES.TIMED) {
        gameData.settings.timedDuration = parseInt(document.getElementById('timedDuration').value);
    }
    gameData.settings.composerFilter = document.getElementById('composerFilter').value;
    saveGameData();
    launchQuiz();
}

function launchQuiz() {
    if (introPlayer && typeof introPlayer.destroy === 'function') {
        introPlayer.destroy();
        introPlayer = null;
    }
    
    gameState.score = 0;
    gameState.totalQuestions = 0;
    gameState.endlessStreak = 0;
    gameState.answerChecked = false;
    answeredVideos = [];
    
    const quizPlaylist = playlist.filter(song => song.quiz !== false);
    
    const filter = gameData.settings.composerFilter;
    currentPlaylist = (gameState.mode === GAME_MODES.NORMAL && filter !== 'All') 
        ? quizPlaylist.filter(song => song.composer === filter) 
        : [...quizPlaylist];
    
    if (currentPlaylist.length < 4) {
        alert('選択した楽曲が4曲未満のため、クイズを開始できません。');
        initGame();
        return;
    } 
    
    showScreen('game-view');
    // domElements.gameControlsContainer が存在しない場合があるためチェック
    if (domElements.gameControlsContainer) {
        domElements.gameControlsContainer.style.display = 'block';
    }
    
    if (gameState.mode === GAME_MODES.TIMED) {
        gameState.timeLeftMs = gameData.settings.timedDuration;
        if (gameTimer) clearInterval(gameTimer);
        gameTimer = setInterval(() => {
            gameState.timeLeftMs -= 10;
            if (gameState.timeLeftMs <= 0) {
                gameState.timeLeftMs = 0;
                endGame();
            }
            updateTimeDisplay(gameState.timeLeftMs);
        }, 10);
    }
    
    // プレイヤーが未定義の場合、クイズ用に初期化します
    if (!player) {
         player = new YT.Player('player', {
            height: '0', 
            width: '0',
            playerVars: {
                controls: 0,
                autoplay: 1,
                mute: 0,
                rel: 0,
            },
            events: {
                onReady: (e) => {
                    const volume = domElements.volumeSlider ? domElements.volumeSlider.value : 25;
                    e.target.setVolume(volume);
                    loadNextQuiz();
                },
                onStateChange: onPlayerStateChange
            }
        });
    } else {
        // プレイヤーが既に存在する場合は次のクイズをロード
        loadNextQuiz();
    }
}

function loadNextQuiz() {
    if (gameTimer) clearInterval(gameTimer);
    
    if (gameState.mode === GAME_MODES.NORMAL && gameState.totalQuestions >= gameData.settings.normalQuestions) {
        endGame();
        return;
    }
    
    if (currentPlaylist.length === 0) {
        alert('クイズに使える曲がありません。');
        initGame();
        return;
    }

    domElements.choices.innerHTML = '';
    domElements.result.style.display = 'none';
    domElements.answerDetails.style.display = 'none';
    domElements.score.textContent = `正解数: ${gameState.score} / ${gameState.totalQuestions}`;
    domElements.answerChecked = false;

    let availableSongs = currentPlaylist.filter(song => !answeredVideos.includes(song.videoId));
    if (availableSongs.length === 0) {
        if (gameState.mode === GAME_MODES.ENDLESS) {
            answeredVideos = [];
            availableSongs = currentPlaylist;
        } else {
            endGame();
            return;
        }
    }
    
    const correctAnswerSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
    currentVideoId = correctAnswerSong.videoId;
    correctAnswer = correctAnswerSong.title;
    answeredVideos.push(currentVideoId);

    const correctIndex = Math.floor(Math.random() * 4);
    let options = new Set();
    options.add(correctAnswer);

    while (options.size < 4) {
        const randomSong = currentPlaylist[Math.floor(Math.random() * currentPlaylist.length)];
        options.add(randomSong.title);
    }

    const shuffledOptions = Array.from(options);
    
    if (shuffledOptions[correctIndex] !== correctAnswer) {
        const temp = shuffledOptions[correctIndex];
        shuffledOptions[shuffledOptions.indexOf(correctAnswer)] = temp;
        shuffledOptions[correctIndex] = correctAnswer;
    }
    
    shuffledOptions.forEach(title => {
        const button = document.createElement('button');
        button.textContent = title;
        button.onclick = () => checkAnswer(button, title);
        domElements.choices.appendChild(button);
    });

    if (gameState.mode === GAME_MODES.NORMAL || gameState.mode === GAME_MODES.ENDLESS) {
        domElements.progressText.textContent = `第 ${gameState.totalQuestions + 1} 問`;
        const progress = gameState.mode === GAME_MODES.NORMAL ? ((gameState.totalQuestions) / gameData.settings.normalQuestions) * 100 : 0;
        if (domElements.progressBarFill) {
            domElements.progressBarFill.style.width = `${progress}%`;
        }
        domElements.progressContainer.style.display = 'block';
        if (domElements.timeDisplay) {
            domElements.timeDisplay.style.display = 'none';
        }
    } else {
        domElements.progressContainer.style.display = 'none';
        domElements.timeDisplay.style.display = 'block';
        if (gameTimer) { 
            gameTimer = setInterval(() => {
                gameState.timeLeftMs -= 10;
                if (gameState.timeLeftMs <= 0) {
                    gameState.timeLeftMs = 0;
                    endGame();
                }
                updateTimeDisplay(gameState.timeLeftMs);
            }, 10);
        }
    }

    playIntroClip(currentVideoId);
}

function playIntroClip(videoId) {
    if (player) {
        player.loadVideoById({
            videoId: videoId,
            startSeconds: 0,
            endSeconds: 10,
            suggestedQuality: 'small'
        });
        const volume = domElements.volumeSlider ? domElements.volumeSlider.value : 25;
        player.setVolume(volume);
        
        if (domElements.pauseBtn) {
            domElements.pauseBtn.textContent = '一時停止';
            domElements.pauseBtn.onclick = () => {
                if (player.getPlayerState() === YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                    domElements.pauseBtn.textContent = '再生';
                } else {
                    player.playVideo();
                    domElements.pauseBtn.textContent = '一時停止';
                }
            };
        }
    }
}

function onPlayerStateChange(event) {
    if (gameState.answerChecked) return; 
    if (!domElements.pauseBtn) return; 

    if (event.data === YT.PlayerState.ENDED) {
        player.seekTo(0, true);
        player.playVideo();
    } else if (event.data === YT.PlayerState.PAUSED) {
         domElements.pauseBtn.textContent = '再生';
    } else if (event.data === YT.PlayerState.PLAYING) {
         domElements.pauseBtn.textContent = '一時停止';
    }
}

function checkAnswer(button, selectedAnswer) {
    if (gameState.answerChecked) return;

    gameState.answerChecked = true;
    gameState.totalQuestions++;
    
    domElements.choices.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === correctAnswer) {
            btn.classList.add('correct');
        } else if (btn === button) {
            btn.classList.add('incorrect');
        }
    });

    const isCorrect = (selectedAnswer === correctAnswer);
    const resultElement = domElements.result;
    
    let answerTime = -1;
    if (gameState.mode === GAME_MODES.TIMED) {
        answerTime = gameData.settings.timedDuration - gameState.timeLeftMs;
    }
    
    updateStats(isCorrect, answerTime);

    if (isCorrect) {
        gameState.score++;
        gameState.endlessStreak++;
        resultElement.textContent = '正解！🎉';
        resultElement.style.color = varStyles.greenPrimary;
    } else {
        gameState.endlessStreak = 0;
        resultElement.textContent = '不正解...😭';
        resultElement.style.color = varStyles.redPrimary;
    }
    resultElement.style.display = 'flex';

    const song = currentPlaylist.find(s => s.videoId === currentVideoId) || { title: '不明', composer: '不明', context: '不明' };
    domElements.answerDetails.innerHTML = `
        <strong>正解の曲:</strong> ${song.title}<br>
        <strong>作曲者:</strong> ${song.composer || 'Unknown'}<br>
        <div style="margin-top: 0.5em;"><a href="https://www.youtube.com/watch?v=${currentVideoId}" target="_blank" class="yt-button" style="font-size: 1em; padding: 0.5em 1em;">YouTubeでフル再生</a></div>
    `;
    domElements.answerDetails.style.display = 'block';

    domElements.score.textContent = `正解数: ${gameState.score} / ${gameState.totalQuestions}`;
    
    if (player && typeof player.seekTo === 'function') {
        player.seekTo(0);
        player.playVideo();
    }
    
    const delay = isCorrect ? NEXT_QUESTION_DELAY : EXTENDED_RESULT_DELAY;

    if (gameState.mode === GAME_MODES.ENDLESS && !isCorrect) {
        setTimeout(endGame, delay);
    } else {
        setTimeout(loadNextQuiz, delay + 1000);
    }
}

function endGame() {
    if (gameTimer) clearInterval(gameTimer);
    
    const finalScore = gameState.score;
    const finalTotal = gameState.totalQuestions;
    const modeName = gameState.mode === GAME_MODES.NORMAL ? 'ノーマル' : gameState.mode === GAME_MODES.TIMED ? 'タイムアタック' : 'エンドレス';
    
    let resultMessage = `お疲れ様！${modeName}モードの結果です。`;
    let detailMessage = `正解数: ${finalScore} / ${finalTotal} 問`;

    const currentHighScore = gameData.stats.highScores[gameState.mode] || 0;
    if (finalScore > currentHighScore) {
        resultMessage = `✨ハイスコア更新！🎉`;
        gameData.stats.highScores[gameState.mode] = finalScore;
        saveGameData();
    } else if (gameState.mode === GAME_MODES.ENDLESS) {
        detailMessage = `連勝ストップ。最高記録: ${currentHighScore} 連勝`;
    }

    domElements.result.innerHTML = `<span class="large-display-text">${finalScore}</span><br>${resultMessage}`;
    domElements.result.style.color = 'var(--blue-dark)';
    domElements.answerDetails.innerHTML = detailMessage;
    domElements.answerDetails.style.display = 'block';
    
    domElements.choices.innerHTML = '';
    if (domElements.timeDisplay) {
        domElements.timeDisplay.style.display = 'none';
    }
    domElements.progressContainer.style.display = 'none';
    if (domElements.gameControlsContainer) {
        domElements.gameControlsContainer.style.display = 'none';
    }
    
    setTimeout(() => {
        domElements.choices.innerHTML = `
            <button onclick="launchQuiz()" style="background-color: var(--blue-primary); color: white;">もう一度挑戦</button>
            <button onclick="initGame()" style="background-color: var(--grey-mid); color: white;">ホームに戻る</button>
        `;
    }, GAME_OVER_DELAY);
}

function updateTimeDisplay(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    domElements.timeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

const varStyles = {};
document.addEventListener('DOMContentLoaded', () => {
    const rootStyles = getComputedStyle(document.documentElement);
    varStyles.greenPrimary = rootStyles.getPropertyValue('--green-primary').trim();
    varStyles.redPrimary = rootStyles.getPropertyValue('--red-primary').trim();
});


function showEncyclopedia() {
    showScreen('encyclopedia');
    domElements.encyclopedia.innerHTML = `
        <h2>曲の事典</h2>
        <div id="encyclopedia-controls">
            <input type="text" id="encyclopedia-search" placeholder="曲名、作曲者で検索..." oninput="filterSongList(this.value)">
            <button onclick="initGame()" style="background-color: var(--red-primary); color: white;">ホームに戻る</button>
        </div>
        <div id="encyclopedia-layout">
            <div id="song-list-container">
                <div id="song-list"></div>
            </div>
            <div id="encyclopedia-details">
                <h3>曲の情報</h3>
                <p>リストから曲を選択してください。</p>
            </div>
        </div>
    `;

    currentEncyclopediaPlaylist = [...playlist].sort((a, b) => a.title.localeCompare(b.title, 'ja'));
    renderSongList(currentEncyclopediaPlaylist);
}

function renderSongList(list) {
    const songList = document.getElementById('song-list');
    songList.innerHTML = '';

    list.forEach(song => {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-videoid', song.videoId);
        card.innerHTML = `
            <img src="${song.imageUrl || 'default_bg.png'}" alt="${song.title}" class="song-card-image">
            <div class="song-card-info">
                <p class="song-card-title">${song.title}</p>
                <p class="song-card-composer">${song.composer || 'Unknown'}</p>
            </div>
        `;
        card.onclick = () => showSongDetails(song);
        songList.appendChild(card);
    });
}

function filterSongList(query) {
    const filterText = query.toLowerCase();
    const songList = document.getElementById('song-list');
    
    if (!songList) return;

    const cards = songList.querySelectorAll('.song-card');
    cards.forEach(card => {
        const title = card.querySelector('.song-card-title').textContent.toLowerCase();
        const composer = card.querySelector('.song-card-composer').textContent.toLowerCase();

        if (title.includes(filterText) || composer.includes(filterText)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function showSongDetails(song) {
    document.querySelectorAll('.song-card').forEach(card => card.classList.remove('selected'));
    // 安全な要素取得のため、nullチェックを強化
    const selected_card = document.querySelector(`.song-card[data-videoid="${song.videoId}"]`);
    if (selected_card) {
        selected_card.classList.add('selected');
    }
    
    const detailsDiv = document.getElementById('encyclopedia-details');
    detailsDiv.innerHTML = `
        <h3>${song.title}</h3>
        <div id="encyclopedia-details-content">
            <img src="${song.imageUrl || 'default_bg.png'}" alt="${song.title}" style="width: 90%; max-width: 300px; border-radius: 8px; box-shadow: var(--shadow);">
            <h4>${song.composer || 'Unknown'}</h4>
            <div id="encyclopedia-context">
                ${song.context ? song.context.replace(/\n/g, '<br>') : '情報なし'}
            </div>
            <div style="margin-top: 1em;">
                <a href="https://www.youtube.com/watch?v=${song.videoId}" target="_blank" class="yt-button">YouTubeで再生</a>
            </div>
        </div>
        ${renderSongStats(song)}
    `;
}

function renderSongStats(song) {
    const stats = gameData.stats.songStats[song.videoId];
    if (!stats) {
        return `<div style="margin-top: 1.5em; color: var(--grey-mid);">この曲のクイズデータはありません。</div>`;
    }
    
    const percentage = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(0) : 0;
    const fastestTime = stats.fastestTime !== null ? `${(stats.fastestTime / 1000).toFixed(2)}秒` : 'なし';

    return `
        <div style="margin-top: 1.5em; text-align: left; width: 100%; border-top: 1px solid var(--border-color); padding-top: 1em;">
            <h4>クイズ成績</h4>
            <p><strong>正解率:</strong> ${stats.correct} / ${stats.total} (${percentage}%)</p>
            <p><strong>最速正解時間:</strong> ${fastestTime}</p>
        </div>
    `;
}

function showStatsScreen() {
    showScreen('stats-screen');
    domElements.statsScreen.innerHTML = `
        <h2>成績・設定</h2>
        <div class="stats-grid">
            <div style="border: 1px solid var(--border-color); padding: 1.5em; border-radius: 8px; background-color: var(--grey-light);">
                <h3>ハイスコア</h3>
                <p><strong>ノーマル:</strong> ${gameData.stats.highScores.normal || 0} 問</p>
                <p><strong>タイムアタック:</strong> ${gameData.stats.highScores.timed || 0} 問</p>
                <p><strong>エンドレス:</strong> ${gameData.stats.highScores.endless || 0} 連勝</p>
            </div>
            <div style="border: 1px solid var(--border-color); padding: 1.5em; border-radius: 8px; background-color: var(--grey-light);">
                <h3>現在の設定</h3>
                <p><strong>ノーマル問題数:</strong> ${gameData.settings.normalQuestions} 問</p>
                <p><strong>タイム時間:</strong> ${gameData.settings.timedDuration / 1000} 秒</p>
                <p><strong>作曲家フィルター:</strong> ${gameData.settings.composerFilter}</p>
            </div>
        </div>
        <div style="margin-top: 2em; display: flex; justify-content: center; gap: 1em;">
            <button onclick="initGame()" style="background-color: var(--blue-primary); color: white; width: 150px;">ホームに戻る</button>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    // 修正: 存在が必須の要素のみをリストアップし、安全に取得
    const ids = [
        'loading-overlay', 'main-menu', 'choices', 'result', 'answer-details', 
        'score', 'time-display', 'progress-container', 'progress-text', 
        'progress-bar-fill', 'game-controls-container', 'volumeSlider', 
        'settings-screen', 'start-prompt', 'start-prompt-btn', 'encyclopedia', 
        'game-view', 'replayBtn', 'pauseBtn' // コントロールボタンも取得リストに追加
    ];
    
    ids.forEach(id => {
        const key = id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
        domElements[key] = document.getElementById(id);
    });
    domElements.progressBarWrapper = document.querySelector('.progress-bar-wrapper');

    // 取得した要素が存在する場合のみイベントリスナーを設定
    if (domElements.loadingOverlay) {
        domElements.loadingOverlay.style.display = 'flex';
    }

    loadGameData();

    if (domElements.replayBtn) {
        domElements.replayBtn.onclick = () => {
            if (player && player.seekTo && !gameState.answerChecked) {
                player.seekTo(0);
                player.playVideo();
            }
        };
    }

    if (domElements.pauseBtn) {
        domElements.pauseBtn.onclick = () => {
            if (!player || typeof player.getPlayerState !== 'function') return;
            const state = player.getPlayerState();
            (state === YT.PlayerState.PLAYING) ? player.pauseVideo() : player.playVideo();
        };
    }
    
    if (domElements.volumeSlider) {
        domElements.volumeSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            if (player && player.setVolume) player.setVolume(volume);
            if (introPlayer && introPlayer.setVolume) introPlayer.setVolume(volume);
        });
    }
});

function onYouTubeIframeAPIReady() {
    initGame();
    if (domElements.loadingOverlay) {
        domElements.loadingOverlay.style.display = 'none';
    }
}
