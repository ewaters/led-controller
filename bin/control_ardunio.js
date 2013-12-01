var SerialPort = require("serialport").SerialPort,
	_          = require("lodash"),
	async      = require("async"),
	Color      = require("../lib/color"),
	clientio   = require("socket.io-client");

// User configuration.
var playbackServer = "http://192.168.0.192:8080",
	serialPath     = "/dev/tty.usbserial-FTDK64MV",
	serialBaud     = 57600,
	alias          = "default",
	debug          = false,
	strandId       = 1;

// Setup.
var serialPort,
	playbackClient,
	READY = 0xff;
	INIT_READY = 0xfe;

async.series([
	function (cb) {
		serialPort = new SerialPort(serialPath, { baudrate: serialBaud }, false);
		serialPort.open(cb);
	},
	function (cb) {
		console.info("serialPort connected");
		playbackClient = clientio.connect(playbackServer, { multiplex: false });
		playbackClient.once("connect", cb);
		playbackClient.once("error", cb);
	},
	function (cb) {
		console.info("playbackClient connected");
		playbackClient.removeAllListeners("error");
		playbackClient.on("error", function (err) {
			console.error("playbackClient: " + err);
		});
		playbackClient.on("disconnect", function () {
			console.error("playbackClient: server disconnected");
		});
		playbackClient.emit("alias", alias);

		var initialReady = false;

		// Setup serial port.
		serialPort.on("data", function (data) {
			if (! initialReady) {
				if (data[0] === INIT_READY) {
					initialReady = true;
					playbackClient.emit("ready");
					console.info("serialPort reports ready for display");
				}
				else {
					console.error("serialPort received unknown data when waiting for initial ready:", data);
				}
				return;
			}

			if (data[0] !== READY) {
				console.error("serialPort received unknown data:", data);
				process.exit(1);
			}
			if (debug) console.info("playbackClient is ready");
			playbackClient.emit("ready");
		});

		// Setup playback client.
		playbackClient.on("display", function (data) {
			var strandData = data[strandId];
			if (strandData === undefined) {
				console.error("playbackClient: display() provides no data for my strand " + strandId, data);
				return;
			}
			if (debug) console.info("playbackClient display received " + strandData.length + " colors");
			var buf = new Buffer(strandData.length * 3);
			_.forEach(strandData, function (value, i) {
				var offset = (i * 3);
				var color = new Color("RGB", value);
				buf[offset] = Math.floor(color.red() * 255);
				buf[offset + 1] = Math.floor(color.green() * 255);
				buf[offset + 2] = Math.floor(color.blue() * 255);
			});
			if (debug) console.info("serialPort writing " + buf.length + " octects");
			if (debug) console.info(buf);
			serialPort.write(buf);
		});
	},
], function (err) {
	console.error(err);
});
