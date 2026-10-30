const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback routing for room paths
app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// In-memory room store: roomId -> Map(socketId -> { username, audio, video })
const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('join-room', ({ roomId, username, audio = true, video = true }) => {
    currentRoom = roomId;
    currentUser = username || 'Guest';

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const roomParticipants = rooms.get(roomId);

    // List of existing users in the room (excluding this new socket)
    const existingUsers = [];
    roomParticipants.forEach((userData, sId) => {
      existingUsers.push({
        socketId: sId,
        username: userData.username,
        audio: userData.audio,
        video: userData.video
      });
    });

    // Save this user to room
    roomParticipants.set(socket.id, {
      username: currentUser,
      audio,
      video
    });

    // Send existing users to the newly joined peer
    socket.emit('existing-users', {
      users: existingUsers,
      yourId: socket.id
    });

    // Notify others in the room that a new peer joined
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      username: currentUser,
      audio,
      video
    });

    // Broadcast updated participant count
    io.in(roomId).emit('room-info', {
      roomId,
      participantCount: roomParticipants.size
    });
  });

  // WebRTC Signaling: Offer
  socket.on('signal-offer', ({ target, sdp, callerName }) => {
    io.to(target).emit('signal-offer', {
      caller: socket.id,
      callerName: callerName || currentUser,
      sdp
    });
  });

  // WebRTC Signaling: Answer
  socket.on('signal-answer', ({ target, sdp }) => {
    io.to(target).emit('signal-answer', {
      responder: socket.id,
      sdp
    });
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('signal-ice', ({ target, candidate }) => {
    io.to(target).emit('signal-ice', {
      sender: socket.id,
      candidate
    });
  });

  // Chat message relay
  socket.on('send-message', ({ roomId, text, timestamp }) => {
    if (!roomId || !text) return;
    const msgData = {
      senderId: socket.id,
      senderName: currentUser || 'Anonymous',
      text: text.trim(),
      time: timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    io.in(roomId).emit('receive-message', msgData);
  });

  // Media state toggle (mic mute / cam off)
  socket.on('media-toggle', ({ roomId, type, enabled }) => {
    if (rooms.has(roomId)) {
      const roomParticipants = rooms.get(roomId);
      if (roomParticipants.has(socket.id)) {
        const user = roomParticipants.get(socket.id);
        user[type] = enabled;
      }
    }
    socket.to(roomId).emit('user-media-toggled', {
      socketId: socket.id,
      type,
      enabled
    });
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const roomParticipants = rooms.get(currentRoom);
      roomParticipants.delete(socket.id);

      socket.to(currentRoom).emit('user-left', {
        socketId: socket.id,
        username: currentUser
      });

      if (roomParticipants.size === 0) {
        rooms.delete(currentRoom);
      } else {
        io.in(currentRoom).emit('room-info', {
          roomId: currentRoom,
          participantCount: roomParticipants.size
        });
      }
    }
  });
});

// Helper to get local network IP address
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🚀 Free Talk App is running! 100% Free Communication`);
  console.log(`- PC / Local access:     http://localhost:${PORT}`);
  console.log(`- Mobile / WiFi access:  http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});
