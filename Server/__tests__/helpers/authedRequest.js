const request = require('supertest');
const { mintToken } = require('./mintToken');

function authedRequest(app, user) {
  const token = mintToken(user);
  const agent = request.agent(app);
  agent.set('Authorization', `Bearer ${token}`);
  return agent;
}

module.exports = { authedRequest };