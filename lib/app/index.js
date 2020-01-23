const config = require('config')
const { buildMonitor, buildRedis, endRedis } = require('lula-common')

const redis = buildRedis(config.redis)
const monitor = buildMonitor({ redis, config }, { name: 'app' })

const app = { monitor, redis, config }

app.end = async () => {
  await endRedis(app.redis)
}

app.abort = async ({ err, source }) => {
  app.monitor.fatal(`exit:${source}`, { err })
  await app.end()
  if (!process.env.TEST_EXIT) {
    process.exit(1)
  }
}

app.install = async () => {
  process.on('unhandledRejection', err => {
    app.abort({ err, source: 'unhandledRejection' })
  })
  process.on('uncaughtException', err => {
    console.error(err)
    app.abort({ err, source: 'uncaughtException' })
  })
}

app.process = async request => {
  app.monitor.debug('process', { request })
}

app.pop = () => redis.brpop(`${config.inKeyPrefix}:q`, config.popTimeout)

app.start = async () => {
  monitor.assert.type('start', config, {
    inKeyPrefix: 'string',
    popTimeout: 'number',
  })
}

app.run = async ({}) => {
  await app.install()
  while (true) {
    const popRes = await app.pop()
    if (popRes) {
      app.process(popRes)
    }
  }
}

module.exports = app
