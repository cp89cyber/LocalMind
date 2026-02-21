/// <reference types="vite/client" />

import type { LocalMindAPI } from "../shared/types";

declare global {
  interface Window {
    localMind: LocalMindAPI;
  }
}

export {};
