'use strict'

const Hapi = require('hapi')
const Boom = require('boom')
const env = require('node-env-file')

env('./.env', {verbose: true, overwrite: true, raise: false, logger: console})

// Create connection to Postgres
var pg = require('knex')({ // eslint-disable-line no-unused-vars
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
  searchPath: 'knex,public'
})

// Create a server with a host and port
const server = new Hapi.Server()
server.connection({
  host: 'localhost',
  port: 8000
})

// Main route
// TODO: serve webpacked frontend
server.route({
  method: 'GET',
  path: '/',
  handler: function (request, reply) {
    return reply('<h1>Chat Stats</h1>')
  }
})

// Websocket route
server.route({
  method: 'POST',
  path: '/chat-socket',
  config: {
    payload: { output: 'data', parse: true, allow: 'application/json' },
    plugins: {
      websocket: {
        only: true,
        initially: true,
        subprotocol: 'chat-socket/1.0',
        connect: ({ ctx, ws }) => {
          ctx.to = setInterval(() => {
            ws.send(JSON.stringify({ cmd: 'PING' }))
          }, 5000)
        },
        disconnect: ({ ctx }) => {
          if (ctx.to !== null) {
            clearTimeout(ctx.to)
            ctx.to = null
          }
        }
      }
    }
  },
  handler: (request, reply) => {
    let { initially, ws } = request.websocket()
    if (initially) {
      ws.send(JSON.stringify({ cmd: 'HELLO' }))
      return reply().code(204)
    }
    if (typeof request.payload.cmd !== 'string') {
      return reply(Boom.badRequest('invalid request'))
    }
    if (request.payload.cmd === 'PING') {
      return reply({ result: 'PONG' })
    } else if (request.payload.cmd === 'AWAKE-ALL') {
      var peers = request.websocket().peers
      peers.forEach((peer) => {
        peer.send(JSON.stringify({ cmd: 'AWAKE' }))
      })
      return reply().code(204)
    } else {
      return reply(Boom.badRequest('unknown command'))
    }
  }
})

// Start the server
server.start((err) => {
  if (err) {
    throw err
  }
  console.log('Server running at:', server.info.uri)
})
