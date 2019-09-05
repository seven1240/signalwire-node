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

// const client = new RelayClient({
//   host: cfg.signalwireHost,
//   project: cfg.signalwireProject,
//   token: cfg.signalwireToken
// })

var ACTIVE_CALLS = new Array()
var myClient;

const consumer = new RelayConsumer({
  host: cfg.signalwireHost,
  project: cfg.signalwireProject,
  token: cfg.signalwireToken,

  contexts: ['agora'],
  ready: async ({ client }) => {
    console.log("Client Ready");
    myClient = client;
  },
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
    const collect = { initial_timeout: 10, digits: { max: 3, digit_timeout: 5 } }
    const prompt = await call.promptTTS(collect, { text: 'Welcome at SignalWire! Please, enter your PIN' })
    if (prompt.successful) {
      await call.playTTS({ text: `You entered: ${prompt.result}. Thanks and good bye!` })
    } else {
      await call.playTTS({ text: 'Errors during prompt.' })
    }
    await call.hangup()
  }
})

consumer.run()

// http interface
const express = require('express')
const app = express()
const port = cfg.httpPort

app.use(express.static('public'))
app.get('/getWebsocketPort', (req, res) => {
  const data = {port: cfg.websocketPort}
  res.send(JSON.stringify(data))
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))


//websocket interface
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: cfg.websocketPort });
wss.on('connection', function connection(ws, req) {
  const ip = req.connection.remoteAddress;
  ws.on('message', function incoming(message) {
    console.log(message)
    try {
      const cmd = JSON.parse(message)

      if (cmd.method == "call") {
        makeCall(cmd, ws)
      }
    } catch (e) {
      console.error("parse error:", e)
    }
  })
})

async function makeCall(cmd, ws) {
  console.log("relay call", cmd)

  var call_params = { type: 'agora', appid: cmd.appid, channel: cmd.channel, from: 'agora', to: cmd.to };

  // to help pass hagrid
  call_params = { type: 'phone', from: '+18990000000', to: "+18990007777", appid: cmd.appid, channel: cmd.channel };

  const { successful: dialed, call } = await myClient.calling.dial(call_params)

  if (!dialed) {
    console.error('Dial error!')
    var err = {error: "dial error"}
    ws.send(JSON.stringify(err))
    return
  }

  call.on('created', call => {
    console.log(`\t ${call.id} state from ${call.prevState} to ${call.state}`, '\n')
  })
  .on('ringing', call => {
    console.log(`\t ${call.id} state from ${call.prevState} to ${call.state}`, '\n')
  })
  .on('answered', call => {
    console.log(`\t ${call.id} state from ${call.prevState} to ${call.state}`, '\n')
  })
  .on('ending', call => {
    console.log(`\t ${call.id} state from ${call.prevState} to ${call.state}`, '\n')
  })
  .on('ended', call => {
    console.log(`\t ${call.id} state from ${call.prevState} to ${call.state}`, '\n')
    const msg = {msg: "call ended"};
    ws.send(JSON.stringify(msg));
  })

  call.on('disconnected', call => {
    console.log(`\t ${call.id} has been disconnected!`, '\n')
  })
  .on('connecting', call => {
    console.log(`\t ${call.id} trying to connecting..`, '\n')
  })
  .on('connected', call => {
    console.log(`\t ${call.id} has been connected with ${call.peer.id}!`, '\n')
  })
  .on('failed', call => {
    console.log(`\t ${call.id} failed to connect!`, '\n')
  })

  call.on('record.recording', params => {
    console.log(`\t Record state changed for ${params.call_id} in ${params.state} - ${params.control_id}`)
  })
  .on('record.paused', params => {
    console.log(`\t Record state changed for ${params.call_id} in ${params.state} - ${params.control_id}`)
  })
  .on('record.finished', params => {
    console.log(`\t Record state changed for ${params.call_id} in ${params.state} - ${params.control_id}`)
  })
  .on('record.no_input', params => {
    console.log(`\t Record state changed for ${params.call_id} in ${params.state} - ${params.control_id}`)
  })


  if (call.state == "answered") {
    console.log("call answered");
    const msg = {msg: "agora answered, calling to " + call_params.to};
    ws.send(JSON.stringify(msg));

    tts = false

    if (tts) {
      await call.playTTS({ text: "Good good. Thank you, bye"} );
      await call.hangup();
    } else {
      const connect_params = { type: 'phone', from: call_params.from, to: call_params.to};
      // const domain = "dev-seven.sip.swire.io";
      // const connect_params = { type: 'sip', params: {from: "1000@" + domain, to: "1002@" + domain, timeout: 30}};
      console.log("connecting to", connect_params);
      const { successful: connected, event: callEvent, call: call2 } = await call.connect(connect_params);

      console.log("successful", connected);
      console.log("event", callEvent);
      console.log("call2", call2);

      if (!connected) {
        console.log("call failed", connect_params);
        const msg = {msg: "call failed when connecting to " + connect_params.to};
        ws.send(JSON.stringify(msg));
        call.hangup();
        return;
      }

      if (!call2) {
        console.error("WTF?");
        const msg = {msg: "call failed when connecting to " + connect_params.to};
        ws.send(JSON.stringify(msg));
        call.hangup();
        return;
      }

      // so far so good, bleg

      call2.on('created', call => {
        console.log(`\t ${call.id} state from ${call.prevState} to ${call.state}`, '\n')
      }).on('ringing', call => {
        console.log(`\t ${call.id} state from ${call.prevState} to ${call.state}`, '\n')
      }).on('answered', call => {
        console.log(`\t ${call.id} state from ${call.prevState} to ${call.state}`, '\n')
      }).on('ending', call => {
        console.log(`\t ${call.id} state from ${call.prevState} to ${call.state}`, '\n')
      }).on('ended', call => {
        console.log(`\t ${call.id} state from ${call.prevState} to ${call.state}`, '\n')
        const msg = {msg: "call ended"};
        ws.send(JSON.stringify(msg));
      })

      call2.on('disconnected', call => {
        console.log(`\t ${call.id} has been disconnected!`, '\n')
      }).on('connecting', call => {
        console.log(`\t ${call.id} trying to connecting..`, '\n')
      }).on('connected', call => {
        console.log(`\t ${call.id} has been connected with ${call.peer.id}!`, '\n')
      }).on('failed', call => {
        console.log(`\t ${call.id} failed to connect!`, '\n')
      })

      call2.on('record.recording', params => {
        console.log(`\t Record state changed for ${params.call_id} in ${params.state} - ${params.control_id}`)
      }).on('record.paused', params => {
        console.log(`\t Record state changed for ${params.call_id} in ${params.state} - ${params.control_id}`)
      }).on('record.finished', params => {
        console.log(`\t Record state changed for ${params.call_id} in ${params.state} - ${params.control_id}`)
      }).on('record.no_input', params => {
        console.log(`\t Record state changed for ${params.call_id} in ${params.state} - ${params.control_id}`)
      })
    }
  }

}
