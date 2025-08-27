#!/usr/bin/env node

import http from 'http';
import config from './config';

const options = {
  hostname: 'localhost',
  port: config.server.port,
  path: '/api/health',
  method: 'GET',
  timeout: 5000,
};

const request = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

request.on('timeout', () => {
  console.error('Health check timeout');
  request.destroy();
  process.exit(1);
});

request.end();