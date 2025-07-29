import React, { useState } from 'react';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "👤", text: input };
    setMessages(prev => [...prev, userMessage, { sender: "🤖", text: "Mengetik..." }]);
    setInput("");

    try {
      const response = await fetch("https://v-commerce-backend-production.up.railway.app/api/ask-npc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input })
      });

      const data = await response.json();
      updateLastMessage("🤖", data.response || "Maaf, saya tidak bisa menjawab.");

    } catch (err) {
      updateLastMessage("🤖", "Terjadi kesalahan saat menghubungi server.");
    }
  };

  const updateLastMessage = (sender, newText) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { sender, text: newText };
      return updated;
    });
  };

  return (
    <div className="chat-wrapper">
      <div className="chat-box">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble ${msg.sender === "👤" ? "user" : "npc"}`}>
          {msg.sender === "👤"
            ? `${msg.text} : ${msg.sender}`
            : `${msg.sender} : ${msg.text}`}
        </div>
        ))}
      </div>
      <div className="input-box">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Tanya tentang oleh-oleh khas Jogja..."
        />
        <button onClick={sendMessage}>Kirim</button>
      </div>
    </div>
  );
}

export default Chat;
