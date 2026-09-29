const fs = require('fs');
const path = require('path');

function* walkJs(dir, exclude) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (exclude.some(e => full.endsWith(e))) continue;
        if (entry.isDirectory()) yield* walkJs(full, exclude);
        else if (entry.name.endsWith('.js')) yield full;
    }
}

test('no hardcoded ML host literals outside config', () => {
    const root = path.join(__dirname, '..', '..', 'src');
    const exclude = [path.join('infrastructure', 'config', 'ai.js')];
    const re = /\b(localhost:5002|:5002|:8000)\b/;
    const offenders = [];
    for (const file of walkJs(root, exclude)) {
        const txt = fs.readFileSync(file, 'utf8');
        txt.split('\n').forEach((line, i) => {
            if (re.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
});