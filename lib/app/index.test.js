const app = require('.')

describe('app', () => {
  const state = {}

  beforeAll(async () => {
    const time = await app.redis.time()
    state.startTimeMs = Math.floor(
      parseInt(time[0]) * 1000 + parseInt(time[1]) / 1000,
    )
    expect(state.startTimeMs).toBeGreaterThan(1555e9)
    expect(state.startTimeMs).toBeLessThan(1999e9)
    await app.start()
  })

  beforeEach(async () => {
    state.req = {
      url: 'http://localhost:50080',
      options: { method: 'GET' },
      username: 'admin',
      password: 'admin',
    }
    await app.redis
      .multi([
        ['del', 'in:q'],
        ['del', 'count:app:h'],
        ['lpush', 'in:q', JSON.stringify(state.req)],
      ])
      .exec()
  })

  afterAll(async () => {
    await app.end()
  })

  it('should pop', async () => {
    const popRes = await app.pop()
    expect(popRes[0]).toBe('lula-fetch:in:q')
    expect(JSON.parse(popRes[1])).toStrictEqual(state.req)
  })

  it('should process', async () => {
    await app.process(state.req)
  })
})
