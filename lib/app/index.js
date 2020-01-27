const DigestFetch = require('digest-fetch')
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

const digestMd5 = async req => {
  app.monitor.assert.type('digestMd5', req, {
    username: 'string',
    password: 'string',
    url: 'string',
    options: 'object',
  })
  const digestClient = new DigestFetch(req.username, req.password)
  const response = await digestClient.fetch(req.url, req.options)
  if (response.status === 200) {
    const contentLength = response.headers.get('content-length')
    const content = await response.text()
    if (contentLength && content.length !== parseInt(contentLength)) {
      return { status: 500, message: 'Partial content' }
    } else {
      return { status: 200, content }
    }
  } else {
    return { status: response.status }
  }
}

app.process = async req => {
  app.monitor.assert.type('process', req, {
    id: 'string',
    type: 'string',
    payload: 'object',
  })
  if (req.type === 'digest-md5') {
    const res = await digestMd5(req.payload)
    const resKey = `res:${req.id}:q`
    await app.redis
      .multi([
        ['del', resKey],
        ['lpush', resKey, JSON.stringify(res)],
        ['expire', resKey, app.config.resExpireSeconds],
      ])
      .exec()
  }
}

app.pop = () => redis.brpop(`${config.reqKeyPrefix}:q`, config.popTimeout)

app.start = async () => {
  monitor.assert.type('start', config, {
    reqKeyPrefix: 'string',
    popTimeout: 'number',
  })
  return {
    async run() {
      try {
        await app.install()
        while (true) {
          const popRes = await app.pop()
          if (popRes) {
            app.process(JSON.parse(popRes[1]))
          }
        }
      } catch (err) {
        app.abort({ source: 'run', err })
      }
    },
  }
}

module.exports = app
