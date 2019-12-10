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

// const { RelayConsumer } = require('../..')

const consumer = new RelayConsumer({
  host: cfg.signalwireHost,
  project: cfg.signalwireProject,
  token: cfg.signalwireToken,
  contexts: ['home', 'office', 'dev'],
  teardown: (consumer) => {
    console.log('Consumer teardown. Cleanup..')
  },
  onIncomingCall: async (call) => {
    console.log('Inbound call', call.id, call.from, call.to)
    const answerResult = await call.answer()
    if (!answerResult.successful) {
      console.error('Error during call answer')
      return
    }
    await call.playTTS({ text: "Hello How do you do", gender: 'male'})
    await call.playTTS({ text: "Hi", language: 'en-US-Wavenet-D'})
    await call.playTTS({ text: "C'est la vie en français", language: "fr-FR", gender: 'male'})
    await call.playTTS({ text: "你好，中国", language: "zh-CN", gender: 'male'})
    await call.playAudio('https://cdn.signalwire.com/default-music/welcome.mp3')
    await call.hangup()
  }
})

consumer.run()
