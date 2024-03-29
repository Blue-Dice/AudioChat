from flask import Flask, request, jsonify, url_for, redirect, render_template
from openai import OpenAI
from decouple import config
from flask_cors import CORS
import io, json, base64, logging

FLASK_HOST = config("FLASK_HOST")
FLASK_PORT = config("FLASK_PORT")
FLASK_DEBUG = config("FLASK_DEBUG")

app = Flask(__name__)
app.secret_key = config("FLASK_SECRET_KEY")
CORS(app, resources = "*")
openai_client = OpenAI(api_key = config("OPENAI_API_KEY"))
        
def response(status= 200, message = None, data = None):
    context = {}
    context["Data"] = data
    context["Error"] = False if (200 <= status <= 299) else True
    context["Status"] = status
    context["Message"] = message
    result = f"{status} -> {context.get('Message')}"
    logging.error(result) if context["Error"] else logging.info(result)
    return jsonify(context), status

@app.route("/favicon.ico", methods = ["GET"])
def favicon():
    return redirect(url_for("static", filename="images/favicon.png"))

@app.route("/", methods = ["GET"])
def home_page():
    return render_template("base.html")

@app.route("/chat", methods = ["POST"])
def process_request():
    user_input = json.loads(request.data.decode("utf-8"))["user_input"]
    response_text = generate_response(user_input)
    response_audio = synthesize_audio(response_text)
    context = {}
    context["response_text"] = response_text
    context["response_audio"] = response_audio
    return response(data = context)

@app.route("/transcribe-audio", methods = ["POST"])
def transcribe_aduio():
    audio_file = json.loads(request.data.decode("utf-8"))["audio"]
    audio_file = audio_file.split(',',1)[1]
    audio_file = io.BytesIO(base64.b64decode(audio_file.encode()))
    audio_file.name = "audio.mp3"
    transcript = openai_client.audio.transcriptions.create(model = "whisper-1", file = audio_file, language = "en").text
    return response(data = transcript)

def generate_response(user_input):
    chat_history = [{"role": "system", "content": "You are a helpful assistant."}]
    for chat in user_input:
        if chat.startswith("User:"):
            chat_history.append({"role": "user", "content": chat.replace("User:", "").strip()})
        elif chat.startswith("AI:"):
            chat_history.append({"role": "assistant", "content": chat.replace("AI:", "").strip()})
    return openai_client.chat.completions.create(
        model = "gpt-3.5-turbo",
        messages = chat_history
    ).choices[0].message.content

def synthesize_audio(text):
    response_audio = openai_client.audio.speech.with_raw_response.create(
        model = "tts-1",
        voice = "alloy",
        response_format = "wav",
        input = text
    ).content
    return base64.b64encode(response_audio).decode("utf-8")

if __name__ == "__main__":
    app.run(FLASK_HOST, FLASK_PORT, FLASK_DEBUG)