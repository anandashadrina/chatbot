# Conversational Chatbot

A simple web-based chatbot that integrates:

- **Gemini (Google Generative AI)** for conversation  
- **Edge TTS** for text-to-speech  
- **SpeechRecognition + pydub** for speech-to-text  
- **Flask** for the backend API  
- **Javascript + CSS** for the frontend  

---

## Features

- Chat with a conversational AI (Gemini).  
- Bot can reply in text and generate voice (TTS).  
- Speak your input and transcribe to text (STT).  
- Reset conversation memory.  

---

## Project Structure

```
├── app.py # Flask backend
├── requirements.txt # Python dependencies
├── Dockerfile # Container definition
├── static/
│ ├── style.css # UI styles
│ ├── script.js # Frontend logic
│ └── audio/ # Generated TTS audio files (runtime)
└── templates/
└── index.html # Chat UI
```

## Setup (Local Development)

### 1. Clone the repo
```bash
git clone https://github.com/yourname/chatbot.git
cd chatbot
````

### 2. Create a virtual environment & install dependencies

```bash
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Set up environment variables

Create a `.env` file in the project root:

```ini
GEMINI_API_KEY=your_api_key_here
```

### 4. Run the app

```bash
python app.py
```

## Run with Docker

The project includes a `Dockerfile` for containerized deployment.

### 1. Build the image
```bash
docker build -t chatbot:1.0.0
```

### 2. Run the container
```bash
docker run -p 5000:5000 chatbot:1.0.0
```

### 3. Open in browser
Now open: http://localhost:5000