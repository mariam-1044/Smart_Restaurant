const nock = require('nock');

function withMlServiceStub({
  route = '/predict-sales',
  method = 'POST',
  status = 200,
  response = { forecast: [{ date: '2026-05-04', predicted_quantity: 10 }] }
} = {}) {
  const url = process.env.ML_SERVICE_URL;
  if (!url) throw new Error('ML_SERVICE_URL not set');
  const scope = nock(url)[method.toLowerCase()](route).reply(status, response);
  return scope;
}

module.exports = { withMlServiceStub };