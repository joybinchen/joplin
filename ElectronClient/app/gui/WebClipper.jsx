const React = require('react');
const fs = require('fs');
const { connect } = require('react-redux');
const { reg } = require('lib/registry.js');
const { bridge } = require('electron').remote.require('./bridge');
const { Header } = require('./Header.min.js');
const { themeStyle } = require('../theme.js');
const { _ } = require('lib/locale.js');
const { shim } = require('lib/shim');
const HtmlToMd = require('lib/HtmlToMd');
const markdownUtils = require('lib/markdownUtils');
const Api = require('lib/services/rest/Api');
const api = new Api(() => {
	return Setting.value('api.token');
});

function getContentScript(name) {
	const path = __dirname + '/../content_scripts/' + name + '.js';
	return fs.readFileSync(path).toString('utf-8');
}
const JSDOMParser_js = getContentScript('JSDOMParser');
const Readablility_js= getContentScript('Readability');
const index_js = getContentScript('index');
const webclipper_js = getContentScript('webclipper');

class WebClipperComponent extends React.Component {

	constructor() {
		super();
		this.webview_ = null;
		this.state = {
			webviewReady: false,
		}
		this.webview_domReady = this.webview_domReady.bind(this)
	}

	componentWillMount() {
		console.log("webClipper.componentWillMount " + this.startUrl());
	}

	componentDidMount() {
		//this.webview_.addEventListener('dom-ready', this.webview_domReady);
	}

	componentWillUnmount() {
		this.webview_.addEventListener('dom-ready', this.webview_domReady);
	}

	htmlToMdParser() {
		if (this.htmlToMdParser_) return this.htmlToMdParser_;
		this.htmlToMdParser_ = new HtmlToMd();
		return this.htmlToMdParser_;
	}

	async webview_domReady() {
		console.log("webview_domReady for ", this.props.noteId);
		this.setState({ noteId:this.props.noteId, webviewReady: true });
		//let ses = this.webview_.getWebContents().session;
		if (this.props.src === 'about:blank') return;
		const webContents = this.webview_.getWebContents();
		webContents.openDevTools({mode: 'bottom'});
		console.log('executeJavaScript(JSDOMParser_js,');
		await webContents.executeJavaScript(JSDOMParser_js);
		console.log('executeJavaScript(Readablility_js,');
		await webContents.executeJavaScript(Readablility_js);
		console.log('executeJavaScript(webclipper_js)' );
		await webContents.executeJavaScript(webclipper_js)
		console.log('executeJavaScript(webclipper_js) done' );

		this.webview_.getWebContents().on('did-navigate', async (event) => {
			const url = event.url;
			console.log("did-navigate' for ", this.props.noteId, this.props.src);
			//this.props.updateMdClipping(HtmlToMd(htmlBody));
		});
		this.webview_.addEventListener('devtools-opened', async (event) => {
			const webContents = this.webview_.getWebContents();
			webContents.executeJavaScript('console.log("executeJavascript ok __dirname=' +
				__dirname + '");');
		});
	}

	webview_ref(element) {
		if (this.webview_) {
			if (this.webview_ === element) return;
			this.destroyWebview();
		}

		if (!element) {
			this.destroyWebview();
		} else {
			this.initWebview(element);
		}
	}

	destroyWebview() {
		if (!this.webview_) return;

		for (let n in this.webviewListeners_) {
			if (!this.webviewListeners_.hasOwnProperty(n)) continue;
			const fn = this.webviewListeners_[n];
			this.webview_.removeEventListener(n, fn);
		}

		this.webview_ = null;
	}

	initWebview(wv) {
		if (!this.webviewListeners_) {
			this.webviewListeners_ = {
				'dom-ready': this.webview_domReady.bind(this),
				'ipc-message': this.webview_ipcMessage.bind(this),
			};
		}

		for (let n in this.webviewListeners_) {
			if (!this.webviewListeners_.hasOwnProperty(n)) continue;
			const fn = this.webviewListeners_[n];
			wv.addEventListener(n, fn);
		}

		this.webview_ = wv;
	}

	async webview_ipcMessage(event) {
		const msg = event.channel ? event.channel : '';
		const args = event.args;
		const arg0 = args && args.length >= 1 ? args[0] : null;
		const arg1 = args && args.length >= 2 ? args[1] : null;

		console.log('Got ipc-message: ' + msg, args);

		if (msg === 'clipHtml') {
			const newNote = arg0;
			// Parsing will not work if the HTML is not wrapped in a top level tag, which is not guaranteed
			// when getting the content from elsewhere. So here wrap it - it won't change anything to the final
			// rendering but it makes sure everything will be parsed.
			if (newNote.source_url === 'about:blank') return;
			const htmlToMdParser = this.htmlToMdParser();
			const newBody = await htmlToMdParser.parse('<div>' + newNote.html + '</div>', {
				baseUrl: newNote.base_url ? newNote.base_url : '',
			});
			console.log('clipHtml (' + this.props.noteId + '): html to markdown:\n', newBody);
			if (! newBody) {
				//const webContents = this.webview_.getWebContents();
				//webContents.executeJavaScript(webclipper_js, () => {
				//	console.log('executeJavaScript(webclipper_js) again ... done' );
				//});
				return;
			}

			const response = await api.route('POST', '/notes' + (this.props.newNote ? '' : '/' + this.props.noteId), {token: api.token}, JSON.stringify({
				title: newNote.title,
				body: newBody,
				source_url: newNote.source_url,
				image_sizes: newNote.image_sizes,
				parent_id: this.props.folderId,
			}));
			this.props.updateMdClipping(response);
		} else if (msg === "log") {
			console.log(...args);
		} else if (msg.indexOf('#') === 0) {
			// This is an internal anchor, which is handled by the WebView so skip this case
		} else {
			bridge().showErrorMessageBox(_('Unsupported link or message: %s', msg));
		}
	}

	startUrl() {
		return this.props.src;
	}

	render() {
		const style = Object.assign({}, this.props.style);
		const theme = themeStyle(this.props.theme);
		style.display = 'flex';
		style.flexDirection = 'row';

		const webviewStyle = {
			height: this.props.style.height,
			display: 'flex',
			flexDirection: 'row',
			overflow: 'hidden',
		};

		return (
			<webview
				key={this.props.noteId}
				style={webviewStyle}
				preload="gui/note-viewer/clipper-preload.js"
				src={this.startUrl()}
				ref={(elem) => { this.webview_ref(elem); }}
			/>
		);
	}

}

const mapStateToProps = (state) => {
	return {
		noteId: state.selectedNoteIds.length === 1 ? state.selectedNoteIds[0] : null,
		folderId: state.selectedFolderId,
		newNote: state.newNote,
		theme: state.settings.theme,
	};
};

const WebClipper = connect(mapStateToProps)(WebClipperComponent);

module.exports = { WebClipper };
