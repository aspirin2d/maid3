import React from 'react';
import {Box, Spacer, Text} from 'ink';

export function Header({url}: {url: string}) {
	return (
		<Box
			flexDirection="row"
			borderStyle="round"
			borderColor="green"
			paddingX={1}
		>
			<Text color="green" bold>
				Maid CLI
			</Text>
			<Text dimColor>{url}</Text>
		</Box>
	);
}

export default function App({url}: {url: string}) {
	return (
		<Box flexDirection="column">
			<Header url={url} />
			<Spacer />
			<Box flexGrow={1} paddingX={1}>
				<Text>Fills all remaining space</Text>
			</Box>
		</Box>
	);
}
