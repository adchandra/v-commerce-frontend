// App.js
import React, { useState } from 'react';
import Chat from './components/Chat';
import './style.css';

function App() {
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className={`App ${theme}`}>
      <h2>JOKO AI</h2>
      <Chat />
      <footer>
        <p>© 2025 JOKO AI Toko Oleh-oleh Jogja. Semua hak dilindungi.</p>
      </footer>
    </div>
  );
}

export default App;
