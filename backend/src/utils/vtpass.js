const axios = require('axios');

// VTpass identifiers for each network's data service (sandbox/live use the same codes)
const SERVICE_IDS = {
  mtn: 'mtn-data',
  airtel: 'airtel-data',
  glo: 'glo-data',
  '9mobile': 'etisalat-data',
};

const vtpassApi = axios.create({
  baseURL: process.env.VTPASS_BASE_URL,
  headers: {
    'api-key': process.env.VTPASS_PUBLIC_KEY,
    'secret-key': process.env.VTPASS_SECRET_KEY,
    'Content-Type': 'application/json',
  },
});

// Fetch the list of data plans (variation codes + prices) VTpass offers for a network
async function getDataVariations(network) {
  const serviceID = SERVICE_IDS[network];
  if (!serviceID) throw new Error('Network da ba a sani ba');
  const res = await vtpassApi.get('/service-variations', { params: { serviceID } });
  return res.data;
}

// Purchase data bundle
async function purchaseData({ network, phone, variation_code, amount, request_id }) {
  const serviceID = SERVICE_IDS[network];
  if (!serviceID) throw new Error('Network da ba a sani ba');

  const res = await vtpassApi.post('/pay', {
    request_id, // must be unique per VTpass rules (usually date-prefixed)
    serviceID,
    billersCode: phone,
    variation_code,
    phone,
    amount,
  });
  return res.data;
}

// Requery a transaction status from VTpass (useful if the first call times out)
async function requeryTransaction(request_id) {
  const res = await vtpassApi.post('/requery', { request_id });
  return res.data;
}

module.exports = { getDataVariations, purchaseData, requeryTransaction, SERVICE_IDS };
