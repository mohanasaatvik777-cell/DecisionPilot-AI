require('dotenv').config()
const https = require('https')

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const MODEL = 'gpt-4o'

function isAvailable() {
  return !!OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-')
}

/**
 * Call OpenAI Chat Completions API.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {Array}  history  — [{role, content}]
 * @returns {Promise<string>}
 */
async function askOpenAI(systemPrompt, userMessage, history = []) {
  if (!isAvailable()) throw new Error('OPENAI_API_KEY not set')

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map(m => ({ role: m.role, content: m.content.slice(0, 400) })),
    { role: 'user', content: userMessage }
  ]

  const body = JSON.stringify({
    model: MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 1200,
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.error) return reject(new Error(json.error.message))
          resolve(json.choices?.[0]?.message?.content?.trim() || '')
        } catch(e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

if (isAvailable()) {
  console.log('✅ OpenAI connected (gpt-4o)')
} else {
  console.warn('⚠️  No OPENAI_API_KEY set — chatbot will use local engine')
}

module.exports = { askOpenAI, isAvailable }
