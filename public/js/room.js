// Room Client Logic (room.js)
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const username = urlParams.get('name') || 'Guest';
let isMicOn = urlParams.get('audio') !== '0';
let isCamOn = urlParams.get('video') !== '0';

if (!roomId) {
  window.location.href = '/';
}

// DOM Elements
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const btnCopyRoom = document.getElementById('btnCopyRoom');
const btnShareInvite = document.getElementById('btnShareInvite');
const participantCountText = document.getElementById('participantCountText');
const videoGrid = document.getElementById('videoGrid');
const localVideo = document.getElementById('localVideo');
const localPlaceholder = document.getElementById('localPlaceholder');
const localAvatar = document.getElementById('localAvatar');
const localUsernameBadge = document.getElementById('localUsernameBadge');
const localMuteBadge = document.getElementById('localMuteBadge');

const btnToggleMic = document.getElementById('btnToggleMic');
const iconMicOn = document.getElementById('iconMicOn');
const iconMicOff = document.getElementById('iconMicOff');

const btnToggleCam = document.getElementById('btnToggleCam');
const iconCamOn = document.getElementById('iconCamOn');
const iconCamOff = document.getElementById('iconCamOff');

const btnFlipCam = document.getElementById('btnFlipCam');
const btnScreenShare = document.getElementById('btnScreenShare');
const btnToggleChat = document.getElementById('btnToggleChat');
const unreadBadge = document.getElementById('unreadBadge');
const btnLeaveCall = document.getElementById('btnLeaveCall');

const chatDrawer = document.getElementById('chatDrawer');
const btnCloseChat = document.getElementById('btnCloseChat');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const toastEl = document.getElementById('toast');

// State
let localStream = null;
let currentFacingMode = 'user'; // 'user' or 'environment'
let isScreenSharing = false;
let screenStream = null;
let unreadCount = 0;
let isChatOpen = false;

// Peer connections map: socketId -> { pc, remoteStream, username }
const peers = new Map();

// Free Google STUN configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

// UI Initialization
roomCodeDisplay.textContent = roomId;
localUsernameBadge.textContent = `${username} (You)`;
localAvatar.textContent = username.charAt(0).toUpperCase();

// Sound Synthesizer via Web Audio API (Zero external assets)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playChime(type) {
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'join') {
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'leave') {
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'message') {
      osc.frequency.setValueAtTime(700, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    }
  } catch (e) {
    // Audio autoplay restrictions or errors
  }
}

// Initialize Socket.io
const socket = io();

// Start Media & Join Room
async function startCall() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: currentFacingMode },
      audio: { echoCancellation: true, noiseSuppression: true }
    });

    localVideo.srcObject = localStream;

    // Apply initial mic & cam toggles
    setMicState(isMicOn);
    setCamState(isCamOn);

    // Join room on server
    socket.emit('join-room', {
      roomId,
      username,
      audio: isMicOn,
      video: isCamOn
    });
  } catch (err) {
    console.error('Error accessing camera/mic:', err);
    showToast('Camera/Mic permission nahi mili');
    // Still join room even if media failed (audio-only or spectator fallback)
    socket.emit('join-room', {
      roomId,
      username,
      audio: false,
      video: false
    });
  }
}

startCall();

// ============================================
// WEBRTC SIGNALING HANDLERS
// ============================================

// Server sends list of existing participants in the room
socket.on('existing-users', async ({ users, yourId }) => {
  for (const user of users) {
    createPeerConnection(user.socketId, user.username, true);
  }
  updateGridLayout();
});

// Another user joined
socket.on('user-joined', ({ socketId, username: peerName, audio, video }) => {
  appendSystemMessage(`${peerName} room me jud gaye.`);
  playChime('join');
  createPeerConnection(socketId, peerName, false);
  updateGridLayout();
});

// WebRTC Offer received
socket.on('signal-offer', async ({ caller, callerName, sdp }) => {
  let peerObj = peers.get(caller);
  if (!peerObj) {
    peerObj = createPeerConnection(caller, callerName, false);
  }
  const pc = peerObj.pc;
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit('signal-answer', {
    target: caller,
    sdp: pc.localDescription
  });
});

// WebRTC Answer received
socket.on('signal-answer', async ({ responder, sdp }) => {
  const peerObj = peers.get(responder);
  if (peerObj) {
    await peerObj.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }
});

// ICE Candidate received
socket.on('signal-ice', async ({ sender, candidate }) => {
  const peerObj = peers.get(sender);
  if (peerObj && candidate) {
    try {
      await peerObj.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('Error adding ICE candidate:', e);
    }
  }
});

// User left room
socket.on('user-left', ({ socketId, username: peerName }) => {
  appendSystemMessage(`${peerName || 'Ek sadasya'} ne call chhod diya.`);
  playChime('leave');
  removePeer(socketId);
  updateGridLayout();
});

// Room info update (e.g. participant count)
socket.on('room-info', ({ participantCount }) => {
  participantCountText.textContent = `${participantCount} online`;
});

// Remote media toggle (mute/video off)
socket.on('user-media-toggled', ({ socketId, type, enabled }) => {
  const card = document.getElementById(`peer-${socketId}`);
  if (!card) return;

  if (type === 'audio') {
    const muteBadge = card.querySelector('.audio-status-badge');
    if (muteBadge) muteBadge.style.display = enabled ? 'none' : 'flex';
  } else if (type === 'video') {
    const placeholder = card.querySelector('.video-placeholder');
    const videoEl = card.querySelector('video');
    if (placeholder && videoEl) {
      placeholder.style.display = enabled ? 'none' : 'flex';
      videoEl.style.display = enabled ? 'block' : 'none';
    }
  }
});

// ============================================
// CREATE PEER CONNECTION (MESH)
// ============================================
function createPeerConnection(targetSocketId, targetUsername, isInitiator) {
  if (peers.has(targetSocketId)) {
    return peers.get(targetSocketId);
  }

  const pc = new RTCPeerConnection(rtcConfig);
  const remoteStream = new MediaStream();

  // Create UI card for remote user
  createRemoteVideoCard(targetSocketId, targetUsername);

  // Add local tracks to peer connection
  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }

  // Handle incoming remote tracks
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
    const remoteVideo = document.getElementById(`video-${targetSocketId}`);
    if (remoteVideo && remoteVideo.srcObject !== remoteStream) {
      remoteVideo.srcObject = remoteStream;
    }
  };

  // ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal-ice', {
        target: targetSocketId,
        candidate: event.candidate
      });
    }
  };

  // Connection state logging & cleanup
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      removePeer(targetSocketId);
    }
  };

  const peerData = { pc, remoteStream, username: targetUsername };
  peers.set(targetSocketId, peerData);

  // If initiator, create and send Offer
  if (isInitiator) {
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal-offer', {
          target: targetSocketId,
          callerName: username,
          sdp: pc.localDescription
        });
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    };
  }

  return peerData;
}

function removePeer(socketId) {
  if (peers.has(socketId)) {
    const { pc } = peers.get(socketId);
    pc.close();
    peers.delete(socketId);
  }
  const card = document.getElementById(`peer-${socketId}`);
  if (card) card.remove();
  updateGridLayout();
}

// ============================================
// DYNAMIC VIDEO GRID UI
// ============================================
function createRemoteVideoCard(socketId, peerName) {
  if (document.getElementById(`peer-${socketId}`)) return;

  const card = document.createElement('div');
  card.id = `peer-${socketId}`;
  card.className = 'video-card';

  const initial = (peerName || 'U').charAt(0).toUpperCase();

  card.innerHTML = `
    <video id="video-${socketId}" autoplay playsinline></video>
    <div class="video-placeholder" style="display: none;">
      <div class="avatar-circle">${initial}</div>
    </div>
    <div class="video-user-badge">
      <span>${peerName || 'User'}</span>
    </div>
    <div class="audio-status-badge" style="display: none;" title="Mic muted">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
    </div>
  `;

  videoGrid.appendChild(card);
}

function updateGridLayout() {
  const totalCards = 1 + peers.size; // local + remotes
  videoGrid.className = 'video-grid';
  if (totalCards === 1) {
    videoGrid.classList.add('grid-1');
  } else if (totalCards === 2) {
    videoGrid.classList.add('grid-2');
  } else if (totalCards <= 4) {
    videoGrid.classList.add('grid-4');
  } else {
    videoGrid.classList.add('grid-6');
  }
}

// ============================================
// MEDIA CONTROLS (MIC, CAM, FLIP, SCREEN)
// ============================================

// Mic Toggle
btnToggleMic.addEventListener('click', () => {
  setMicState(!isMicOn);
  socket.emit('media-toggle', { roomId, type: 'audio', enabled: isMicOn });
  showToast(isMicOn ? 'Microphone On' : 'Microphone Muted');
});

function setMicState(enabled) {
  isMicOn = enabled;
  if (localStream) {
    localStream.getAudioTracks().forEach(t => (t.enabled = enabled));
  }
  iconMicOn.style.display = enabled ? 'block' : 'none';
  iconMicOff.style.display = enabled ? 'none' : 'block';
  btnToggleMic.classList.toggle('active-off', !enabled);
  localMuteBadge.style.display = enabled ? 'none' : 'flex';
}

// Cam Toggle
btnToggleCam.addEventListener('click', () => {
  setCamState(!isCamOn);
  socket.emit('media-toggle', { roomId, type: 'video', enabled: isCamOn });
  showToast(isCamOn ? 'Camera On' : 'Camera Off');
});

function setCamState(enabled) {
  isCamOn = enabled;
  if (localStream) {
    localStream.getVideoTracks().forEach(t => (t.enabled = enabled));
  }
  iconCamOn.style.display = enabled ? 'block' : 'none';
  iconCamOff.style.display = enabled ? 'none' : 'block';
  btnToggleCam.classList.toggle('active-off', !enabled);
  localPlaceholder.style.display = enabled ? 'none' : 'flex';
  localVideo.style.display = enabled ? 'block' : 'none';
}

// Flip Camera (Mobile Facing Mode)
btnFlipCam.addEventListener('click', async () => {
  if (!localStream) return;
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode },
      audio: false
    });
    const newVideoTrack = newStream.getVideoTracks()[0];

    // Replace track on peer connections
    peers.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(newVideoTrack);
    });

    // Replace local stream video track
    const oldVideoTrack = localStream.getVideoTracks()[0];
    if (oldVideoTrack) {
      oldVideoTrack.stop();
      localStream.removeTrack(oldVideoTrack);
    }
    localStream.addTrack(newVideoTrack);
    localVideo.srcObject = localStream;

    showToast(`Switched to ${currentFacingMode === 'user' ? 'Front' : 'Back'} Camera`);
  } catch (err) {
    console.error('Camera flip error:', err);
    showToast('Camera switch nahi ho paya');
  }
});

// Screen Share Toggle
btnScreenShare.addEventListener('click', async () => {
  if (isScreenSharing) {
    stopScreenSharing();
    return;
  }

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });
    isScreenSharing = true;
    btnScreenShare.classList.add('active-off');
    showToast('Screen sharing chalu hai');

    const screenTrack = screenStream.getVideoTracks()[0];

    // Replace tracks for all connected peers
    peers.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(screenTrack);
    });

    localVideo.srcObject = screenStream;

    screenTrack.onended = () => {
      stopScreenSharing();
    };
  } catch (err) {
    console.log('Screen sharing cancelled or not supported:', err);
  }
});

function stopScreenSharing() {
  if (!isScreenSharing) return;
  isScreenSharing = false;
  btnScreenShare.classList.remove('active-off');

  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }

  // Restore camera track to peers
  if (localStream) {
    const cameraTrack = localStream.getVideoTracks()[0];
    peers.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
    });
    localVideo.srcObject = localStream;
  }
  showToast('Screen sharing band ho gayi');
}

// Leave Call
btnLeaveCall.addEventListener('click', () => {
  if (confirm('Kya aap call chhodkar jana chahte hain?')) {
    cleanupAndExit();
  }
});

function cleanupAndExit() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
  }
  peers.forEach(({ pc }) => pc.close());
  socket.disconnect();
  window.location.href = '/';
}

// ============================================
// CHAT FUNCTIONALITY
// ============================================
btnToggleChat.addEventListener('click', () => {
  isChatOpen = !isChatOpen;
  chatDrawer.classList.toggle('open', isChatOpen);
  if (isChatOpen) {
    unreadCount = 0;
    unreadBadge.style.display = 'none';
    chatInput.focus();
  }
});

btnCloseChat.addEventListener('click', () => {
  isChatOpen = false;
  chatDrawer.classList.remove('open');
});

// Quick emoji click handler
document.querySelectorAll('.quick-emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const emoji = btn.getAttribute('data-emoji');
    sendChatMessage(emoji);
  });
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    sendChatMessage(text);
    chatInput.value = '';
  }
});

function sendChatMessage(text) {
  socket.emit('send-message', {
    roomId,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
}

// Receive message
socket.on('receive-message', ({ senderId, senderName, text, time }) => {
  const isMine = senderId === socket.id;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isMine ? 'mine' : 'theirs'}`;

  const senderSpan = document.createElement('div');
  senderSpan.className = 'chat-sender';
  senderSpan.textContent = isMine ? 'You' : senderName;

  const textNode = document.createElement('div');
  textNode.textContent = text;

  const timeSpan = document.createElement('div');
  timeSpan.className = 'chat-time';
  timeSpan.textContent = time;

  bubble.appendChild(senderSpan);
  bubble.appendChild(textNode);
  bubble.appendChild(timeSpan);

  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (!isMine) {
    playChime('message');
    if (!isChatOpen) {
      unreadCount++;
      unreadBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      unreadBadge.style.display = 'flex';
      showToast(`💬 ${senderName}: ${text.slice(0, 30)}`);
    }
  }
});

function appendSystemMessage(msg) {
  const div = document.createElement('div');
  div.className = 'chat-system-msg';
  div.textContent = msg;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ============================================
// SHARE & COPY INVITE LINK
// ============================================
function getInviteUrl() {
  return `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
}

btnCopyRoom.addEventListener('click', () => {
  copyInviteLink();
});

btnShareInvite.addEventListener('click', () => {
  const inviteUrl = getInviteUrl();
  if (navigator.share) {
    navigator.share({
      title: 'FreeTalk - Aao baat karein!',
      text: `${username} aapko FreeTalk par voice/video call aur chat ke liye bula rahe hain. Join karein:`,
      url: inviteUrl
    }).catch(err => {
      if (err.name !== 'AbortError') copyInviteLink();
    });
  } else {
    copyInviteLink();
  }
});

function copyInviteLink() {
  const inviteUrl = getInviteUrl();
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showToast('Room link copy ho gaya! Dosto ko share karein');
  }).catch(() => {
    prompt('Link copy karein:', inviteUrl);
  });
}

// Toast helper
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2500);
}
