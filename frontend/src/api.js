import axios from 'axios'

// When frontend is served from the same Express server (production on Render),
// /api calls hit the same origin — no base URL needed.
// In local dev, Vite proxies /api → localhost:5000 via vite.config.js.
const api = axios.create({
  baseURL: '',
  timeout: 60000,
})

export default api
