const sharp = require('sharp');
const path = require('path');

const svgMask = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect x="171" y="171" width="682" height="682" rx="150" ry="150" fill="white" />
</svg>`;

const input = path.join(__dirname, 'assets', 'adaptive-icon.png');
const output = path.join('C:', 'Users', 'Bhavya', '.gemini', 'antigravity-ide', 'brain', 'e84d1d31-1a29-4707-b771-fcf3761afb5a', 'scratch', 'app_icon_preview.png');

sharp(input)
  .composite([
    {
      input: Buffer.from(svgMask),
      blend: 'dest-in'
    }
  ])
  .png()
  .toFile(output)
  .then(() => console.log('Preview generated at ' + output))
  .catch(err => console.error('Error:', err));
