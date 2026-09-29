const crypto = require('crypto');

function anonymizedHandleFor(customerId) {
    const salt = process.env.HANDLE_SALT || 'dev-salt';
    const hex = crypto
        .createHmac('sha256', salt)
        .update(String(customerId))
        .digest('hex')
        .slice(0, 4);
    return 'Diner #' + hex;
}

module.exports = { anonymizedHandleFor };
