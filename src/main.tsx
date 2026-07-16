import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Restore theme preference before first paint
const saved = localStorage.getItem('foresight-theme')
if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
