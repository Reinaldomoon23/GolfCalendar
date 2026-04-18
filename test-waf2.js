
const url = "https://api.rfeg.es/files/summaryhandicap/996143.pdf";
const options = {
    headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/pdf',
    'Referer': 'https://www.rfegolf.es/'
    }
};

fetch(url, options).then(res => console.log("Status:", res.status));

