
let player;
let correctAnswer = '';
let currentVideoId = '';
let score = 0;
let totalQuestions = 0;
const maxQuestions = 10;
let answeredVideos = [];
let timer = null;
let mode = 'normal'; // 'normal' or 'timed'

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '0',
    width: '0',
    videoId: '',
    events: { 'onReady': showModeSelection }
  });
}

function showModeSelection() {
  document.getElementById('control-buttons').style.display = 'none';
  const container = document.getElementById('choices');
  container.innerHTML = '';
  document.getElementById('result').innerText = '';
  document.getElementById('score').innerText = '';
  const modes = [
    { label: 'ノーマルモード', value: 'normal' },
    { label: 'タイムアタックモード(準備中)', value: 'timed' }
  ];
  modes.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = () => {
      mode = value;
      score = 0;
      totalQuestions = 0;
      answeredVideos = [];
      loadNextQuiz();
    };
    container.appendChild(btn);
  });
}

function loadNextQuiz() {
  if (totalQuestions >= maxQuestions) {
    player.stopVideo();
    document.getElementById('result').innerText = `🎉 終了！スコア: ${score}/${maxQuestions}`;
    const againBtn = document.createElement('button');
    againBtn.textContent = '🔄 もう一度あそぶ';
    againBtn.onclick = showModeSelection;
    const container = document.getElementById('choices');
    container.innerHTML = '';
    container.appendChild(againBtn);

    const homeBtn = document.createElement('button');
    homeBtn.textContent = '🏠 ホームに戻る';
    homeBtn.onclick = () => location.reload();
    container.appendChild(homeBtn);
    document.getElementById('control-buttons').style.display = 'none';
    return;
  }

  document.getElementById('result').innerText = '';
  document.getElementById('choices').innerHTML = '';
  document.getElementById('control-buttons').style.display = 'flex';

  let available = playlist.filter(p => !answeredVideos.includes(p.videoId));
  if (available.length === 0) available = playlist; // fallback

  const random = available[Math.floor(Math.random() * available.length)];
  correctAnswer = random.title;
  currentVideoId = random.videoId;
  answeredVideos.push(currentVideoId);

  const choices = generateChoices(correctAnswer);
  displayChoices(choices);
  playIntroClip();
  updateScore();

  if (mode === 'timed') {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      checkAnswer("timeout");
    }, 10000); // 10秒
  }
}

function playIntroClip() {
  
  if (mode === 'timed') {
    let remaining = 10.00;
    document.getElementById('time-display').innerText = `残り時間: ${remaining.toFixed(2)} 秒`;
    timer = setInterval(() => {
      remaining -= 0.01;
      if (remaining <= 0) {
        clearInterval(timer);
        document.getElementById('time-display').innerText = '';
        handleAnswer('');
      } else {
        document.getElementById('time-display').innerText = `残り時間: ${remaining.toFixed(2)} 秒`;
      }
    }, 10);
  }
  player.loadVideoById({ videoId: currentVideoId, startSeconds: 0 });
}

document.getElementById('replayBtn').onclick = playIntroClip;
document.getElementById('pauseBtn').onclick = () => {
  const state = player.getPlayerState();
  if (state === 1) player.pauseVideo();
  else player.playVideo();
};

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

function checkAnswer(choice) {
  if (timer) clearTimeout(timer);
  totalQuestions++;
  if (choice === correctAnswer) {
    score++;
    document.getElementById('result').innerText = '✅ 正解！';
  } else if (choice === "timeout") {
    document.getElementById('result').innerText = `⏱️ 時間切れ。不正解！正解は: ${correctAnswer}`;
  } else {
    document.getElementById('result').innerText = `❌ 不正解。正解は: ${correctAnswer}`;
  }
  document.querySelectorAll('#choices button').forEach(btn => btn.disabled = true);
  setTimeout(loadNextQuiz, 2000);
}

function updateScore() {
  document.getElementById('score').innerText = `スコア: ${score} / ${totalQuestions}`;
}

document.getElementById('volumeSlider').addEventListener('input', (e) => {
  const vol = parseInt(e.target.value, 10);
  if (player && player.setVolume) player.setVolume(vol);
});
