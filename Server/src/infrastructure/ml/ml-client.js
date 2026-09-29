const axios = require('axios');
const { baseUrl, timeoutMs } = require('../config/ai');

const mlClient = axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs
});

mlClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
            return Promise.reject({
                code: 'inference_validation',
                status: error.response.status,
                data: error.response.data,
                cause: error
            });
        }
        return Promise.reject({
            code: 'inference_unavailable',
            cause: error
        });
    }
);

module.exports = mlClient;
