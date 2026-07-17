/**
 * routes/decision.js  —  POST /api/decision
 */
'use strict'
const express = require('express')
const router  = express.Router()
const { handleDecision } = require('../controllers/decisionController')

router.post('/', handleDecision)

module.exports = router
