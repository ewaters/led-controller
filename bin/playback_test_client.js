var _        = require("lodash"),
	clientio = require("socket.io-client");

var playbackPort = 8080;

var playbackClient = clientio.connect("http://localhost:" + playbackPort, { multiplex: false });
playbackClient.on("connect", function () {
	console.info("playbackClient: connected to server");
	playbackClient.emit("identify");
});
playbackClient.on("identify", function (data) {
	console.info("playbackClient: id " + data);
});
playbackClient.on("error", function (err) {
	console.info("playbackClient: error " + err);
});
playbackClient.on("display", function (data) {
	console.info("playbackClient: received 'display' request with " + JSON.stringify(data));
	playbackClient.emit("ready");
});
playbackClient.on("ready", function () {
	console.info("playbackClient: received 'ready'");
});
