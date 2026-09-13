const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, 'assets', 'logo.png');
const outputPath = path.join(__dirname, 'assets', 'adaptive-icon.png');

async function resizeIcon() {
  try {
    // Resize to 900x900 per user request
    const resizedLogo = await sharp(inputPath)
      .resize(900, 900, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    // Composite it onto a 1024x1024 transparent canvas
    await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toFile(outputPath);

    console.log('Successfully generated middle-ground adaptive-icon.png');
  } catch (error) {
    console.error('Error generating icon:', error);
  }
}

resizeIcon();
