/**
 * Intelligent schema detection — classifies columns into:
 * date, numeric, categorical, identifier, text
 */

const DATE_KEYWORDS = ['date','time','day','month','year','week','period','timestamp','created','updated','at'];
const ID_KEYWORDS   = ['id','uuid','sku','code','key','ref','number','num','no','#'];
const NUM_KEYWORDS  = ['sales','revenue','amount','price','cost','qty','quantity','count','total',
                       'profit','loss','value','rate','score','age','salary','income','spend',
                       'stock','level','temperature','weight','height','distance','units'];
const CAT_KEYWORDS  = ['name','type','category','region','city','country','state','department',
                       'product','status','gender','industry','segment','channel','source','brand'];

function looksLikeDate(value) {
  if (!value || typeof value !== 'string') return false;
  const s = value.trim();
  // ISO, common date formats
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(s)) return true;
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(s)) return true;
  if (!isNaN(Date.parse(s)) && s.length > 4) return true;
  return false;
}

function looksLikeNumeric(value) {
  if (value === null || value === undefined || value === '') return false;
  const s = String(value).trim().replace(/[$,%]/g, '');
  return !isNaN(parseFloat(s)) && isFinite(s);
}

function columnNameScore(name, keywords) {
  const lower = name.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function detectColumnType(colName, samples) {
  const validSamples = samples.filter(v => v !== null && v !== undefined && v !== '');
  if (validSamples.length === 0) return 'text';

  const lowerName = colName.toLowerCase();

  // Check ID keywords first — exclude from analysis
  if (columnNameScore(colName, ID_KEYWORDS) && validSamples.length > 0) {
    const uniqueRatio = new Set(validSamples.map(String)).size / validSamples.length;
    if (uniqueRatio > 0.9) return 'identifier';
  }

  // Date check
  if (columnNameScore(colName, DATE_KEYWORDS)) {
    const dateSamples = validSamples.slice(0, 10);
    const dateCount = dateSamples.filter(looksLikeDate).length;
    if (dateCount >= dateSamples.length * 0.6) return 'date';
  }
  const dateSamples = validSamples.slice(0, 20);
  const dateCount = dateSamples.filter(looksLikeDate).length;
  if (dateCount >= dateSamples.length * 0.8) return 'date';

  // Numeric check
  const numSamples = validSamples.slice(0, 20);
  const numCount = numSamples.filter(looksLikeNumeric).length;
  if (numCount >= numSamples.length * 0.8) {
    // High cardinality numeric that might be IDs
    const uniqueRatio = new Set(validSamples.map(String)).size / validSamples.length;
    if (uniqueRatio > 0.95 && validSamples.length > 20 && columnNameScore(colName, ID_KEYWORDS)) {
      return 'identifier';
    }
    return 'numeric';
  }

  // Categorical: low cardinality relative to total
  const uniqueCount = new Set(validSamples.map(String)).size;
  const uniqueRatio = uniqueCount / validSamples.length;
  if (uniqueRatio < 0.5 || uniqueCount <= 50) return 'categorical';

  // Long text
  const avgLen = validSamples.reduce((s, v) => s + String(v).length, 0) / validSamples.length;
  if (avgLen > 40) return 'text';

  return 'categorical';
}

function deduplicateColumnNames(names) {
  const seen = {};
  return names.map(name => {
    const key = name.toLowerCase();
    if (seen[key] === undefined) {
      seen[key] = 0;
      return name;
    } else {
      seen[key]++;
      return `${name}_${seen[key] + 1}`;
    }
  });
}

function detectSchema(rows) {
  if (!rows || rows.length === 0) return [];

  const rawHeaders = Object.keys(rows[0]);
  const headers = deduplicateColumnNames(rawHeaders);

  return headers.map((colName, idx) => {
    const originalName = rawHeaders[idx];
    const samples = rows.slice(0, 100).map(row => row[originalName]);
    const validSamples = samples.filter(v => v !== null && v !== undefined && v !== '');
    const nullCount = samples.length - validSamples.length;
    const uniqueVals = [...new Set(validSamples.map(String))];

    const type = detectColumnType(colName, validSamples);

    return {
      name: colName,
      originalName,
      type,
      userConfirmed: false,
      nullCount,
      uniqueCount: uniqueVals.length,
      sampleValues: uniqueVals.slice(0, 5),
    };
  });
}

function inferIndustry(schema, rows) {
  const colNames   = schema.map(c => c.name.toLowerCase()).join(' ')
  const sampleText = rows.slice(0, 30).map(r => Object.values(r).join(' ')).join(' ').toLowerCase()
  // Triple-weight column names — they are the most reliable signal
  const fullText   = `${colNames} ${colNames} ${colNames} ${sampleText}`

  const RULES = {
    retail:        { strong:['sku','barcode','upc','checkout','cart','refund','coupon','retail','ecommerce','merchandis'], medium:['product','inventory','stock','order','customer','purchase','store','supplier','vendor','category','discount','brand','quantity'], weak:['price','sale','item'] },
    restaurant:    { strong:['menu','dish','waiter','reservation','kitchen','chef','recipe','dine','restaurant','covers','buffet','cuisine'], medium:['food','beverage','drink','table','tip','bill','meal','ingredient','breakfast','lunch','dinner'], weak:['order','staff'] },
    healthcare:    { strong:['patient','diagnosis','icd','medication','prescription','ward','icu','surgery','clinical','discharge','admission','bmi','symptom'], medium:['doctor','hospital','nurse','treatment','disease','condition','appointment','bed','lab','visit','health'], weak:['age','gender'] },
    manufacturing: { strong:['defect','downtime','assembly','yield','factory','plant','manufacturing','operator','batch','sensor','cnc','weld'], medium:['machine','production','shift','efficiency','quality','maintenance','output','process','equipment','line'], weak:['cost','quantity'] },
    education:     { strong:['student','enrollment','gpa','curriculum','syllabus','semester','attendance','homework','quiz','lecture','faculty'], medium:['grade','class','teacher','course','score','mark','subject','exam','assignment','school','college'], weak:['test','year'] },
    marketing:     { strong:['campaign','ctr','roas','impression','conversion','funnel','cpc','cpa','seo','ppc','retargeting'], medium:['click','lead','ad','spend','channel','email','social','instagram','facebook','google','traffic','roi','audience'], weak:['platform','date'] },
    finance:       { strong:['debit','credit','liability','equity','dividend','asset','ledger','invoice','payroll','amortization','depreciation','ebitda'], medium:['profit','expense','cash','income','balance','budget','investment','tax','account','transaction','loan','interest'], weak:['total','amount'] },
    logistics:     { strong:['shipment','freight','carrier','dispatch','fleet','container','eta','consignment','tracking','waybill','customs'], medium:['delivery','warehouse','route','driver','package','origin','destination','transit','logistics','supply','chain','weight'], weak:['status','location'] },
  }

  const scores = {}
  for (const [industry, rules] of Object.entries(RULES)) {
    let s = 0
    s += rules.strong.filter(kw => fullText.includes(kw)).length * 4
    s += rules.medium.filter(kw => fullText.includes(kw)).length * 2
    const strongHits = rules.strong.filter(kw => fullText.includes(kw)).length
    if (s > 0) s += rules.weak.filter(kw => colNames.includes(kw)).length * 1
    scores[industry] = s
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const bestScore   = ranked[0][1]
  const secondScore = ranked[1]?.[1] || 0

  // Require strong confidence — prevents false positives on generic datasets
  if (bestScore >= 6 && (bestScore - secondScore) >= 3) return ranked[0][0]
  if (bestScore >= 4 && (bestScore - secondScore) >= 4) return ranked[0][0]
  return 'general'
}

module.exports = { detectSchema, inferIndustry, looksLikeDate, looksLikeNumeric, deduplicateColumnNames };
