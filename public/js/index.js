// Landing Page Logic (index.js)
let previewStream = null;
let micEnabled = true;
let camEnabled = true;

const previewVideo = document.getElementById('previewVideo');
const previewAvatar = document.getElementById('previewAvatar');
const togglePreviewMic = document.getElementById('togglePreviewMic');
const togglePreviewCam = document.getElementById('togglePreviewCam');
const usernameInput = document.getElementById('usernameInput');
const roomInput = document.getElementById('roomInput');
const tabCreate = document.getElementById('tabCreate');
const tabJoin = document.getElementById('tabJoin');
const sectionCreate = document.getElementById('sectionCreate');
const sectionJoin = document.getElementById('sectionJoin');
const btnCreateRoom = document.getElementById('btnCreateRoom');
const btnJoinRoom = document.getElementById('btnJoinRoom');
const toastEl = document.getElementById('toast');

// Restore saved username if available
const savedName = localStorage.getItem('freetalk_username');
if (savedName) {
  usernameInput.value = savedName;
}

// Check for room param in URL (?room=xyz)
const urlParams = new URLSearchParams(window.location.search);
const queryRoom = urlParams.get('room');
if (queryRoom) {
  roomInput.value = queryRoom;
  showJoinTab();
}

// Tab Switching
tabCreate.addEventListener('click', () => {
  tabCreate.classList.add('active');
  tabJoin.classList.remove('active');
  sectionCreate.style.display = 'block';
  sectionJoin.style.display = 'none';
});

tabJoin.addEventListener('click', showJoinTab);

function showJoinTab() {
  tabJoin.classList.add('active');
  tabCreate.classList.remove('active');
  sectionJoin.style.display = 'block';
  sectionCreate.style.display = 'none';
}

// Initialize Camera Preview
async function initPreview() {
  try {
    previewStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: true
    });
    previewVideo.srcObject = previewStream;
  } catch (err) {
    console.warn('Camera/Mic permission not granted yet:', err);
    camEnabled = false;
    micEnabled = false;
    updatePreviewUI();
  }
}
initPreview();

// Toggle Preview Mic
togglePreviewMic.addEventListener('click', () => {
  micEnabled = !micEnabled;
  if (previewStream) {
    previewStream.getAudioTracks().forEach(track => (track.enabled = micEnabled));
  }
  togglePreviewMic.classList.toggle('off', !micEnabled);
  showToast(micEnabled ? 'Microphone Chalu Hai' : 'Microphone Band Hai');
});

// Toggle Preview Camera
togglePreviewCam.addEventListener('click', () => {
  camEnabled = !camEnabled;
  if (previewStream) {
    previewStream.getVideoTracks().forEach(track => (track.enabled = camEnabled));
  }
  updatePreviewUI();
  showToast(camEnabled ? 'Camera Chalu Hai' : 'Camera Band Hai');
});

function updatePreviewUI() {
  togglePreviewCam.classList.toggle('off', !camEnabled);
  previewVideo.style.display = camEnabled ? 'block' : 'none';
  previewAvatar.style.display = camEnabled ? 'none' : 'flex';
}

// Helper to generate room ID
function generateRoomId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const part = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `room-${part(3)}-${part(3)}`;
}

// Create Room Handler
btnCreateRoom.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (!username) {
    showToast('Kripya apna naam dalein');
    usernameInput.focus();
    return;
  }
  localStorage.setItem('freetalk_username', username);
  const newRoomId = generateRoomId();
  stopPreviewStream();
  window.location.href = `/room.html?room=${encodeURIComponent(newRoomId)}&name=${encodeURIComponent(username)}&audio=${micEnabled ? 1 : 0}&video=${camEnabled ? 1 : 0}`;
});

// Join Room Handler
btnJoinRoom.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  let enteredRoom = roomInput.value.trim();

  if (!username) {
    showToast('Kripya apna naam dalein');
    usernameInput.focus();
    return;
  }
  if (!enteredRoom) {
    showToast('Kripya Room Code ya Link dalein');
    roomInput.focus();
    return;
  }

  // If user pasted a full URL like http://.../room/xyz or ?room=xyz
  if (enteredRoom.includes('room=')) {
    const parsed = new URL(enteredRoom, window.location.origin);
    enteredRoom = parsed.searchParams.get('room') || enteredRoom;
  } else if (enteredRoom.includes('/room/')) {
    enteredRoom = enteredRoom.split('/room/').pop();
  }

  localStorage.setItem('freetalk_username', username);
  stopPreviewStream();
  window.location.href = `/room.html?room=${encodeURIComponent(enteredRoom)}&name=${encodeURIComponent(username)}&audio=${micEnabled ? 1 : 0}&video=${camEnabled ? 1 : 0}`;
});

function stopPreviewStream() {
  if (previewStream) {
    previewStream.getTracks().forEach(t => t.stop());
  }
}

// Toast notification helper
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW reg error:', err));
  });
}
