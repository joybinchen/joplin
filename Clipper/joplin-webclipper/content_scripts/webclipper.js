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
	}

	function getImageSizes(element) {
		const images = element.getElementsByTagName('img');
		const output = {};
		for (let i = 0; i < images.length; i++) {
			const img = images[i];
			output[img.src] = {
				width: img.width,
				height: img.height,
				naturalWidth: img.naturalWidth,
				naturalHeight: img.naturalHeight,
			};
		}
		return output;
	}

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

	function readabilityProcess() {
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
	}

	const clippedContentResponse = (title, html, imageSizes) => {
		return {
			name: 'clippedContent',
			title: title,
			html: html,
			base_url: baseUrl(),
			url: location.origin + location.pathname + location.search,
			image_sizes: imageSizes,
		};
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
			return clippedContentResponse(pageTitle(), cleanDocument.innerHTML, getImageSizes(document));
		}
		return clippedContentResponse(article.title, article.body, getImageSizes(document));
	};

	const handleLazyImages = () => {
		const lazy_images = document.getElementsByTagName('div');
		for(var i = lazy_images.length - 1; i >= 0; --i) {
			var div = lazy_images[i];
			if (! div.hasAttribute('data-src')) continue;
			var img = document.createElement('img')
			img.setAttribute('src', div.getAttribute('data-src'))
			div.parentElement.replaceChild(img, div);
		}
	};

	const clipSimplifiedPage = () => {
		handleLazyImages();
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
				image_sizes: result.image_sizes,
			});
		}, (reason) => {
			console.log(reason);
		});

	};
	setTimeout(clipSimplifiedPage, 3000);
	clipSimplifiedPage();

})();
