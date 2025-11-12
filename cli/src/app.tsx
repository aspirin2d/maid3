import { Text } from "ink";
import { useState } from "react";
import Commander from "./commander.js";
import { Session, type View, viewContext } from "./context.js";
import Login from "./login.js";

export default function App({ url }: { url: string }) {
  const [views, setViews] = useState<View[]>([
    { kind: "commander", option: { url: url } },
  ]);

  const [session, setSession] = useState<Session | null>(null);

  return (
    <viewContext.Provider value={{ views, setViews, session, setSession }}>
      {views.map((view, index) => {
        switch (view.kind) {
          case "text":
            return (
              <Text
                key={index}
                color={view.option.color ?? undefined}
                dimColor={view.option.dimColor ?? false}
              >
                {view.option.label as string}
              </Text>
            );
          case "commander":
            return <Commander key={index} />;
          case "/login":
            return <Login key={index} url={url} />;
          default:
            return <Text key={index}>{view.kind}: "Unknown"</Text>;
        }
      })}
    </viewContext.Provider>
  );
}
