// components/Chat.js
import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Util: Menghapus sintaks Markdown dari teks untuk kebutuhan Text-to-Speech.
 */
function stripMarkdown(md = "") {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // hapus gambar
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)") // link jadi "teks (url)"
    .replace(/[_*`>#~\-]+/g, "") // hapus karakter format umum
    .replace(/\n{2,}/g, "\n"); // rapikan spasi baris
}

/**
 * Util: Sanitasi URL supaya hanya http, https, dan mailto yang lolos.
 */
function safeUri(uri) {
  try {
    const u = String(uri || "").trim();
    if (/^(https?:|mailto:)/i.test(u)) return u;
    return "#blocked";
  } catch {
    return "#blocked";
  }
}

/**
 * Generate unique session ID for this chat session
 */
function generateSessionId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Enhanced suggestions based on context and user interaction
 */
const DYNAMIC_SUGGESTIONS = {
  welcome: [
    "Apa saja oleh-oleh yang ada?",
    "Lagi nyari oleh-oleh murah nih",
    "Mau beli oleh-oleh buat keluarga",
    "Yang paling recommended apa?"
  ],
  after_product_info: [
    "Ada yang lebih murah ga?",
    "Gimana cara belinya?",
    "Tahan berapa lama?",
    "Ada varian rasa lain?"
  ],
  after_comparison: [
    "Yang paling enak mana?",
    "Kalau buat hadiah bagus mana?",
    "Yang praktis dibawa pulang?",
    "Aku ambil yang mana ya?"
  ],
  budget_conscious: [
    "Yang di bawah 20 ribu ada?",
    "Paket hemat ada ga?",
    "Bisa nego ga harganya?",
    "Yang worth it apa?"
  ]
};

function Chat() {
  // STATE UTAMA
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Halo kak! Selamat datang di toko oleh-oleh! 🏪\n\nAku siap bantu cariin oleh-oleh khas Jogja yang cocok buat kamu. Mau cari yang mana nih? 😊",
      timestamp: Date.now()
    },
  ]);
  const [input, setInput] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const [suggestions, setSuggestions] = useState(DYNAMIC_SUGGESTIONS.welcome);
  const [chatContext, setChatContext] = useState("welcome");
  const chatRef = useRef(null);
  const [conversationStats, setConversationStats] = useState({
    messageCount: 1,
    productsDiscussed: [],
    userInterests: []
  });

  /**
   * Enhanced speak function with better voice settings
   */
  const speak = (text) => {
    if (!voiceOn) return;
    try {
      speechSynthesis.cancel();
      const plain = stripMarkdown(text);
      if (!plain.trim()) return;
      
      const utter = new SpeechSynthesisUtterance(plain);
      utter.lang = "id-ID";
      utter.rate = 0.9; // Sedikit lebih lambat untuk clarity
      utter.pitch = 1.1; // Sedikit lebih tinggi untuk friendly tone
      utter.volume = 0.8;
      
      speechSynthesis.speak(utter);
    } catch (error) {
      console.log("TTS error:", error);
    }
  };

  /**
   * Analyze bot response to update context and suggestions
   */
  const analyzeResponse = (response) => {
    const lowerResponse = response.toLowerCase();
    const newStats = { ...conversationStats };
    
    // Detect discussed products
    const productMentions = [
      'bakpia', 'geplak', 'yangko', 'gudeg', 'monggo', 
      'batik', 'jumputan', 'kopi joss'
    ];
    
    productMentions.forEach(product => {
      if (lowerResponse.includes(product) && !newStats.productsDiscussed.includes(product)) {
        newStats.productsDiscussed.push(product);
      }
    });

    // Detect user interests
    if (lowerResponse.includes('murah') || lowerResponse.includes('budget')) {
      if (!newStats.userInterests.includes('budget_conscious')) {
        newStats.userInterests.push('budget_conscious');
      }
    }
    
    if (lowerResponse.includes('hadiah') || lowerResponse.includes('gift')) {
      if (!newStats.userInterests.includes('gift_shopping')) {
        newStats.userInterests.push('gift_shopping');
      }
    }

    setConversationStats(newStats);

    // Update context and suggestions
    if (lowerResponse.includes('rp ') || lowerResponse.includes('harga')) {
      setChatContext("after_product_info");
      setSuggestions(DYNAMIC_SUGGESTIONS.after_product_info);
    } else if (lowerResponse.includes('atau') || lowerResponse.includes('banding')) {
      setChatContext("after_comparison");
      setSuggestions(DYNAMIC_SUGGESTIONS.after_comparison);
    } else if (newStats.userInterests.includes('budget_conscious')) {
      setChatContext("budget_conscious");
      setSuggestions(DYNAMIC_SUGGESTIONS.budget_conscious);
    }
  };

  /**
   * Enhanced sendMessage with better UX
   */
  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    try {
      speechSynthesis.cancel();
    } catch {}

    const userMsg = { 
      sender: "user", 
      text: input,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Add typing indicator with delay for more natural feel
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        sender: "bot", 
        text: "Mengetik...", 
        isTyping: true,
        timestamp: Date.now()
      }]);
    }, 300);

    try {
      const response = await fetch("v-commerce-backend-production.up.railway.app/api/ask-npc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMsg.text,
          sessionId: sessionId
        }),
      });

    //  try {
    //   const response = await fetch("http://localhost:3002/api/ask-npc", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ 
    //       message: userMsg.text,
    //       sessionId: sessionId
    //     }),
    //   });
      const data = await response.json();
      const reply = data.response || "Maaf kak, aku lagi bingung nih. Coba tanya lagi yuk! 😅";

      // Remove typing indicator and add real response
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { 
          sender: "bot", 
          text: reply,
          timestamp: Date.now(),
          isError: data.isError
        };
        return updated;
      });

      // Update conversation stats
      setConversationStats(prev => ({
        ...prev,
        messageCount: prev.messageCount + 2
      }));

      // Analyze response for context
      analyzeResponse(reply);

      // Speak with slight delay for better UX
      setTimeout(() => speak(reply), 500);

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          sender: "bot",
          text: "Waduh, koneksinya lagi bermasalah kak. Coba lagi yuk! Aku masih siap bantu kok 😊",
          isError: true,
          timestamp: Date.now()
        };
        return updated;
      });
    } finally {
      setIsTyping(false);
    }
  };

  /**
   * Enhanced quick question handler
   */
  const handleQuickQuestion = (question) => {
    setInput(question);
    // Auto-send after small delay for better UX
    setTimeout(() => {
      if (!isTyping) {
        sendMessage();
      }
    }, 100);
  };

  /**
   * Scroll to bottom
   */
  const scrollToBottom = () => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * Handle key press
   */
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * Clear conversation
   */
  const clearConversation = async () => {
    try {
      await fetch(`https://v-commerce-backend-production.up.railway.app/api/conversation/${sessionId}`, {
        method: "DELETE"
      });
      
      setMessages([{
        sender: "bot",
        text: "Halo lagi kak! Mau mulai ngobrol dari awal nih? Ada yang bisa aku bantuin? 😊",
        timestamp: Date.now()
      }]);
      
      setChatContext("welcome");
      setSuggestions(DYNAMIC_SUGGESTIONS.welcome);
      setConversationStats({
        messageCount: 1,
        productsDiscussed: [],
        userInterests: []
      });
      
      try {
        speechSynthesis.cancel();
      } catch {}
      
    } catch (error) {
      console.error("Clear conversation error:", error);
    }
  };

  /**
   * Auto-scroll effect
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Enhanced markdown components
  const markdownComponents = useMemo(
    () => ({
      a: ({ href, children, ...props }) => (
        <a 
          href={safeUri(href)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="chat-link"
          {...props}
        >
          {children} 🔗
        </a>
      ),
      img: ({ src, alt, ...props }) => (
        <div className="image-container">
          <img
            src={safeUri(src)}
            alt={alt || "Gambar produk"}
            className="chat-image"
            loading="lazy"
            {...props}
          />
        </div>
      ),
      p: ({ children, ...props }) => (
        <p className="chat-paragraph" {...props}>
          {children}
        </p>
      ),
      strong: ({ children, ...props }) => (
        <strong className="chat-strong" {...props}>{children}</strong>
      ),
      ul: ({ children, ...props }) => (
        <ul className="chat-list" {...props}>{children}</ul>
      ),
      li: ({ children, ...props }) => (
        <li className="chat-list-item" {...props}>{children}</li>
      ),
    }),
    []
  );

  return (
    <div className="chat-container" role="log">
      {/* Chat Header with Stats */}
      <div className="chat-header">
        <div className="chat-title">
          <h3>💬 Mulai Chat </h3>
          <span className="chat-status">
            {conversationStats.messageCount > 1 && (
              <span className="stats">
                {conversationStats.messageCount} pesan • {conversationStats.productsDiscussed.length} produk dibahas
              </span>
            )}
          </span>
        </div>
        <button 
          onClick={clearConversation}
          className="clear-chat-btn"
          title="Mulai percakapan baru"
        >
          🔄 Reset
        </button>
      </div>

      {/* Chat Window */}
      <div className="chat-window">
        {messages.map((msg, i) => (
          <div key={i} className={`message-row ${msg.sender}`}>
            <div className={`message ${msg.sender} ${msg.isError ? 'error' : ''}`}>
              {msg.text === "Mengetik..." || msg.isTyping ? (
                <div className="typing">
                  <div className="typing-dots">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              ) : (
                <div className="message-content">
                  <div className="md">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      urlTransform={(url) => safeUri(url)}
                      components={markdownComponents}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                  {msg.timestamp && (
                    <div className="message-timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatRef} />
      </div>

      {/* Dynamic Quick Suggestions */}
      <div className="quick-questions">
        <div className="suggestions-header">
          <span>💡 Saran pertanyaan:</span>
        </div>
        <div className="suggestions-grid">
          {suggestions.map((suggestion, i) => (
            <button 
              key={i}
              onClick={() => handleQuickQuestion(suggestion)}
              className="suggestion-btn"
              disabled={isTyping}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Enhanced Input Area */}
      <div className="input-area">
        <div className="input-wrapper">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              isTyping 
                ? "Mbak Sari lagi mikir..." 
                : "Tanyakan tentang oleh-oleh Jogja... (Enter untuk kirim)"
            }
            aria-label="input-pesan"
            disabled={isTyping}
            rows={1}
            className="chat-input"
          />
          <div className="input-actions">
            <button 
              onClick={sendMessage}
              disabled={!input.trim() || isTyping}
              className="send-btn"
              title="Kirim pesan"
            >
              {isTyping ? "⏳" : "📤"}
            </button>
            <button 
              onClick={() => setVoiceOn(!voiceOn)}
              className={`voice-btn ${voiceOn ? 'active' : 'inactive'}`}
              title={voiceOn ? "Matikan suara" : "Nyalakan suara"}
            >
              {voiceOn ? "🔊" : "🔇"}
            </button>
          </div>
        </div>
        <div className="input-hints">
          <span className="hint">
            💬 {conversationStats.productsDiscussed.length > 0 && 
              `Udah bahas: ${conversationStats.productsDiscussed.join(', ')}`
            }
            {conversationStats.userInterests.length > 0 && 
              ` • Minat: ${conversationStats.userInterests.join(', ')}`
            }
          </span>
        </div>
      </div>
    </div>
  );
} 
          
export default Chat;
