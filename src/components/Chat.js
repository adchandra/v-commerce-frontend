// components/Chat.js
import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


/**
 * Util: Menghapus sintaks Markdown dari teks untuk kebutuhan Text-to-Speech.
 * - Menghapus gambar: ![alt](url)
 * - Mengubah link [teks](url) menjadi "teks (url)"
 * - Menghapus sisa markup dasar (*, _, #, >, `)
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
 * Selain itu diblokir dengan '##blocked'.
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

function Chat() {
  // STATE UTAMA
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Selamat datang di toko oleh-oleh khas Yogyakarta! Ada yang bisa saya bantu?",
    },
  ]);
  const [input, setInput] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const chatRef = useRef(null);

  /**
   * Fungsi: speak
   * Tujuan: Membacakan teks menggunakan Web Speech API.
   * - Menghormati toggle 'voiceOn'.
   * - Menghentikan ucapan sebelumnya untuk mencegah overlap.
   * - Menggunakan teks yang sudah di-strip dari Markdown agar natural.
   */
  const speak = (text) => {
    if (!voiceOn) return;
    // hentikan suara sebelumnya
    try {
      speechSynthesis.cancel();
    } catch {}
    const plain = stripMarkdown(text);
    if (!plain.trim()) return;
    const utter = new SpeechSynthesisUtterance(plain);
    utter.lang = "id-ID";
    try {
      speechSynthesis.speak(utter);
    } catch {}
  };

  /**
   * Fungsi: scrollToBottom
   * Tujuan: Auto-scroll ke bagian paling bawah saat ada pesan baru.
   */
  const scrollToBottom = () => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  /**
   * Fungsi: sendMessage
   * Tujuan:
   * - Mengirim pesan user ke backend /api/ask-npc
   * - Menampilkan placeholder "Mengetik..." saat menunggu balasan
   * - Mengganti placeholder dengan balasan bot (Markdown)
   * - Memicu TTS pada balasan
   * Catatan keamanan:
   * - Backend sudah menyaring skema URL berbahaya.
   * - Frontend juga menyaring saat render (lihat ReactMarkdown di bawah).
   */
  const sendMessage = async () => {
    if (!input.trim()) return;

    // hentikan TTS yang sedang berjalan
    try {
      speechSynthesis.cancel();
    } catch {}

    const userMsg = { sender: "user", text: input };
    setMessages((prev) => [
      ...prev,
      userMsg,
      { sender: "bot", text: "Mengetik..." },
    ]);
    setInput("");

    try {
      // Ganti URL ini sesuai environment kamu (prod/dev).
      const response = await fetch("https://v-commerce-backend-production.up.railway.app/api/ask-npc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.text }),
      });

      const data = await response.json();
      const reply = data.response || "Maaf, saya tidak bisa menjawab.";

      setMessages((prev) => {
        const updated = [...prev];
        // ganti "Mengetik..." dengan balasan sebenarnya
        updated[updated.length - 1] = { sender: "bot", text: reply };
        return updated;
      });

      speak(reply);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          sender: "bot",
          text: "Terjadi kesalahan saat menghubungi server.",
        };
        return updated;
      });
    }
  };

  /**
   * Fungsi: handleKey
   * Tujuan: Support kirim pesan dengan tombol Enter.
   */
  const handleKey = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  /**
   * Efek: Scroll ke bawah setiap kali daftar pesan berubah.
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Komponen renderer untuk ReactMarkdown agar link & gambar aman dan rapi.
const markdownComponents = useMemo(
  () => ({
    a: ({ href, children, ...props }) => (
      <a href={safeUri(href)} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    ),
    img: ({ src, alt, ...props }) => (
      <img
        src={safeUri(src)}
        alt={alt || "Gambar produk"}
        style={{ display: "block", maxWidth: "100%", height: "auto", borderRadius: 12, margin: "8px 0" }}
        loading="lazy"
        {...props}
      />
    ),
    // Paragraf umum: margin kecil
    p: ({ children, ...props }) => (
      <p style={{ margin: "4px 0", lineHeight: 1.5, fontSize: "0.95rem" }} {...props}>
        {children}
      </p>
    ),
    // Ordered list kompak
    ol: ({ children, ...props }) => (
      <ol style={{ margin: "6px 0", paddingLeft: "1.25rem", listStyle: "decimal" }} {...props}>
        {children}
      </ol>
    ),
    // Item list: kecilkan margin & biar paragraf pertama inline (judul tetap sejajar dengan nomor)
    li: ({ children, ...props }) => (
      <li style={{ margin: "4px 0" }} {...props}>
        {children}
      </li>
    ),
    // Tebal untuk judul
    strong: ({ children, ...props }) => (
      <strong style={{ fontSize: "1rem", color: "#1a237e" }} {...props}>{children}</strong>
    ),
  }),
  []
);



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
               <div className="md">
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    urlTransform={(url) => safeUri(url)}
    components={markdownComponents}
  >
    {msg.text}
  </ReactMarkdown>
</div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatRef} />
      </div>

      {/* === Bagian "quick-questions" dipertahankan apa adanya === */}
      <div className="quick-questions">
        <button onClick={() => setInput("Apa saja oleh-oleh yang ada?")}>
          Daftar Oleh-oleh
        </button>
        <button onClick={() => setInput("Apa oleh-oleh paling laris?")}>
          Oleh-oleh Paling Laris
        </button>
        <button onClick={() => setInput("Apa yang khas dari Gudeg Jogja?")}>
          Tentang Gudeg
        </button>
      </div>

      {/* === Bagian input-area dipertahankan apa adanya === */}
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Tanyakan sesuatu tentang makanan khas Jogja..."
          aria-label="input-pesan"
        />
        <button onClick={sendMessage}>Kirim</button>
        <button onClick={() => setVoiceOn(!voiceOn)}>
          {voiceOn ? "🔊 Suara Aktif" : "🔇 Suara Mati"}
        </button>
      </div>
    </div>
  );
}

export default Chat;
