const CLIENT_ID = '950153446946-l5k4ru739lap28ff74jdgmbmkpd5mtu9.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

let accessToken = null;
let files = [];
let currentIndex = -1;
let folderStack = [{ id: 'root', name: '내 드라이브' }];

function signIn() {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (res) => {
      if (res.error) { alert('로그인 실패: ' + res.error); return; }
      accessToken = res.access_token;
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      loadFolder('root');
    }
  });
  client.requestAccessToken();
}

async function loadFolder(folderId) {
  document.getElementById('file-list').innerHTML = '<div style="color:#aaa;padding:1rem;font-size:13px">불러오는 중...</div>';

  const q = `'${folderId}' in parents and trashed=false and (mimeType contains 'audio' or mimeType='application/vnd.google-apps.folder')`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&orderBy=folder,name&pageSize=500`;

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    files = data.files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    renderList(data.files || []);
  } catch (e) {
    document.getElementById('file-list').innerHTML = '<div style="color:#f55;padding:1rem">불러오기 실패: ' + e.message + '</div>';
  }
}

function renderList(items) {
  const list = document.getElementById('file-list');
  list.innerHTML = '';
  if (items.length === 0) {
    list.innerHTML = '<div style="color:#aaa;padding:1rem;font-size:13px">파일이 없습니다</div>';
    return;
  }
  items.forEach((f) => {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    const mp3Index = files.findIndex(x => x.id === f.id);
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `<span class="file-icon">${isFolder ? '📁' : '🎵'}</span><span class="file-name">${f.name}</span>`;
    div.onclick = () => isFolder ? openFolder(f) : playFile(f, mp3Index);
    list.appendChild(div);
  });
}

function openFolder(f) {
  folderStack.push({ id: f.id, name: f.name });
  document.getElementById('current-path').textContent = f.name;
  loadFolder(f.id);
}

function goUp() {
  if (folderStack.length <= 1) return;
  folderStack.pop();
  const parent = folderStack[folderStack.length - 1];
  document.getElementById('current-path').textContent = parent.name;
  loadFolder(parent.id);
}

async function playFile(f, idx) {
  currentIndex = idx;
  document.getElementById('track-name').textContent = f.name;
  document.getElementById('play-btn').textContent = '⏳';

  document.querySelectorAll('.file-item').forEach(el => el.classList.remove('playing'));
  const items = document.querySelectorAll('.file-item');
  const allFiles = Array.from(items);

  try {
    const url = `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const blob = await res.blob();
    const audio = document.getElementById('audio');
    audio.src = URL.createObjectURL(blob);
    await audio.play();
    document.getElementById('play-btn').textContent = '⏸';

    // 재생 중 표시
    document.querySelectorAll('.file-item').forEach((el, i) => {
      const icon = el.querySelector('.file-icon');
      if (icon && icon.textContent === '🎵') {
        const name = el.querySelector('.file-name').textContent;
        if (name === f.name) el.classList.add('playing');
      }
    });
  } catch (e) {
    alert('재생 실패: ' + e.message);
    document.getElementById('play-btn').textContent = '▶';
  }
}

function togglePlay() {
  const audio = document.getElementById('audio');
  if (audio.paused) {
    audio.play();
    document.getElementById('play-btn').textContent = '⏸';
  } else {
    audio.pause();
    document.getElementById('play-btn').textContent = '▶';
  }
}

function prevTrack() {
  if (currentIndex > 0) playFile(files[currentIndex - 1], currentIndex - 1);
}

function nextTrack() {
  if (currentIndex < files.length - 1) playFile(files[currentIndex + 1], currentIndex + 1);
}

function seek(v) {
  const audio = document.getElementById('audio');
  if (audio.duration) audio.currentTime = audio.duration * v / 100;
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

const audio = document.getElementById('audio');
audio.ontimeupdate = () => {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  document.getElementById('progress').value = pct.toFixed(1);
  document.getElementById('time').textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration);
};
audio.onended = nextTrack;

const gsi = document.createElement('script');
gsi.src = 'https://accounts.google.com/gsi/client';
gsi.async = true;
document.head.appendChild(gsi);
