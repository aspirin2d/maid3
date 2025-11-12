import { Text } from "ink";
import { useCallback, useState } from "react";
import { type View, viewContext } from "./context.js";
import Commander from "./commander.js";

export default function App({ url }: { url: string }) {
  const [views, setViews] = useState<View[]>([
    { kind: "commander", option: { url: url } },
  ]);

  const addView = useCallback(
    (view: View) => {
      setViews([...views, view]);
    },
    [views, setViews],
  );

  return (
    <viewContext.Provider value={addView}>
      {views.map((view, index) => {
        switch (view.kind) {
          case "text":
            return (
              <Text key={index} dimColor={view.option.dimColor ?? false}>
                {view.option.label as string}
              </Text>
            );
          case "commander":
            return <Commander key={index} />;
          default:
            return <Text key={index}>{view.kind}: "Unknown"</Text>;
        }
      })}
    </viewContext.Provider>
  );
}
