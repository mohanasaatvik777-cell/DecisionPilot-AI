/**
 * Gemini AI Utility — Grounded Generation Only
 *
 * Architecture:
 *   1. Backend computes ALL numbers from raw data (zero hallucination risk)
 *   2. Gemini receives ONLY pre-verified structured data
 *   3. Gemini ONLY formats/explains — never calculates
 *   4. temperature=0.1 for maximum factual accuracy
 */
require('dotenv').config()
const { GoogleGenerativeAI } = require('@google/generative-ai')

let genAI = null
let model = null

// Quota tracking — prevent hammering when limit hit
let quotaExhausted  = false
let quotaResetAt    = 0

function init() {
  const key = process.env.GEMINI_API_KEY
  if (key && key !== 'your_gemini_api_key_here' && key.startsWith('AIza')) {
    try {
      genAI = new GoogleGenerativeAI(key)
      model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        // Step 7: Optimised for factual accuracy, not creativity
        generationConfig: {
          temperature:     0.1,   // Very low — prioritise accuracy
          topP:            0.8,
          topK:            20,
          maxOutputTokens: 2048,
        },
      })
      console.log('✅ Gemini AI connected (gemini-2.5-flash, temp=0.1)')
    } catch(e) {
      console.warn('⚠️  Gemini init error:', e.message)
    }
  } else {
    console.warn('⚠️  No valid GEMINI_API_KEY — chatbot will use local engine only')
  }
}

init()

function canUseGemini() {
  if (!model) return false
  if (!quotaExhausted) return true
  if (Date.now() > quotaResetAt) { quotaExhausted = false; return true }
  return false
}

function markQuotaHit(retryMs = 65000) {
  quotaExhausted = true
  quotaResetAt   = Date.now() + retryMs
}

/**
 * GROUNDED generation — Gemini explains pre-computed verified data.
 * systemPrompt contains the verified facts.
 * userMessage is the original user question.
 */
async function askGemini(systemPrompt, userMessage) {
  if (!canUseGemini()) return null
  try {
    const fullPrompt = `${systemPrompt}\n\nUser question: ${userMessage}`
    const result = await model.generateContent(fullPrompt)
    const text   = result.response.text()
    if (!text?.trim()) return null
    return text.trim()
  } catch(e) {
    const msg = e.message || ''
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many')) {
      const retryMatch = msg.match(/(\d+)s/); 
      markQuotaHit(retryMatch ? (parseInt(retryMatch[1])+5)*1000 : 65000)
      console.warn(`[GEMINI] Quota hit — pausing ${Math.round((quotaResetAt-Date.now())/1000)}s`)
    } else {
      console.warn('[GEMINI] Error:', msg.slice(0, 100))
    }
    return null
  }
}

module.exports = { askGemini, isAvailable: canUseGemini, markQuotaHit }
