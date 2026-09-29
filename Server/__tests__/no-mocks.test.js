// Constitution Principle III + spec SC-001 enforcement.
// Scans every service file under Server/src/application/services/ for
// fingerprints of mock/random/stub data and fails if any match.

const fs = require('fs');
const path = require('path');

const SERVICES_DIR = path.resolve(__dirname, '..', 'src', 'application', 'services');
const FORBIDDEN = /\bMath\.random\b|\bfakeData\b|\bFAKE_\b|\bHARDCODED_\b/i;

function listJsFiles(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            out.push(...listJsFiles(path.join(dir, entry.name)));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
}

const TARGETS = [
    'ai.service.js',
    'recommendation.service.js',
    'pricing.service.js',
    'endorsement.service.js'
];

describe('AI services contain no mock / random data (Constitution III)', () => {
    test('every AI service file is free of forbidden mock fingerprints', () => {
        const files = listJsFiles(SERVICES_DIR).filter((p) =>
            TARGETS.includes(path.basename(p))
        );
        const violations = [];
        for (const file of files) {
            const src = fs.readFileSync(file, 'utf8');
            const m = src.match(FORBIDDEN);
            if (m) {
                violations.push({ file, hit: m[0] });
            }
        }
        if (violations.length > 0) {
            const lines = violations.map((v) => `  ${v.file} → ${v.hit}`).join('\n');
            throw new Error('Mock fingerprints found in AI services:\n' + lines);
        }
    });
});
