import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
	`
	Usage
	  $ cli

	Options
		--url  API base url

	Examples
	  $ cli --url=http://localhost:3000/api/v1
`,
	{
		importMeta: import.meta,
		flags: {
			url: {
				type: 'string',
				shortFlag: 'u',
				isRequired: true,
			},
		},
	},
);

(async () => {
	try {
		const {waitUntilExit} = render(<App url={cli.flags.url} />);
		await waitUntilExit();
	} catch (e) {
		console.error(e); // not reached
	}
})();
