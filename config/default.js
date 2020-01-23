module.exports = {
  inKeyPrefix: 'in',
  logger: {
    level: 'info',
  },
  redis: {
    keyPrefix: 'lula-fetch:',
    url: 'redis://127.0.0.1:6379',
  },
  requestTimeout: 8000,
  popTimeout: 8000,
}
