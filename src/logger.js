const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'chat.log');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

function logInteraction(data) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), ...data }) + '\n';
  fs.appendFile(LOG_FILE, entry, err => {
    if (err) console.error('Logger error:', err.message);
  });
}

module.exports = { logInteraction };
