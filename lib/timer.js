function Timer () {
	this.start = new Date().valueOf();
}

Timer.prototype = {
	elapsed: function () {
		return (new Date().valueOf() - this.start) / 1000;
	},
};

module.exports = Timer;
