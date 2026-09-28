// Entrada da API na Vercel: a função serverless usa o backend já compilado (backend/dist).
module.exports = require('../backend/dist/serverless.js').default;
