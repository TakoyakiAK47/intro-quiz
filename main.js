// main.js - clean implementation with proper Timed Mode (60.00s), millisecond display, skip disabled during timed mode
let player;
let correctAnswer = '';
let currentVideoId = '';
let score = 0;
let totalQuestions = 0;
const maxQuestions = 9999; // not used in timed mode, but keep safe guard
let answeredVideos = [];
let mode = 'normal'; // 'normal' or 'timed'

// Timed mode timers (milliseconds)
let gameTimer = null;
let timeLeftMs = 0; // remaining milliseconds in timed mode (e.g. 60000)

// YouTube IFrame API ready
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '0',
    width: '0',
    videoId: '',
    events: {
      'onReady': (event) => {
        player.setVolume(20);
        document.getElementById('volumeSlider').value = 20;
        // Ensure mode selection is visible when API is ready
        showModeSelection();
      }
    }
  });
}

// --- UI helpers ---
function setSkipEnabled(enabled) {
  // Find the Skip button (onclick="loadNextQuiz()")
  const skipBtn = Array.from(document.querySelectorAll('#control-buttons button')).find(b => b.getAttribute('onclick') === 'loadNextQuiz()' || b.textContent.trim().toLowerCase().includes('スキップ'));
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

// --- Mode selection & initialization ---
function showModeSelection() {
  document.getElementById('control-buttons').style.display = 'none';
  const container = document.getElementById('choices');
  container.innerHTML = '';
  document.getElementById('result').innerText = '';
  document.getElementById('score').innerText = '';
  document.getElementById('time-display').innerText = '';

  const modes = [
    { label: 'ノーマルモード', value: 'normal' },
    { label: 'タイムアタックモード', value: 'timed' }
  ];
  modes.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = () => {
      mode = value;
      if (mode === 'timed') {
        startTimedMode();
      } else {
        // normal mode init
        score = 0;
        totalQuestions = 0;
        answeredVideos = [];
        setSkipEnabled(true);
        loadNextQuiz();
      }
    };
    container.appendChild(btn);
  });
}

function initGame() {
  mode = 'normal';
  score = 0;
  totalQuestions = 0;
  answeredVideos = [];
  document.getElementById('score').innerText = 'スコア: 0 / 0';
  document.getElementById('result').innerText = '';
  document.getElementById('time-display').innerText = '';
  document.getElementById('choices').innerHTML = '';
  document.getElementById('control-buttons').style.display = 'none';
  setSkipEnabled(true);
  showModeSelection();
}

// --- Quiz flow ---
function loadNextQuiz() {
  // If in timed mode and no time left, end game
  if (mode === 'timed' && timeLeftMs <= 0) {
    endGame();
    return;
  }

  document.getElementById('result').innerText = '';
  document.getElementById('choices').innerHTML = '';
  document.getElementById('control-buttons').style.display = 'flex';

  // choose random unused video
  let available = playlist.filter(p => !answeredVideos.includes(p.videoId));
  if (available.length === 0) available = playlist.slice(); // reset if exhausted

  const random = available[Math.floor(Math.random() * available.length)];
  correctAnswer = random.title;
  currentVideoId = random.videoId;
  answeredVideos.push(currentVideoId);

  const choices = generateChoices(correctAnswer);
  displayChoices(choices);
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

// Play the intro clip from start (short preview)
function playIntroClip() {
  if (!player || !player.loadVideoById) return;
  // play from 0 seconds; you can tweak startSeconds and endSeconds if desired
  player.loadVideoById({ videoId: currentVideoId, startSeconds: 0 });
}

// Replay and pause button handlers
document.addEventListener('DOMContentLoaded', () => {
  const replayBtn = document.getElementById('replayBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  replayBtn.onclick = () => {
    if (player && player.seekTo) {
      player.seekTo(0);
      player.playVideo();
    }
  };
  pauseBtn.onclick = () => {
    if (!player || !player.getPlayerState) return;
    const state = player.getPlayerState();
    if (state === 1) player.pauseVideo();
    else player.playVideo();
  };

  // volume slider
  const vol = document.getElementById('volumeSlider');
  vol.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    if (player && player.setVolume) player.setVolume(v);
  });
});

// --- Answer checking ---
function checkAnswer(choice) {
  // If no choice (shouldn't happen) ignore
  if (!choice) return;

  // timed mode behavior: correct -> next question, incorrect -> immediate end
  if (mode === 'timed') {
    totalQuestions++;
    if (choice === correctAnswer) {
      score++;
      document.getElementById('result').innerText = '✅ 正解！';
      updateScore();
      // quick delay then next question (keep remaining time)
      setTimeout(() => {
        // prevent going to next if time finished in the meantime
        if (timeLeftMs > 0) loadNextQuiz();
        else endGame();
      }, 400);
    } else {
      document.getElementById('result').innerText = `❌ 不正解。正解は: ${correctAnswer}`;
      updateScore();
      endGame();
    }
    // disable choice buttons after answer to avoid double clicks
    document.querySelectorAll('#choices button').forEach(b => b.disabled = true);
    return;
  }

  // normal mode (existing behavior: counts up to maxQuestions)
  if (mode === 'normal') {
    // clear any timed state (safety)
    totalQuestions++;
    if (choice === correctAnswer) {
      score++;
      document.getElementById('result').innerText = '✅ 正解！';
    } else {
      document.getElementById('result').innerText = `❌ 不正解。正解は: ${correctAnswer}`;
    }
    document.querySelectorAll('#choices button').forEach(btn => btn.disabled = true);
    updateScore();

    if (totalQuestions >= maxQuestions) {
      // show end screen for normal mode
      player.stopVideo();
      document.getElementById('result').innerText += `\n🎉 終了！スコア: ${score}/${maxQuestions}`;
      const container = document.getElementById('choices');
      container.innerHTML = '';
      const againBtn = document.createElement('button');
      againBtn.textContent = 'もう一度あそぶ';
      againBtn.onclick = () => {
        score = 0; totalQuestions = 0; answeredVideos = []; loadNextQuiz();
      };
      container.appendChild(againBtn);
      const homeBtn = document.createElement('button');
      homeBtn.textContent = 'ホームに戻る';
      homeBtn.onclick = initGame;
      container.appendChild(homeBtn);
      document.getElementById('control-buttons').style.display = 'none';
      return;
    }

    setTimeout(loadNextQuiz, 1200);
  }
}

// --- Timed mode implementation ---
function startTimedMode() {
  // reset state
  score = 0;
  totalQuestions = 0;
  answeredVideos = [];
  // 60 seconds = 60000 ms
  timeLeftMs = 60000;
  updateTimeDisplay(timeLeftMs);
  document.getElementById('result').innerText = '';
  document.getElementById('score').innerText = 'スコア: 0 / 0';

  // disable skip button during timed mode
  setSkipEnabled(false);

  // clear existing timer if any
  if (gameTimer) clearInterval(gameTimer);

  // 10ms tick for smooth display (reasonable balance)
  gameTimer = setInterval(() => {
    timeLeftMs -= 10;
    if (timeLeftMs < 0) timeLeftMs = 0;
    updateTimeDisplay(timeLeftMs);
    if (timeLeftMs <= 0) {
      endGame();
    }
  }, 10);

  mode = 'timed';
  loadNextQuiz();
}

function endGame() {
  // stop timer
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
  // stop video playback
  if (player && player.stopVideo) player.stopVideo();

  // ensure display shows 0.00 if timed out
  updateTimeDisplay(0);

  // show result summary
  document.getElementById('result').innerText += `\n🎉 タイムアタック終了！スコア: ${score}問`;

  // show buttons for replay/home
  const container = document.getElementById('choices');
  container.innerHTML = '';
  const againBtn = document.createElement('button');
  againBtn.textContent = 'もう一度あそぶ';
  againBtn.onclick = () => startTimedMode();
  container.appendChild(againBtn);
  const homeBtn = document.createElement('button');
  homeBtn.textContent = 'ホームに戻る';
  homeBtn.onclick = () => {
    // re-enable skip when going home
    setSkipEnabled(true);
    initGame();
  };
  container.appendChild(homeBtn);
  document.getElementById('control-buttons').style.display = 'none';

  // re-enable skip when leaving timed mode
  setSkipEnabled(true);
  mode = 'normal';
}

// expose initGame on load (ensure mode selection appears even before YouTube API ready)
window.addEventListener('load', () => {
  // attempt to show mode selection right away
  try { showModeSelection(); } catch (e) { /* ignore if DOM not ready */ }
  // Also call initGame to set things up
  try { initGame(); } catch (e) { /* ignore */ }
});
