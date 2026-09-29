const { toCsv } = require('../../src/infrastructure/csv/rfc4180');

function parseCsv(csv) {
    const lines = csv.split(/\r\n/).filter(l => l.length > 0);
    return lines.map(line => {
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    fields.push(current);
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        fields.push(current);
        return fields;
    });
}

describe('RFC 4180 CSV helper', () => {
    const headers = ['name', 'category', 'quantity'];

    test('empty rows produces header-only CSV ending in CRLF', () => {
        const csv = toCsv(headers, []);
        expect(csv).toBe('name,category,quantity\r\n');
    });

    test('field containing a comma is wrapped in quotes', () => {
        const csv = toCsv(headers, [['Tomato, Fresh', 'Produce', 10]]);
        expect(csv).toContain('"Tomato, Fresh"');
    });

    test('field containing a literal double quote escapes it as ""', () => {
        const csv = toCsv(headers, [['Say "Hello"', 'Produce', 5]]);
        expect(csv).toContain('"Say ""Hello"""');
    });

    test('field containing newline is wrapped in quotes', () => {
        const csv = toCsv(headers, [['Line1\nLine2', 'Produce', 3]]);
        expect(csv).toContain('"Line1\nLine2"');
    });

    test('null and undefined become empty string', () => {
        const csv = toCsv(['a', 'b'], [[null, undefined]]);
        const parsed = parseCsv(csv);
        expect(parsed[1]).toEqual(['', '']);
    });

    test('mixed numeric/string rows - numbers not quoted unless needed', () => {
        const csv = toCsv(headers, [['Tomato', 'Produce', 10]]);
        const parsed = parseCsv(csv);
        expect(parsed[1]).toEqual(['Tomato', 'Produce', '10']);
    });

    test('round-trip: parsed CSV equals input rows', () => {
        const rows = [
            ['Apple', 'Fruit', 5],
            ['Banana, Green', 'Fruit', 10],
            ['He said "wow"', 'Fruit', 3],
            ['Multi\nLine', 'Fruit', 1]
        ];
        const csv = toCsv(headers, rows);
        const parsed = parseCsv(csv);
        expect(parsed.slice(1)).toEqual(rows.map(r => [r[0], r[1], String(r[2])]));
    });
});