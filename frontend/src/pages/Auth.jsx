import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePrefs, useT } from '../i18n'

// Keep in sync with backend/routes/auth.js
const PASSWORD_RULES = [
  [/.{8,}/, 'At least 8 characters'],
  [/[A-Z]/, 'One uppercase letter'],
  [/[0-9]/, 'One number'],
  [/[^A-Za-z0-9]/, 'One special character']
]

const post = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// Register emails a confirmation link (see Verify). Login signs in directly, unless the email
// isn't confirmed yet: then the API sends a new link and returns only the masked address.
function useAuthForm(initial, url, onAuth) {
  const { language, theme, t } = usePrefs()
  const [formData, setFormData] = useState(initial)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      // language/theme become the new account's settings (login ignores them)
      const data = await post(url, { ...formData, language, theme })
      if (data.id) onAuth(data)
      else setSentTo(data.email)
    } catch (error) {
      setError(t(error.message))
    } finally {
      setLoading(false)
    }
  }

  return { formData, error, loading, sentTo, handleChange, handleSubmit, reset: () => setSentTo('') }
}

function CheckEmail({ email, onReset }) {
  const t = useT()
  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="page-title">{t('Check your email')}</h1>
        <p className="auth-text">
          {t('We sent a link to')} <strong>{email}</strong>. {t('Open it to confirm your email and sign in. It expires in 15 minutes.')}
        </p>
        <p className="auth-switch">{t("Didn't get it?")} <Link to="/login" onClick={onReset}>{t('Sign in again')}</Link></p>
      </div>
    </div>
  )
}

export function Login({ onAuth }) {
  const t = useT()
  const { formData, error, loading, sentTo, handleChange, handleSubmit, reset } =
    useAuthForm({ login: '', password: '' }, '/api/auth/login', onAuth)

  if (sentTo) return <CheckEmail email={sentTo} onReset={reset} />

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1 className="page-title">{t('Sign in')}</h1>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="login">{t('Username or email')}</label>
          <input id="login" name="login" className="form-input" value={formData.login}
            onChange={handleChange} autoComplete="username" required autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">{t('Password')}</label>
          <input id="password" name="password" type="password" className="form-input" value={formData.password}
            onChange={handleChange} autoComplete="current-password" required />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? t('Signing in...') : t('Sign in')}
        </button>
        <p className="auth-switch">{t('No account?')} <Link to="/register">{t('Create one')}</Link></p>
      </form>
    </div>
  )
}

export function Register() {
  const t = useT()
  const { formData, error, loading, sentTo, handleChange, handleSubmit } =
    useAuthForm({ username: '', email: '', password: '' }, '/api/auth/register')

  const checks = PASSWORD_RULES.map(([re, label]) => ({ label, ok: re.test(formData.password) }))
  const strong = checks.every(check => check.ok)

  if (sentTo) return <CheckEmail email={sentTo} />

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1 className="page-title">{t('Create account')}</h1>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="username">{t('Username')}</label>
          <input id="username" name="username" className="form-input" value={formData.username}
            onChange={handleChange} autoComplete="username" required autoFocus
            pattern="[A-Za-z0-9_.]{3,32}" title={t('3-32 characters: letters, numbers, _ or .')} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="email">{t('Email')}</label>
          <input id="email" name="email" type="email" className="form-input" value={formData.email}
            onChange={handleChange} autoComplete="email" required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">{t('Password')}</label>
          <input id="password" name="password" type="password" className="form-input" value={formData.password}
            onChange={handleChange} autoComplete="new-password" required aria-describedby="password-rules" />
          <ul id="password-rules" className="password-rules">
            {checks.map(check => (
              <li key={check.label} className={check.ok ? 'ok' : ''}>
                {check.ok ? '✓' : '✗'} {t(check.label)}
              </li>
            ))}
          </ul>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading || !strong}>
          {loading ? t('Creating account...') : t('Create account')}
        </button>
        <p className="auth-switch">{t('Already have an account?')} <Link to="/login">{t('Sign in')}</Link></p>
      </form>
    </div>
  )
}

export function Verify({ onAuth }) {
  const t = useT()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    // The token works once, so don't let StrictMode's double effect spend it twice
    if (started.current) return
    started.current = true
    post('/api/auth/verify', { token: searchParams.get('token') })
      .then(onAuth)
      .catch(error => setError(t(error.message)))
  }, [])

  return (
    <div className="auth-page">
      <div className="card auth-card">
        {error ? (
          <>
            <h1 className="page-title">{t('Link not valid')}</h1>
            <div className="alert alert-error">{error}</div>
            <Link to="/login" className="btn btn-primary">{t('Back to sign in')}</Link>
          </>
        ) : (
          <div className="loading"><div className="spinner"></div>{t('Signing you in...')}</div>
        )}
      </div>
    </div>
  )
}
