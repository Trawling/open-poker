import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // android/ — нативный Capacitor-проект (см. docs/05-android.md),
    // живёт внутри frontend/, но его сборочные артефакты/копии ассетов
    // не имеют отношения к dev-серверу — без этого vite лишний раз
    // триггерит reload при каждой android-сборке.
    watch: {
      ignored: ["**/android/**"],
    },
  },
});
