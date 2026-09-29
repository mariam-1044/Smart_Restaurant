function escapeField(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\r') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function toCsv(headers, rows) {
    const headerLine = headers.map(escapeField).join(',');
    const dataLines = rows.map(row => row.map(escapeField).join(','));
    return [headerLine, ...dataLines].join('\r\n') + '\r\n';
}

module.exports = { toCsv };