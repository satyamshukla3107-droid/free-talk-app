# 🚀 FreeTalk - 100% Free Video, Voice & Real-time Chat App

Ekdam free, bina kisi subscription ya paid API ke chalne wala communication app jisme aap:
- 💬 **Real-time Text Chat** (Emojis, timestamps, message counters) kar sakte hain.
- 🎙️ **Clear Voice Calling** (Mute/Unmute toggle, noise suppression).
- 🎥 **HD Video Calling** (Multi-user dynamic grid, camera on/off, front/back camera switch).
- 💻 **Screen Sharing** (PC/laptop se screen dikha sakte hain).
- 📱 **Mobile & Web Responsive** (PWA support - phone me bina Play Store ke seedhe install ho jata hai).

---

## 🛠️ Yeh 100% Free Kyun Hai?
- **WebRTC (Peer-to-Peer)**: Video aur Voice direct dono users ke browser ke beech me transfer hoti hai, kisi mehnge server ke through nahi.
- **Google STUN Servers**: Connection establish karne ke liye Google ke free public STUN servers use hote hain.
- **Node.js + Socket.io**: Signaling aur chat messages lightweight open-source server se handle hote hain.

---

## 📂 Project Structure
```text
free-talk-app/
├── package.json
├── server.js              # Node.js + Express + Socket.io signaling server
└── public/
    ├── index.html         # Landing page (Name input, media test preview, join/create room)
    ├── room.html          # Call & chat interface
    ├── manifest.json      # PWA App configuration
    ├── sw.js              # Service worker
    ├── css/
    │   └── style.css      # Dark mode modern responsive UI
    ├── js/
    │   ├── index.js       # Preview & room generation logic
    │   └── room.js        # WebRTC P2P + Socket.io call & chat logic
    └── icons/
        └── icon.svg       # App logo
```

---

## 🚀 Kaise Chalayein? (How to Run)

### 1. Server Start Karein:
Terminal ya Command Prompt me run karein:
```powershell
cd "C:\Users\satya\.gemini\antigravity\scratch\free-talk-app"
node server.js
```

### 2. Browser me Kholein:
- **Apne Computer par**: `http://localhost:3000`
- **Apne Mobile par (Same WiFi)**: `http://192.168.31.31:3000` *(Aapka local IP terminal me dikhega)*

---

## 📱 Mobile me App ki tarah kaise Install karein? (PWA)
1. Apne mobile ke Chrome / Safari browser me link kholein.
2. Browser menu (3 dots) par click karein.
3. **"Add to Home Screen"** ya **"Install App"** par tap karein.
4. App aapke phone ke app drawer me WhatsApp ya kisi normal app ki tarah save ho jayegi!

---

## 🌐 Internet par Duniya bhar ke logon ke sath Free me kaise use karein?
Agar aap chahte hain ki bina same WiFi ke bhi log jud sakein:
1. **Option 1 (Instant & Free - Cloudflare Tunnel)**:
   - Run: `npx cloudflared tunnel --url http://localhost:3000`
   - Ye aapko ek free HTTPS link de dega (e.g. `https://xyz.trycloudflare.com`) jo aap kisi ko bhi WhatsApp/SMS par bhej sakte hain.
2. **Option 2 (Free Cloud Hosting - Render.com)**:
   - Is project ko GitHub par push karke [Render.com](https://render.com) par free Web Service create karein.
   - Command: `npm start`
   - Aapko hamesha ke liye 100% free live link mil jayegi.
