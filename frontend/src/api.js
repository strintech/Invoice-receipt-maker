// In production the API is on another origin (VITE_API_URL), so /api calls are sent there with a
// bearer token instead of a cookie (Safari blocks cross-site cookies). Every fetch('/api/...') goes through this.
const API_URL = import.meta.env.VITE_API_URL || ''

let token = null
try {
  token = localStorage.getItem('token')
} catch {
  // storage blocked: the session lasts for this visit only
}

export const setToken = (value) => {
  token = value
  try {
    if (value) localStorage.setItem('token', value)
    else localStorage.removeItem('token')
  } catch {
    // storage blocked: token stays in memory
  }
}

const nativeFetch = window.fetch.bind(window)
window.fetch = (url, opts = {}) => {
  if (typeof url !== 'string' || !url.startsWith('/api')) return nativeFetch(url, opts)
  const headers = { ...opts.headers, ...(token && { Authorization: `Bearer ${token}` }) }
  return nativeFetch(API_URL + url, { ...opts, headers })
}
