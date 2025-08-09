// main.js - v2 with bug fixes and new features
let player;
let correctAnswer = '';
let currentVideoId = '';
let score = 0;
let totalQuestions = 0;
const maxQuestions = 10;
let answeredVideos = [];
let mode = 'normal'; // 'normal', 'timed', or 'encyclopedia'

// Timed mode timer
let gameTimer = null;
let timeLeftMs = 0;

// --- YouTube IFrame API ---
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '0',
    width: '0',
    videoId: '',
    events: {
      'onReady': () => {
        player.setVolume(20);
        document.getElementById('volumeSlider').value = 20;
        showModeSelection();
      }
    }
  });
}

// --- UI Helpers ---
function setSkipEnabled(enabled) {
  const skipBtn = Array.from(document.querySelectorAll('#control-buttons button')).find(b => b.textContent.trim().toLowerCase().includes('スキップ'));
  if (skipBtn) skipBtn.disabled = !enabled;
}

function updateTimeDisplay(ms) {
  if (ms == null) {
    document.getElementById('time-display').innerText = '';
    return;
  }
  const seconds = ms / 1000;
  document.getElementById('time-display').innerText = `残り時間: ${seconds.toFixed(2)} 秒`;
}

function updateScore() {
  document.getElementById('score').innerText = `スコア: ${score} / ${totalQuestions}`;
}

// --- Game State & Mode Selection ---
function showModeSelection() {
  document.getElementById('control-buttons').style.display = 'none';
  document.getElementById('encyclopedia').style.display = 'none';
  const container = document.getElementById('choices');
  container.innerHTML = '';
  document.getElementById('result').innerText = '';
  document.getElementById('score').innerText = '';
  document.getElementById('time-display').innerText = '';
  if (player && player.stopVideo) player.stopVideo();

  const modes = [
    { label: 'ノーマルモード', value: 'normal' },
    { label: 'タイムアタックモード', value: 'timed' },
    { label: 'ブルアカBGM図鑑(PCのみ)', value: 'encyclopedia' }
  ];

  modes.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    if (value === 'normal') {
      btn.onclick = startNormalMode;
    } else if (value === 'timed') {
      btn.onclick = startTimedMode;
    } else if (value === 'encyclopedia') {
      btn.className = 'encyclopedia-btn';
      btn.onclick = showEncyclopedia;
    }
    container.appendChild(btn);
  });
}

function initGame() {
  mode = 'normal';
  setSkipEnabled(true);
  showModeSelection();
}

function startNormalMode() {
  mode = 'normal';
  score = 0;
  totalQuestions = 0;
  answeredVideos = [];
  setSkipEnabled(true);
  loadNextQuiz();
}

function startTimedMode() {
  mode = 'timed';
  score = 0;
  totalQuestions = 0;
  answeredVideos = [];
  timeLeftMs = 60000;
  
  updateTimeDisplay(timeLeftMs);
  document.getElementById('result').innerText = '';
  updateScore();
  setSkipEnabled(false);

  if (gameTimer) clearInterval(gameTimer);

  gameTimer = setInterval(() => {
    timeLeftMs -= 10;
    if (timeLeftMs <= 0) {
      timeLeftMs = 0;
      updateTimeDisplay(timeLeftMs);
      endGame();
    } else {
      updateTimeDisplay(timeLeftMs);
    }
  }, 10);

  loadNextQuiz();
}

// --- Quiz Flow ---
function loadNextQuiz() {
  if (mode === 'timed' && timeLeftMs <= 0) {
    if (gameTimer) endGame();
    return;
  }

  document.getElementById('result').innerText = '';
  document.getElementById('choices').innerHTML = '';
  document.getElementById('control-buttons').style.display = 'flex';

  let available = playlist.filter(p => !answeredVideos.includes(p.videoId));
  if (available.length === 0) available = playlist.slice();

  const random = available[Math.floor(Math.random() * available.length)];
  correctAnswer = random.title;
  currentVideoId = random.videoId;
  answeredVideos.push(currentVideoId);

  displayChoices(generateChoices(correctAnswer));
  playIntroClip();
  updateScore();
}

function generateChoices(correct) {
  const others = playlist.map(p => p.title).filter(t => t !== correct);
  const sample = others.sort(() => 0.5 - Math.random()).slice(0, 3);
  sample.push(correct);
  return sample.sort(() => 0.5 - Math.random());
}

function displayChoices(choices) {
  const container = document.getElementById('choices');
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.textContent = choice;
    btn.onclick = () => checkAnswer(choice);
    container.appendChild(btn);
  });
}

function playIntroClip() {
  if (!player || !player.loadVideoById) return;
  player.loadVideoById({ videoId: currentVideoId, startSeconds: 0 });
}

// --- Answer Checking ---
function checkAnswer(choice) {
  if (!choice) return;

  document.querySelectorAll('#choices button').forEach(b => b.disabled = true);

  if (mode === 'timed') {
    totalQuestions++;
    if (choice === correctAnswer) {
      score++;
      document.getElementById('result').innerText = '✅ 正解！';
      updateScore();
      setTimeout(() => {
        if (timeLeftMs > 0) loadNextQuiz();
        else if (gameTimer) endGame();
      }, 400);
    } else {
      document.getElementById('result').innerText = `❌ 不正解。正解は: ${correctAnswer}`;
      updateScore();
      setTimeout(endGame, 1200);
    }
    return;
  }

  if (mode === 'normal') {
    totalQuestions++;
    if (choice === correctAnswer) {
      score++;
      document.getElementById('result').innerText = '✅ 正解！';
    } else {
      document.getElementById('result').innerText = `❌ 不正解。正解は: ${correctAnswer}`;
    }
    updateScore();

    if (totalQuestions >= maxQuestions) {
      endGame();
    } else {
      setTimeout(loadNextQuiz, 1200);
    }
  }
}

// --- End Game Screen ---
function endGame() {
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
  if (player && player.stopVideo) player.stopVideo();

  let resultMessage = '';
  if (mode === 'timed') {
    updateTimeDisplay(0);
    resultMessage = `\n🎉 タイムアタック終了！スコア: ${score}問`;
  } else { // Normal mode max questions reached
    resultMessage = `\n🎉 終了！スコア: ${score}/${totalQuestions}`;
  }
  document.getElementById('result').innerText += resultMessage;

  const container = document.getElementById('choices');
  container.innerHTML = '';
  
  const againBtn = document.createElement('button');
  againBtn.textContent = 'もう一度あそぶ';
  againBtn.onclick = (mode === 'timed') ? startTimedMode : startNormalMode;
  container.appendChild(againBtn);

  const homeBtn = document.createElement('button');
  homeBtn.textContent = 'ホームに戻る';
  homeBtn.onclick = initGame;
  container.appendChild(homeBtn);

  document.getElementById('control-buttons').style.display = 'none';
}


// --- BGM Encyclopedia ---
function showEncyclopedia() {
  mode = 'encyclopedia';
  document.getElementById('choices').innerHTML = '';
  document.getElementById('control-buttons').style.display = 'none';
  document.getElementById('result').innerText = '';
  document.getElementById('score').innerText = '';
  document.getElementById('time-display').innerText = '';
  
  const encyclopediaContainer = document.getElementById('encyclopedia');
  encyclopediaContainer.style.display = 'block';
  encyclopediaContainer.innerHTML = '';

  const header = document.createElement('div');
  header.innerHTML = `<h2>ブルアカBGM図鑑 (全${playlist.length}曲)</h2>`;
  encyclopediaContainer.appendChild(header);

  const nowPlayingContainer = document.createElement('div');
  nowPlayingContainer.id = 'now-playing-container';
  nowPlayingContainer.innerHTML = '曲名をクリックすると再生されます。';
  encyclopediaContainer.appendChild(nowPlayingContainer);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'encyclopedia-search';
  searchInput.placeholder = '曲名を検索...';
  searchInput.onkeyup = filterSongs;
  encyclopediaContainer.appendChild(searchInput);

  const songListContainer = document.createElement('div');
  songListContainer.id = 'song-list';
  encyclopediaContainer.appendChild(songListContainer);

  playlist.forEach(song => {
    const songButton = document.createElement('button');
    songButton.className = 'song-item';
    songButton.textContent = song.title;
    songButton.onclick = () => {
      if (player && player.loadVideoById) {
        player.loadVideoById(song.videoId);
        nowPlayingContainer.innerHTML = `<strong>再生中:</strong> ${song.title}`;
        document.querySelectorAll('.song-item.playing').forEach(b => b.classList.remove('playing'));
        songButton.classList.add('playing');
      }
    };
    songListContainer.appendChild(songButton);
  });
  
  const homeBtn = document.createElement('button');
  homeBtn.textContent = 'ホームに戻る';
  homeBtn.style.marginTop = '1em';
  homeBtn.onclick = initGame;
  encyclopediaContainer.appendChild(homeBtn);
}

function filterSongs() {
  const filterText = document.getElementById('encyclopedia-search').value.toLowerCase();
  const songs = document.getElementById('song-list').getElementsByClassName('song-item');

  for (let song of songs) {
    const title = song.textContent.toLowerCase();
    song.style.display = title.includes(filterText) ? '' : 'none';
  }
}

// --- Initial Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  const replayBtn = document.getElementById('replayBtn');
  replayBtn.onclick = () => {
    if (player && player.seekTo) {
      player.seekTo(0);
      player.playVideo();
    }
  };

  const pauseBtn = document.getElementById('pauseBtn');
  pauseBtn.onclick = () => {
    if (!player || typeof player.getPlayerState !== 'function') return;
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  const vol = document.getElementById('volumeSlider');
  vol.addEventListener('input', (e) => {
    if (player && player.setVolume) player.setVolume(parseInt(e.target.value, 10));
  });
});

window.addEventListener('load', () => {
  if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
    // API not ready, onYouTubeIframeAPIReady will handle init
  } else {
    initGame();
  }
});