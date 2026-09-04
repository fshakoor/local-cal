import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/fraunces'
import './index.css'
import App from './App'
import { applyTheme, loadTheme } from './lib/theme'

applyTheme(loadTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
