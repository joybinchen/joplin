function randomClipperPort(state, env) {
	const startPorts = {
		prod: 41184,
		dev: 27583,
	};

	const startPort = env === 'prod' ? startPorts.prod : startPorts.dev;

	if (!state) {
		state = { offset: 0, startPort: startPort };
	} else {
		state.offset++;
	}

	state.port = state.startPort + state.offset;

	return state;
}

module.exports = randomClipperPort;