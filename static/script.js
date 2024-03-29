const record_btn = document.getElementById("recordButton");
const send_btn = document.getElementById("sendButton");
const msg_input = document.getElementById("messageInput");
const chatbox = document.getElementById("chatbox");
const session_message = [];
let recorder;
let run_recog = true;

msg_input.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        sendButton.click();
    }
});

send_btn.addEventListener("click", async() => {
    const message = msg_input.value.trim();
    if (message !== "") {
        append_user_chat(message);
        msg_input.value = "";
        await GatherChat(message);
    }
});

const append_ai_chat = (message) => {
    const aiMessage = document.createElement("div");
    aiMessage.classList.add("message", "ai-message");
    aiMessage.innerHTML = `
        <div class="avatar"><img src="/static/images/ai.png" alt="AI"></div>
        <div class="content">${message}</div>
    `;
    chatbox.appendChild(aiMessage);
};

const append_user_chat = (message) => {
    const userMessage = document.createElement("div");
    userMessage.classList.add("message", "user-message");
    userMessage.innerHTML = `
        <div class="avatar"><img src="/static/images/user.png" alt="User"></div>
        <div class="content">${message}</div>
    `;
    chatbox.appendChild(userMessage);
};

const runSpeechRecog = async() => {
    if(run_recog === true){
        send_btn.disabled = true
        run_recog = false;
        recorder = await recordAudio();
        recorder.start();
    }else{
        const audio = await recorder.stop();
        await transcribeAudio(audio)
        run_recog = true;
        send_btn.disabled = false
    }
};

const transcribeAudio = async (audio) => {
    const response = await fetch(
        "/transcribe-audio", {
        method: "POST",
        body: JSON.stringify({
            audio: audio,
        }),
    });
    const myJson = await response.json();
    response_text = myJson.Data
    append_user_chat(response_text);
    await GatherChat(response_text);
};

const GatherChat = async (transcript) => {
    session_message.push(`User: ${transcript}`);
    const response = await fetch(
        "/chat", {
        method: "POST",
        body: JSON.stringify({user_input: session_message}),
    });
    const myJson = await response.json();
    append_ai_chat(myJson.Data.response_text);
    session_message.push(`AI: ${myJson.Data.response_text}`);
    var audio = new Audio(
        "data:audio/wav;base64," + myJson.Data.response_audio
    );
    audio.play();
    record_btn.disabled = false
    record_btn.innerText = "Record Voice";
};

const recordAudio = async() => new Promise(async resolve => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];
    mediaRecorder.addEventListener("dataavailable", event => {
    audioChunks.push(event.data);
    });
    const start = () => {
        record_btn.innerText = "Click To Submit";
        mediaRecorder.start();
    }
    const stop = () => 
    new Promise(resolve => {
        mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob)
        reader.onloadend = () => {
            const audio_data = reader.result;
            record_btn.disabled = true;
            record_btn.innerText = "Waiting for response";
            resolve(audio_data);
        }
        });
        mediaRecorder.stop();
    });
    resolve({ start, stop });
});