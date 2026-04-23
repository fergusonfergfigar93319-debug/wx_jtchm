const fs = require('fs');
const path = require('path');
const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const buf = Buffer.from(base64, 'base64');
const names = ['home', 'home-active', 'fridge', 'fridge-active', 'report', 'report-active', 'profile', 'profile-active'];
const dir = path.join(__dirname, '..', 'images');
names.forEach(n => fs.writeFileSync(path.join(dir, n + '.png'), buf));
console.log('Created', names.length, 'placeholder icons in images/');
