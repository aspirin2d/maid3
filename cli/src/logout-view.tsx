import { Box, Text } from "ink";
import { useEffect, useRef } from "react";
import { clearSession } from "./session.js";
import { useAddView } from "./view-context.js";

type LogoutViewProps = {
  onLoggedOut?: () => void;
};

export function LogoutView({ onLoggedOut }: LogoutViewProps) {
  const addView = useAddView();
  const hasLoggedOutRef = useRef(false);

  useEffect(() => {
    if (hasLoggedOutRef.current) {
      return;
    }
    hasLoggedOutRef.current = true;

    void (async () => {
      await clearSession();
      onLoggedOut?.();
      addView({ kind: "text", message: "Logged out successfully" });
      addView({ kind: "palette" });
    })();
  }, [addView, onLoggedOut]);

  return (
    <Box
      paddingX={1}
      paddingY={0}
      borderStyle="round"
      borderColor="green"
      flexDirection="row"
    >
      <Text color="green">Signing you out...</Text>
    </Box>
  );
}
