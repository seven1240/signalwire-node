var env = process.env.NODE_ENV || 'development'
var cfg = require('./config.'+ env);

// SignalWire
console.log("starting signalwire node ...")
console.log(cfg)

const { RelayClient } = require('../..')

const host = cfg.signalwireHost
const project = cfg.signalwireProject
const token = cfg.signalwireToken

console.log('Init client with: ', host, project, token, '\n')
const client = new RelayClient({ host, project, token })

client.on('signalwire.socket.open', (event) => {
  console.log('\nSocket Open!\n', event)
})

client.on('signalwire.socket.close', (event) => {
  console.log('\nSocket Closed!\n', event)
})
client.on('signalwire.socket.error', (event) => {
  console.log('\nSocket Erro!\n', event)
})

client.on('signalwire.ready', async (client) => {
  console.log('Session ready')
})

client.connect()
