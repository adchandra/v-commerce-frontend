// components/Chat.js
import React, { useState, useEffect, useRef } from 'react';

function Chat() {
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Selamat datang di toko oleh-oleh khas Yogyakarta! Ada yang bisa saya bantu?" }
  ]);
  const [input, setInput] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const chatRef = useRef(null);

  const speak = (text) => {
  if (!voiceOn) return;

  // Hentikan suara sebelumnya dulu
  speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'id-ID';
  speechSynthesis.speak(utter);
};


  const scrollToBottom = () => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    speechSynthesis.cancel();

    const userMsg = { sender: "user", text: input };
    setMessages(prev => [...prev, userMsg, { sender: "bot", text: "Mengetik..." }]);
    setInput("");

    try {
      const response = await fetch("https://v-commerce-backend-production.up.railway.app/api/ask-npc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input })
      });

      const data = await response.json();
      const reply = data.response || "Maaf, saya tidak bisa menjawab.";
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { sender: "bot", text: reply };
        return updated;
      });
      speak(reply);
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { sender: "bot", text: "Terjadi kesalahan saat menghubungi server." };
        return updated;
      });
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="chat-container" role="log">
      <div className="chat-window">
        {messages.map((msg, i) => (
          <div key={i} className={`message-row ${msg.sender}`}>
            <div className={`message ${msg.sender}`}>
              {msg.text === "Mengetik..." ? (
                <div className="typing">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
        <div ref={chatRef} />
      </div>
      
      <div className="quick-questions">
        <button onClick={() => setInput("Apa saja oleh-oleh yang ada?")}>Daftar Oleh-oleh</button>
        <button onClick={() => setInput("Apa oleh-oleh paling laris?")}>Oleh-oleh Paling Laris</button>
        <button onClick={() => setInput("Apa yang khas dari Gudeg Jogja?")}>Tentang Gudeg</button>

      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Tanyakan sesuatu tentang makanan khas Jogja..."
          aria-label="input-pesan"
        />
        <button onClick={sendMessage}>Kirim</button>
        <button onClick={() => setVoiceOn(!voiceOn)}>{voiceOn ? '🔊 Suara Aktif' : '🔇 Suara Mati'}</button>
      </div>
    </div>
  );
}

export default Chat;
