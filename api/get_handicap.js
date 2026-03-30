import https from 'https';
import pdfParse from 'pdf-parse';

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
      pdfUrl = `https://api.rfeg.es/files/summaryhandicap/${parseInt(shortId, 10)}.pdf`;
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

    // Search for "NUEVO HÁNDICAP : X.X"
    const regex = /NUEVO\s+H[AÁ]NDICAP\s*:\s*([\d\.]+)/i;
    const match = text.match(regex);

    if (match && match[1]) {
      return res.status(200).json({
        handicap: match[1],
        pdf_url: pdfUrl
      });
    } else {
      return res.status(404).json({ error: 'Handicap not found in PDF' });
    }

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Helper to fetch using basic https without fetching all tracking/cookies.
function fetchPdf(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.rfegolf.es/'
      }
    };

    https.get(url, options, (res) => {
      // Handle redirects if any
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPdf(res.headers.location).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP Code: ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', err => reject(err));
  });
}
