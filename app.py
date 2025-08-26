import os
import asyncio
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from werkzeug.utils import secure_filename

import google.generativeai as genai      # Gemini LLM
import edge_tts                          # Text-to-Speech
import speech_recognition as sr          # Speech-to-Text
from pydub import AudioSegment

# --- Setup ---
load_dotenv()
AUDIO_DIR = Path("static/audio")
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY in .env")

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
DEFAULT_VOICE = "en-US-JennyNeural"

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = str(AUDIO_DIR)

# --- Gemini ---
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel(MODEL_NAME)
chat_session = model.start_chat(history=[])   # keep context between messages
chat_history = []                              # store chat for UI preview/debug


# --- Helpers ---
async def tts_edge(text: str, out_path: Path, voice: str = DEFAULT_VOICE):
    """Save TTS output to an mp3 file."""
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(out_path))

def now_hhmm() -> str:
    return datetime.now().strftime("%H:%M")


# --- Routes ---
@app.get("/")
def index():
    return render_template("index.html")

@app.get("/health")
def health():
    return "ok"

@app.post("/chat")
def chat():
    """Receive user message → send to Gemini → return reply."""
    payload = request.get_json(silent=True) or {}
    user_input = (payload.get("message") or "").strip()
    if not user_input:
        return jsonify({"error": "Empty message"}), 400

    resp = chat_session.send_message(user_input)
    bot_text = resp.text if getattr(resp, "text", None) else "Sorry, I couldn't generate a reply."
    ts = now_hhmm()

    chat_history.extend([
        {"role": "user", "text": user_input, "time": ts},
        {"role": "bot", "text": bot_text,   "time": ts},
    ])
    return jsonify({"reply": bot_text, "time": ts})

@app.post("/tts")
def tts():
    """On-demand TTS: text → mp3 → return audio URL."""
    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    voice = payload.get("voice", DEFAULT_VOICE)
    if not text:
        return jsonify({"error": "No text provided"}), 400

    filename = f"reply_{int(datetime.now().timestamp())}.mp3"
    out_path = AUDIO_DIR / filename
    asyncio.run(tts_edge(text, out_path, voice))
    return jsonify({"audio_url": f"/static/audio/{filename}"})

@app.post("/stt")
def stt():
    """Speech-to-text: receive audio → convert to wav → transcribe."""
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    f = request.files["audio"]
    filename = secure_filename(f.filename or "recording.webm")
    src_path = AUDIO_DIR / filename
    f.save(src_path)

    # convert to wav
    wav_path = src_path.with_suffix(".wav")
    AudioSegment.from_file(src_path).export(wav_path, format="wav")

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(str(wav_path)) as source:
            audio = recognizer.record(source)
            text = recognizer.recognize_google(audio, language="en-US")  # change to "id-ID" if needed
    except sr.UnknownValueError:
        text = ""
    except sr.RequestError as e:
        return jsonify({"error": f"STT service error: {e}"}), 502

    return jsonify({"text": text})

@app.get("/history")
def history():
    """Return conversation history (for UI/debug)."""
    return jsonify(chat_history)

@app.post("/reset")
def reset():
    """Reset LLM session and history."""
    global chat_session, chat_history
    chat_session = model.start_chat(history=[])
    chat_history = []
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)