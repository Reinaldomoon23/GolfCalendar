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
    let newHandicap = null;
    if (match && match[1]) {
      newHandicap = match[1];
    }

    // Extract history
    const history = [];
    try {
      const startIdx = text.indexOf('Vc/Vs/PAR');
      let endIdx = text.indexOf('2.  Para cada');
      if (endIdx === -1) endIdx = text.indexOf('2. Para cada');
      
      let searchBlock = text;
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        searchBlock = text.slice(startIdx, endIdx);
      } else if (endIdx !== -1) {
        searchBlock = text.slice(0, endIdx);
      }

      // Split by date
      const rows = searchBlock.split(/(?=\d{2}\/\d{2}\/\d{4})/);
      
      for (const row of rows) {
        const dateMatch = row.match(/^(\d{2}\/\d{2}\/\d{4})/);
        if (!dateMatch) continue;
        
        const rawDate = dateMatch[1];
        const parts = rawDate.split('/');
        const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        
        // Extract all decimals from the row
        const decimals = row.match(/[+-]?\d{1,2}\.\d/g);
        if (!decimals || decimals.length === 0) continue;
        
        // The last decimal on the row is always the new handicap
        const smhHcp = parseFloat(decimals[decimals.length - 1]);
        
        let tournName = row.substring(10).replace(/\s+/g, ' ').trim();
        // Remove the Vc/Vs/Par and everything after it to clean the name
        const vcIndex = tournName.search(/\d+(?:\.\d+)?\/\d+(?:\.\d+)?\/\d{2,3}/);
        if (vcIndex !== -1) {
          tournName = tournName.substring(0, vcIndex).trim();
        } else {
          // Fallback if Vc/Vs/Par is missing
          const nmMatch = tournName.match(/^(.*?)\s+\d+\s+/);
          if (nmMatch && nmMatch[1]) tournName = nmMatch[1].trim();
          else tournName = tournName.substring(0, 60);
        }

        history.push({
          date: isoDate,
          handicap: smhHcp,
          source: 'rfeg_pdf',
          tournament: tournName
        });
      }
      
      // Sort oldest to newest
      history.sort((a, b) => a.date.localeCompare(b.date));
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
      'Referer': 'https://www.rfegolf.es/'
    }
  };

  const res = await fetch(url, options);

  if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
    return fetchPdf(res.headers.get('location'));
  }
  
  if (res.status !== 200) {
    throw new Error(`HTTP Code: ${res.status} | Text: ${await res.text()}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
