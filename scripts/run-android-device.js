#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    console.error(`Failed to run ${command}:`, result.error.message);
    process.exit(1);
  }

  return result.status;
}

function findAdb() {
  const preferred = process.env.ADB;
  if (preferred) {
    return preferred;
  }

  return 'adb';
}

function getConnectedAndroidDevice(adb) {
  const result = spawnSync(adb, ['devices'], {
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    console.error(`Unable to run adb: ${result.error.message}`);
    process.exit(1);
  }

  const stdout = result.stdout || '';
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('List of devices attached'));

  const devices = lines
    .map((line) => line.split(/\s+/))
    .filter(([id, status]) => status === 'device' && id && !id.startsWith('emulator-'))
    .map(([id]) => id);

  if (devices.length === 0) {
    return null;
  }

  if (devices.length > 1) {
    const specified = process.env.EXPO_DEVICE_ID;
    if (specified) {
      if (devices.includes(specified)) {
        return specified;
      }
      console.warn(`EXPO_DEVICE_ID=${specified} is set but not connected. Using first available device instead.`);
    }
    console.log(`Found multiple connected devices: ${devices.join(', ')}. Using the first one: ${devices[0]}`);
  }

  return devices[0];
}

function main() {
  const adb = findAdb();
  const deviceId = getConnectedAndroidDevice(adb);

  if (!deviceId) {
    console.error('No USB-connected Android device found.');
    console.error('Make sure USB debugging is enabled and the device appears in `adb devices`.');
    process.exit(1);
  }

  const expoCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['expo', 'run:android', '--device', deviceId, '--variant', 'debug'];

  console.log(`Running Android debug build on device ${deviceId}...`);
  const status = runCommand(expoCommand, args, { cwd: process.cwd() });
  process.exit(status === null ? 1 : status);
}

main();
