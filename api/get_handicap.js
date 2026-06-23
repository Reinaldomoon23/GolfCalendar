import pdfParse from 'pdf-parse';

function extractCurrentHandicap(text) {
  const regex = /NUEVO\s+H[AÁ]NDICAP\s*:\s*([+-]?\d+(?:\.\d+)?)/i;
  const match = text.match(regex);
  return match?.[1] || null;
}

function extractTournamentName(rawBetween) {
  const normalized = String(rawBetween || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const match = normalized.match(/^(.*?)\s+\d+\s+/u);
  if (match?.[1]) {
    return match[1].trim();
  }

  return normalized.substring(0, 60).trim();
}

function extractHistoryFromPdfText(text) {
  const headerMarker = 'Vc/Vs/PAR';
  const endCandidates = [
    '2.  Para cada resultado',
    '2. Para cada resultado',
    '2.  Para cada',
    '2. Para cada',
  ];

  let searchText = text;
  const headerPos = text.indexOf(headerMarker);
  let startPos = headerPos;

  if (headerPos !== -1) {
    const nextNewline = text.indexOf('\n', headerPos);
    if (nextNewline !== -1) {
      startPos = nextNewline + 1;
    }
  }

  let endPos = -1;
  for (const marker of endCandidates) {
    const candidatePos = text.indexOf(marker);
    if (candidatePos !== -1) {
      endPos = candidatePos;
      break;
    }
  }

  if (startPos !== -1 && endPos !== -1 && endPos > startPos) {
    searchText = text.slice(startPos, endPos);
  } else if (endPos !== -1) {
    searchText = text.slice(0, endPos);
  }

  const rowPattern = /(\d{2}\/\d{2}\/\d{4})(.*?)(\d+\.\d+)\/(\d+)\/(\d+)\s+([+-]?\d+\.\d+)/gsu;
  const history = [];

  for (const match of searchText.matchAll(rowPattern)) {
    const rawDate = match[1];
    const between = match[2];
    const handicapValue = Number.parseFloat(match[6]);

    if (!rawDate || Number.isNaN(handicapValue)) {
      continue;
    }

    const [day, month, year] = rawDate.split('/');
    const isoDate = `${year}-${month}-${day}`;

    history.push({
      date: isoDate,
      handicap: handicapValue,
      source: 'rfeg_pdf',
      tournament: extractTournamentName(between),
    });
  }

  history.sort((a, b) => a.date.localeCompare(b.date));
  return history;
}

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { username, license } = req.query;

  let pdfUrl = '';

  if (license && typeof license === 'string') {
    const matches = license.match(/(\d+)$/);
    if (matches && matches[1]) {
      const shortId = matches[1].slice(-6); // Last 6 digits
      pdfUrl = `https://api.rfeg.es/files/summaryhandicap/${shortId}.pdf`;
    }
  }

  // Without fallback JSON right now. If no license, fail gracefully.
  if (!pdfUrl) {
    return res.status(200).json({ handicap: null, pdf_url: null, error: 'No license found for user' });
  }

  try {
    const pdfBuffer = await fetchPdf(pdfUrl);
    
    if (!pdfBuffer) {
      return res.status(500).json({ error: 'Failed to fetch PDF.' });
    }

    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    const newHandicap = extractCurrentHandicap(text);

    let history = [];
    try {
      history = extractHistoryFromPdfText(text);
    } catch (parseError) {
      console.error('Error parsing history:', parseError);
    }

    if (newHandicap) {
      return res.status(200).json({
        handicap: newHandicap,
        pdf_url: pdfUrl,
        history: history
      });
    } else {
      return res.status(404).json({ error: 'Handicap not found in PDF' });
    }

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function fetchPdf(url) {
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/pdf,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.rfegolf.es/',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  };

  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, options);

      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        return fetchPdf(res.headers.get('location'));
      }

      if (res.status !== 200) {
        const text = await res.text();
        lastError = new Error(`HTTP Code: ${res.status} | Text: ${text}`);
      } else {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const isPdf = buffer.length > 1000 && buffer.subarray(0, 4).toString() === '%PDF';

        if (isPdf) return buffer;

        lastError = new Error(`Invalid PDF response: ${buffer.subarray(0, 80).toString('utf8')}`);
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < 5) {
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }

  throw lastError || new Error('Failed to fetch PDF.');
}
