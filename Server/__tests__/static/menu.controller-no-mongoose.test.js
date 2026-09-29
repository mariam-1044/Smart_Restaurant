const fs = require('fs');
const path = require('path');

test('menu controller does not import Dish model directly', () => {
    const filePath = path.join(__dirname, '..', '..', 'src', 'interfaces', 'controllers', 'menu.controller.js');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).not.toMatch(/require.*['"].*models\/Dish['"]/);
    expect(content).not.toMatch(/Dish\./);
});