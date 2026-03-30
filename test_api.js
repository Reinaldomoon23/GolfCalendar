import handler from './api/get_handicap.js';

const req = {
  method: 'GET',
  query: { username: 'nicole', license: 'CB65996143' }
};

const res = {
  setHeader: console.log,
  status: (code) => {
    console.log('Status:', code);
    return {
      json: (data) => console.log('JSON:', data),
      end: () => console.log('END')
    };
  }
};

handler(req, res).then(() => console.log('Done')).catch(console.error);
