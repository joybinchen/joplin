(function() {

    function pageTitle() {
        const titleElements = document.getElementsByTagName("title");
        if (titleElements.length) return titleElements[0].text.trim();
        return document.title.trim();
    }

    function baseUrl() {
        let output = location.origin + location.pathname;
        if (output[output.length - 1] !== '/') {
            output = output.split('/');
            output.pop();
            output = output.join('/');
        }
        return output;
    };

    const clippedContentResponse = (title, html) => {
        return {
            name: 'clippedContent',
            title: title,
            html: html,
            base_url: baseUrl(),
            url: location.origin + location.pathname + location.search,
        };
    };

    // Cleans up element by removing all its invisible children (which we don't want to render as Markdown)
    function cleanUpElement(element) {
        const childNodes = element.childNodes;

        for (let i = 0; i < childNodes.length; i++) {
            const node = childNodes[i];

            let isVisible = node.nodeType === 1 ? window.getComputedStyle(node).display !== 'none' : true;
            if (isVisible && ['input', 'textarea', 'script', 'noscript', 'style', 'select', 'option', 'button'].indexOf(node.nodeName.toLowerCase()) >= 0) isVisible = false;

            if (!isVisible) {
                element.removeChild(node);
            } else {
                cleanUpElement(node);
            }
        }
    }

    async function readabilityProcess() {
        var uri = {
            spec: location.href,
            host: location.host,
            prePath: location.protocol + "//" + location.host,
            scheme: location.protocol.substr(0, location.protocol.indexOf(":")),
            pathBase: location.protocol + "//" + location.host + location.pathname.substr(0, location.pathname.lastIndexOf("/") + 1)
        };

        // Readability directly change the passed document so clone it so as
        // to preserve the original web page.
        const documentClone = document.cloneNode(true);
        const readability = new Readability(documentClone); // new window.Readability(uri, documentClone);
        const article = readability.parse();

        if (!article) throw new Error('Could not parse HTML document with Readability');

        return {
            title: article.title,
            body: article.content,
        }
    };

    const ipcProxySendToHost = (methodName, arg) => {
        window.postMessage({ target: 'main', name: methodName, args: [ arg ] }, '*');
    };

    const prepareCommandResponse = async (command) => {
        let article = null;
        try {
            article = await readabilityProcess();
        } catch (error) {
            console.warn(error);
            console.warn('Sending full page HTML instead');
            const cleanDocument = document.body.cloneNode(true);
            cleanUpElement(cleanDocument);
            return clippedContentResponse(pageTitle(), cleanDocument.innerHTML);
        }
        return clippedContentResponse(article.title, article.body);
    };

    /*
    const commandState = {}
    window.addEventListener('message', (event) => {
        if (event.source === window) {
            const data = event.data ? event.data : {};
            if (data.target === 'webclipper') {
                const state = commandState[data.iid];
                if (data.result) {
                    state.result = data.result;
                    state.done = true;
                } else if (data.reason) {
                    state.reason = data.result;
                    state.error = true;
                }
            }
        }
    });

    const prepareCommandResponse = (command) => {
        return new Promise((resolve, reject) => {
			const state = {done: false, error: false};
			const iid = setInterval(() => {
				if (state.done) {
					clearInterval(iid);
					delete commandState[iid];
					resolve(state.result);
				} else if (state.error) {
					clearInterval(iid);
                    delete commandState[iid];
					reject(state.reason);
				}
			});
            commandState[iid] = state;
            console.log('prepareCommandResponse', command);
            window.postMessage({
                target: 'readability',
                command: command,
                iid: iid
            }, location.origin);
		});
    };
    */

    const clipSimplifiedPage = () => {
        prepareCommandResponse({
            name: "simplifiedPageHtml"
        }).then((result) => {
            console.log('simplifiedPageHtml', result.title);
            console.log('simplifiedPageHtml', result.html);
            ipcProxySendToHost('clipHtml', {
                title: result.title,
                html: result.html,
                base_url: document.baseURI,
                source_url: document.location.href,
            });
        }, (reason) => {
            console.log(reason);
        });

    };
    window.onload = () => {setTimeout(clipSimplifiedPage, 1000)};
    window.clipSimplifiedPage = clipSimplifiedPage;
    clipSimplifiedPage();

})();
