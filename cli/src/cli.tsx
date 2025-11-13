#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";

const cli = meow(
  `
	Usage
	  $ cli

	Options
		--url  API base url

	Examples
	  $ cli --url=http://localhost:3000/api
`,
  {
    importMeta: import.meta,
    flags: {
      url: {
        type: "string",
        shortFlag: "u",
        isRequired: true,
      },
    },
  },
);

(async () => {
  try {
    const url = cli.flags.url.replace(/\/+$/, "");

    // Validate HTTPS for non-localhost URLs
    if (!url.startsWith('https://') &&
        !url.startsWith('http://localhost') &&
        !url.startsWith('http://127.0.0.1')) {
      console.error('[Error] URL must use HTTPS for non-localhost connections');
      console.error('       Use https:// or connect to localhost for development');
      process.exit(1);
    }

    const { waitUntilExit } = render(<App url={url} />);
    await waitUntilExit();
  } catch (e) {
    console.error('[Error]', e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
})();
