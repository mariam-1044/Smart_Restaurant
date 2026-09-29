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

const root = path.join(__dirname, '..', 'src');
const exclude = ['infrastructure' + path.sep + 'config' + path.sep + 'ai.js'];
const re = /\b(localhost:5002|:5002|:8000)\b/;
const offenders = [];

for (const file of walkJs(root, exclude)) {
    const txt = fs.readFileSync(file, 'utf8');
    txt.split('\n').forEach((line, i) => {
        if (re.test(line)) {
            offenders.push(`${file.replace(/\\/g, '/')}:${i + 1}  ${line.trim()}`);
        }
    });
}

if (offenders.length > 0) {
    console.error(offenders.join('\n'));
    process.exit(1);
}

console.log('No hardcoded ML host literals found outside config.');
process.exit(0);