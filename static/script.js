// --- Markdown config ---
marked.setOptions({
  breaks: true // turn newlines into <br>
});

const chatBox   = document.getElementById("chat-box");
const typing    = document.getElementById("typing");
const msg       = document.getElementById("msg");
const form      = document.getElementById("chat-form");
const recBtn    = document.getElementById("recBtn");
const resetBtn  = document.getElementById("resetBtn");

let mediaRecorder = null;
let chunks = [];
let isRecording = false;
let currentAudio = null;

// --- Events ---
form.onsubmit = (e) => {
  e.preventDefault();
  sendMessage();
};
recBtn.onclick  = toggleRecording;
resetBtn.onclick = resetConversation;

// --- Add chat bubble ---
function addMessage(role, text, time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role === "user" ? "me" : "bot"}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  let html = marked.parse(text, { breaks: true });

  // clean trailing <br> / empty <p>
  html = html
    .replace(/<\/p>\s*<(ol|ul)>/gi, "<br><$1>")
    .replace(/(\s|<br\s*\/?>|<p>\s*<\/p>)+$/gi, "")
    .trim();

  // strip outer <p> if it's the only wrapper
  if (/^<p>[\s\S]*<\/p>$/.test(html)) {
    html = html.replace(/^<p>|<\/p>$/g, "");
  }

  bubble.innerHTML = html;

  // add timestamp
  const timeEl = document.createElement("div");
  timeEl.className = "time";
  timeEl.textContent = time;
  bubble.appendChild(timeEl);

  // actions only for bot
  if (role === "bot") {
    const actions = document.createElement("div");
    actions.className = "actions";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.textContent = "🔊 Play";
    playBtn.onclick = () => playVoice(text);

    const stopBtn = document.createElement("button");
    stopBtn.type = "button";
    stopBtn.className = "stop-btn";
    stopBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
          viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </svg>
      <span class="sr-only">Stop</span>
    `;
    stopBtn.onclick = stopVoice;

    actions.appendChild(playBtn);
    actions.appendChild(stopBtn);
    bubble.appendChild(actions);
  }

  wrap.appendChild(bubble);
  chatBox.appendChild(wrap);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// --- Send message to server ---
async function sendMessage(textOverride = null) {
  const content = (textOverride ?? msg.value).trim();
  if (!content) return;

  addMessage("user", content);
  msg.value = "";
  typing.style.display = "block";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ message: content })
    });
    const data = await res.json();
    typing.style.display = "none";

    if (data.error) {
      addMessage("bot", `Error: ${data.error}`);
      return;
    }
    addMessage("bot", data.reply, data.time);
  } catch (e) {
    typing.style.display = "none";
    addMessage("bot", `Error: ${e.message}`);
  }
}

// --- Text-to-Speech ---
async function playVoice(text) {
  stopVoice();
  try {
    const res = await fetch("/tts", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    currentAudio = new Audio(data.audio_url);
    currentAudio.play();
  } catch (e) {
    alert("TTS error: " + e.message);
  }
}

function stopVoice() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

// --- Speech-to-Text ---
async function toggleRecording() {
  if (!isRecording) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      recBtn.classList.remove("recording");
      document.getElementById("recStatus").style.display = "none";
      isRecording = false;

      const blob = new Blob(chunks, { type: "audio/webm" });
      const form = new FormData();
      form.append("audio", blob, "recording.webm");

      typing.style.display = "block";
      try {
        const sttRes = await fetch("/stt", { method: "POST", body: form });
        const sttData = await sttRes.json();
        typing.style.display = "none";

        if (sttData.error) {
          addMessage("bot", `STT Error: ${sttData.error}`);
          return;
        }
        const transcript = (sttData.text || "").trim();
        if (!transcript) {
          addMessage("bot", "I couldn't hear that clearly. Please try again.");
          return;
        }
        await sendMessage(transcript);
      } catch (e) {
        typing.style.display = "none";
        addMessage("bot", `STT Error: ${e.message}`);
      }
    };

    mediaRecorder.start();
    recBtn.classList.add("recording");
    const recStatus = document.getElementById("recStatus");
    recStatus.style.display = "block";
    recStatus.textContent = "Recording… click 🎤 again to stop.";
    isRecording = true;
  } else {
    mediaRecorder.stop();
  }
}

// --- Reset chat ---
async function resetConversation() {
  stopVoice();
  chatBox.innerHTML = "";
  await fetch("/reset", { method: "POST" });
  addMessage("bot", "Conversation has been reset.");
}