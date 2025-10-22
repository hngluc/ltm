// App.js
import React from 'react';
import FileList from './components/FileList';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>📥 Download Manager</h1>
      </header>
      <main>
        <FileList />
      </main>
    </div>
  );
}

export default App;