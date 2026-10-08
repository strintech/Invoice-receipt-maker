import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Invoices from './pages/Invoices'
import Receipts from './pages/Receipts'
import Templates from './pages/Templates'
import Clients from './pages/Clients'
import Settings from './pages/Settings'
import { Login, Register, Verify } from './pages/Auth'
import { PrefsContext, translate } from './i18n'

// Before sign-in (and while checking the session) use the last language/theme from this device
const loadPrefs = () => {
  const defaults = { language: 'en', theme: 'system' }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem('prefs')) }
  } catch {
    return defaults
  }
}

function App() {
  // undefined = still checking the session, null = logged out
  const [user, setUser] = useState(undefined)
  const [prefs, setPrefsState] = useState(loadPrefs)

  // Signed in, the account's settings win
  const signIn = (account) => {
    setUser(account)
    if (account) setPrefsState({ language: account.language, theme: account.theme })
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(signIn)
      .catch(() => setUser(null))
  }, [])

  // data-theme drives the color tokens in main.css ("system" follows the OS)
  useEffect(() => {
    document.documentElement.lang = prefs.language
    document.documentElement.dataset.theme = prefs.theme
    try {
      localStorage.setItem('prefs', JSON.stringify(prefs))
    } catch {
      // storage blocked: prefs still apply for this visit
    }
  }, [prefs])

  // Saved to the account first, so PDFs and previews fetched right after use the new language
  const setPrefs = async (patch) => {
    if (user) {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      })
      if (!res.ok) return
    }
    setPrefsState(prev => ({ ...prev, ...patch }))
  }

  const t = (text, vars) => translate(prefs.language, text, vars)

  let content
  if (user === undefined) {
    content = <div className="loading"><div className="spinner"></div>{t('Loading...')}</div>
  } else if (!user) {
    content = (
      <>
        <Navbar className="navbar-floating" />
        <Routes>
          <Route path="/login" element={<Login onAuth={signIn} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<Verify onAuth={signIn} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    )
  } else {
    content = (
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={() => setUser(null)} />}>
          <Route index element={<Dashboard />} />
          <Route path="invoices/*" element={<Invoices />} />
          <Route path="receipts/*" element={<Receipts />} />
          <Route path="templates/*" element={<Templates />} />
          <Route path="clients/*" element={<Clients />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    )
  }

  return (
    <PrefsContext.Provider value={{ ...prefs, setPrefs, t }}>
      {content}
    </PrefsContext.Provider>
  )
}

export default App
