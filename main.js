let player;
let playlist = [];
let correctAnswer = '';
let currentVideoId = '';
let score = 0;
let totalQuestions = 0;

const apiKey = "AIzaSyDsM8fGgLrSHOSeZhZVeOKHrU40se29uHc";
const playlistIds = [
    "PLh6Ws4FpphfoQhmpxR__Drt6t2LSS_p6Z",
    "PLh6Ws4FpphfqY9lXLh8eRPYeTGbhULqhY",
    "PLh6Ws4FpphfoYgeVLR5-SGafUtHADKrQT",
    "PLh6Ws4FpphfqKKC8M9R_UJdxJDT8JmVaZ",
    "PLh6Ws4FpphfqQnu244UDkHAHPDFcGrUts",
    "PLh6Ws4FpphfoPBKsiA2S0Xb8CFIKK5a39",
    "PLh6Ws4FpphfqRun0F3XCUU95AJcThtgTU"
];

async function fetchPlaylist() {
    for (const id of playlistIds) {
        let nextPageToken = '';
        do {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${id}&pageToken=${nextPageToken}&key=${apiKey}`);
            const data = await res.json();
            playlist.push(...data.items.map(item => ({
                title: item.snippet.title,
                videoId: item.snippet.resourceId.videoId
            })));
            nextPageToken = data.nextPageToken || '';
        } while (nextPageToken);
    }
}

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '0',
        width: '0',
        videoId: '',
        events: {
            'onReady': loadNextQuiz
        }
    });
}

function loadNextQuiz() {
    document.getElementById('result').innerText = '';
    document.getElementById('choices').innerHTML = '';

    const replayBtn = document.getElementById('replayBtn');
    if (replayBtn) replayBtn.remove();

    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.remove();

    const randomIndex = Math.floor(Math.random() * playlist.length);
    const randomVideo = playlist[randomIndex];
    correctAnswer = randomVideo.title;
    currentVideoId = randomVideo.videoId;

    const choices = generateChoices(correctAnswer);
    displayChoices(choices);
    playIntroClip();

    updateScoreDisplay();
}

function playIntroClip() {
    player.loadVideoById({
        videoId: currentVideoId,
        startSeconds: 0,
        endSeconds: 30
    });

    if (!document.getElementById('replayBtn')) {
        const replayBtn = document.createElement('button');
        replayBtn.textContent = '🔁 もう一度聴く';
        replayBtn.id = 'replayBtn';
        replayBtn.onclick = playIntroClip;
        document.getElementById('control-buttons').appendChild(replayBtn);
    }

    if (!document.getElementById('pauseBtn')) {
        const pauseBtn = document.createElement('button');
        pauseBtn.textContent = '⏸ 一時停止';
        pauseBtn.id = 'pauseBtn';
        pauseBtn.onclick = togglePause;
        document.getElementById('control-buttons').appendChild(pauseBtn);
    }
}

function togglePause() {
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else if (state === YT.PlayerState.PAUSED) {
        player.playVideo();
    }
}

function generateChoices(correct) {
    const titles = playlist.map(v => v.title).filter(t => t !== correct);
    const shuffled = titles.sort(() => 0.5 - Math.random()).slice(0, 3);
    shuffled.push(correct);
    return shuffled.sort(() => 0.5 - Math.random());
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
    const result = document.getElementById('result');
    totalQuestions++;

    if (choice === correctAnswer) {
        score++;
        result.innerText = '✅ 正解！';
    } else {
        result.innerText = `❌ 不正解。正解は: ${correctAnswer}`;
    }

    document.querySelectorAll('#choices button').forEach(btn => btn.disabled = true);
    setTimeout(loadNextQuiz, 2000);
}

function updateScoreDisplay() {
    const scoreElement = document.getElementById('score');
    scoreElement.textContent = `スコア: ${score} / ${totalQuestions}`;
}

window.onload = async () => {
    await fetchPlaylist();
    updateScoreDisplay();
};
