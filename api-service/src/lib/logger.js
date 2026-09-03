function info(message, meta) {
  console.log(JSON.stringify({ level: 'info', message, ...meta, time: new Date().toISOString() }));
}

function warn(message, meta) {
  console.warn(JSON.stringify({ level: 'warn', message, ...meta, time: new Date().toISOString() }));
}

function error(message, meta) {
  console.error(JSON.stringify({ level: 'error', message, ...meta, time: new Date().toISOString() }));
}

module.exports = { info: info, warn: warn, error: error };
