var env = process.env.NODE_ENV || 'development'
var cfg = require('./config.'+ env);

// SignalWire
console.log("starting signalwire node ...")
console.log(cfg)

var signalwire_package = '@signalwire/node'

if (cfg.signalwire_package) {
  signalwire_package = cfg.signalwire_package // allow overwrite with '../..' on dev
}

const SignalWire = require(signalwire_package)
const RelayClient = SignalWire.RelayClient
const RelayConsumer = SignalWire.RelayConsumer

const FROM_NUMBER = '+18990000001'

const consumer = new RelayConsumer({
  host: cfg.signalwireHost,
  project: cfg.signalwireProject,
  token: token = cfg.signalwireToken,
  contexts: ['home', 'office', 'dev'],
  teardown: (consumer) => {
    console.log('teardown now and close.')
  },
  onTask: async (message) => {
    console.log('New task:', message)
  },
  onIncomingMessage: async (message) => {
    console.log('Inbound message', message.id, message.from, message.to)
  },
  onMessageStateChange: async (message) => {
    console.log('Message state changed', message.id, message.state)
  },
  onIncomingCall: async (call) => {
    console.log('Inbound call', call.id, call.from, call.to)
    const answerResult = await call.answer()
    if (!answerResult.successful) {
      console.error('Answer Error')
      return
    }
    const collect = {
      initial_timeout: 10,
      end_silence_timeout: 10,
      speech_hints: ["confidence_threshold=0.6"]
    }
    const prompt = await call.promptTTS(collect, { text: 'Welcome at SignalWire! Please talk to me' })
    if (prompt.successful) {
      await call.playTTS({ text: `You entered: ${prompt.result}. Thanks and good bye!` })
    } else {
      await call.playTTS({ text: 'Errors during prompt.' })
    }
    await call.hangup()
  }
})

consumer.run()
