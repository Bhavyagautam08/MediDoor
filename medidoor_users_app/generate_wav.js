const fs = require('fs');
const sampleRate = 44100;
const duration = 10;
const numSamples = sampleRate * duration;
const buffer = Buffer.alloc(44 + numSamples * 2);

// WAV Header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + numSamples * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // Subchunk1Size
buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
buffer.writeUInt16LE(1, 22); // NumChannels
buffer.writeUInt32LE(sampleRate, 24); // SampleRate
buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
buffer.writeUInt16LE(2, 32); // BlockAlign
buffer.writeUInt16LE(16, 34); // BitsPerSample
buffer.write('data', 36);
buffer.writeUInt32LE(numSamples * 2, 40);

// Data
for (let i = 0; i < numSamples; i++) {
  // Beep sound: combination of 440 Hz and 880 Hz with pulsing (on/off every 0.5s)
  const time = i / sampleRate;
  const isPulsing = Math.floor(time * 2) % 2 === 0;
  let sample = 0;
  if (isPulsing) {
    sample = Math.sin(2 * Math.PI * 880 * time) * 10000;
  }
  buffer.writeInt16LE(sample, 44 + i * 2);
}

fs.writeFileSync('assets/alert.wav', buffer);
console.log('alert.wav generated');
