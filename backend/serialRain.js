import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import axios from 'axios';

const COM_PORT = process.env.ESP32_SERIAL_PORT || 'COM3';
const API_KEY = process.env.ESP32_API_KEY || 'PUT_HIVE01_API_KEY_HERE';
const INGEST_URL = process.env.ESP32_INGEST_URL || 'http://localhost:3001/api/sensors';

const port = new SerialPort({ path: COM_PORT, baudRate: 115200, autoOpen: false });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

port.on('error', (err) => {
  console.error(`Serial error on ${COM_PORT}:`, err.message);
});

parser.on('data', async (line) => {
  const txt = line.trim();
  if (!txt) return;

  console.log('ESP32:', txt);

  if (!txt.startsWith('{')) {
    console.log('Skipped (not JSON)');
    return;
  }

  try {
    const data = JSON.parse(txt);
    const res = await axios.post(INGEST_URL, data, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });
    console.log('POST OK:', res.status);
  } catch (err) {
    if (err.response) {
      console.log('Server error:', err.response.status, err.response.data);
    } else {
      console.log('Parse/Network error:', err.message);
    }
  }
});

port.open((err) => {
  if (err) {
    console.error(`Could not open ${COM_PORT}:`, err.message);
    return;
  }
  console.log(`Listening ESP32 on ${COM_PORT}...`);
});
