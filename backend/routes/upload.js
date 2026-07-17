const express = require('express');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const http    = require('http');
const router  = express.Router();

const { parseFile }    = require('../utils/dataParser');
const { detectSchema, inferIndustry } = require('../utils/schemaDetector');
const Dataset = require('../models/Dataset');

const ALLOWED_TYPES = ['text/csv','application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (!['csv','xlsx','xls'].includes(ext)) {
      return cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
    cb(null, true);
  },
});

// ── Forward file to Python AI agent ──────────────────────────────────────────
function forwardToAgent(buffer, filename) {
  return new Promise((resolve) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const CRLF = '\r\n'
    const header = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
      `Content-Type: application/octet-stream${CRLF}${CRLF}`
    )
    const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
    const body   = Buffer.concat([header, buffer, footer])

    const options = {
      hostname: 'localhost', port: 7000, path: '/agent/upload',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.write(body)
    req.end()
  })
}

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    // Validate not empty
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Uploaded file is empty.' });
    }

    // Parse
    const { rows, skippedRows, warnings } = parseFile(buffer, originalname, mimetype);

    // Detect schema
    const schema = detectSchema(rows);
    const industry = inferIndustry(schema, rows);

    // Generate session ID
    const sessionId = uuidv4();

    // Build preview (first 10 rows)
    const preview = rows.slice(0, 10);

    // Save to DB (best-effort)
    let datasetId = null;
    try {
      const dataset = await Dataset.create({
        sessionId,
        fileName: originalname,
        fileSize: size,
        rowCount: rows.length,
        columnCount: schema.length,
        schema,
        industry,
        skippedRows,
      });
      datasetId = dataset._id;
    } catch (dbErr) {
      console.warn('DB save skipped:', dbErr.message);
    }

    // Store rows in memory cache for this session (simple in-process cache for MVP)
    global.sessionCache = global.sessionCache || {};
    global.sessionCache[sessionId] = { rows, schema, industry, fileName: originalname };

    // ── Forward file to Python AI agent (async, non-blocking) ────────────
    let agentSessionId = null;
    try {
      const agentResult = await forwardToAgent(buffer, originalname);
      if (agentResult?.session_id) {
        agentSessionId = agentResult.session_id;
        global.sessionCache[sessionId].agentSessionId = agentSessionId;
        console.log(`✅ Agent session created: ${agentSessionId}`);
      }
    } catch (agentErr) {
      console.warn('⚠️  AI agent not available:', agentErr.message);
    }

    res.json({
      sessionId,
      datasetId,
      agentSessionId,          // ← frontend uses this for chatbot
      fileName: originalname,
      rowCount: rows.length,
      columnCount: schema.length,
      schema,
      industry,
      preview,
      skippedRows,
      warnings,
    });

  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    next(err);
  }
});

module.exports = router;
