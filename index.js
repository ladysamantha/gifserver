const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const pino = require('express-pino-logger')()

const Redis = require('ioredis')

const axios = require('axios')

const app = express()
const router = express.Router()

// setup some essential middleware
app.use(helmet())
app.use(cors())
app.use(pino)

app.use(router)

const port = Number.parseInt(process.env.PORT || '3000')

const gifURL = 'https://api.giphy.com/v1/gifs/search'

const redisConf = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.REDIS_PORT || '6379'),
  lazyConnect: true
}

const redis = new Redis(redisConf)

router.get('/', async (req, res) => {
  const { term } = req.query
  if (!term) {
    return res
      .status(422)
      .json({ error: 'term query parameter must be defined' })
  }

  const termExists = await redis.exists(term)

  if (termExists) {
    const url = await redis.srandmember(term)
    return res.json({ url })
  }

  let giphyResponse = null
  try {
    giphyResponse = await axios.get(gifURL, {
      params: {
        api_key: process.env.GIPHY_API_KEY,
        q: term,
        limit: 10
      }
    })
  } catch (error) {
    return res
      .status(500)
      .json({ error, message: 'erroring getting gifs from Giphy' })
  }

  const { data: gifs } = giphyResponse.data

  const uris = gifs.map(gif => gif.url)

  await redis.sadd(term, uris)

  const url = await redis.srandmember(term)
  return res.json({ url })
})

let server

redis.connect().then(() => {
  server = app.listen(port)
})

const destroy = () => {
  redis.disconnect()
  server.close()
}

process.on('SIGTERM', () => {
  destroy()
})

process.on('unhandledRejection', error => {
  destroy()
  throw error
})
