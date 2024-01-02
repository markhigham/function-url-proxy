#!/usr/bin/env node

const argv = require('minimist')(process.argv.slice(2))
const path = require('path')
const fs = require('fs')
const showHelp = require('./usage')

const debug = require('debug')('function-url-proxy')

const express = require('express')
const bodyParser = require('body-parser')

const uuid = require('uuid')

let port = 10808
let host = '0.0.0.0'

if (argv.h) {
  showHelp()
  process.exit(0)
}

if (argv._.length < 1) {
  // We expect at least test_file
  showHelp()
  process.exit(-1)
}

if (argv.p) {
  port = argv.p
  debug(`port: ${port}`)
}

const moduleFilename = argv._[0]
const filename = path.resolve(moduleFilename)
debug(filename)

let handlerName = 'handler'
if (argv.f) {
  handlerName = argv.f
  debug(`handlerName: ${handlerName}`)
}

const dotEnvPath = path.resolve('.env')
if (fs.existsSync(dotEnvPath)) {
  require('dotenv').config({ path: dotEnvPath })
  debug(`loaded .env from ${dotEnvPath}`)
}

let handler

try {
  const module = require(filename)
  debug(`using handlerName: ${handlerName}`)
  handler = module[handlerName]

  if (!handler) {
    console.error(
      `Error: Couldn't find handler function '${handlerName}' in ${filename}`,
    )
    process.exit(-1)
  }
} catch (e) {
  console.error(e)
  process.exit(1)
}

if (handler.constructor.name !== 'AsyncFunction') {
  console.error(`Expected '${handlerName}' to be an AsyncFunction`.red)
  process.exit(1)
}

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

/**
 * converts an express query object into the same format as lambda
 * @param query: Request.Query
 * @returns {{}}
 */
function changeExpressQueryToLambda(query) {
  const result = {}
  for (const [key, value] of Object.entries(query)) {
    if (!Array.isArray(value)) {
      result[key] = value
      continue
    }

    result[key] = value.join(',')
  }
  return result
}

app.all('*', async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`
  console.log(`${req.method} ${req.path}`)
  const u = new URL(fullUrl)

  const packagedEvent = {
    queryStringParameters: changeExpressQueryToLambda(req.query),
    headers: req.headers,
    rawQueryString: u.search,
    rawPath: u.pathname,
    requestContext: {
      http: {
        method: req.method,
        path: u.pathname,
      },
      requestId: uuid.v4(),
    },
  }
  debug(`calling ${moduleFilename.replace('.js', '')}.${handlerName}`)

  const context = { awsRequestId: uuid.v4() }

  const result = await handler(packagedEvent, context)

  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      res.set(key, value)
    }
  }
  res.status(result.statusCode).send(result.body)
})

app.listen(port, host, () => {
  console.log(`started on http://${host}:${port}`)
})
