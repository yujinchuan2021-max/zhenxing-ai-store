import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createTheme,
  MantineProvider,
  type MantineColorsTuple
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import App from "./App";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/spotlight/styles.css";
import "./styles.css";

const aiHubCyan: MantineColorsTuple = [
  "#ecfeff",
  "#cffafe",
  "#a5f3fc",
  "#67e8f9",
  "#49d6dd",
  "#22c3cf",
  "#0891a2",
  "#0e7490",
  "#155e75",
  "#164e63"
];

const aiHubTheme = createTheme({
  primaryColor: "aiHubCyan",
  colors: { aiHubCyan },
  defaultRadius: "sm",
  fontFamily:
    'HarmonyOS Sans SC, "HarmonyOS Sans", "Microsoft YaHei UI", sans-serif',
  headings: {
    fontFamily:
      'HarmonyOS Sans SC, "HarmonyOS Sans", "Microsoft YaHei UI", sans-serif',
    fontWeight: "800"
  },
  cursorType: "pointer",
  focusRing: "auto"
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={aiHubTheme} defaultColorScheme="light">
      <Notifications
        className="aiHubNotifications"
        position="top-right"
        limit={4}
        autoClose={4200}
      />
      <App />
    </MantineProvider>
  </StrictMode>
);
