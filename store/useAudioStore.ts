/* Create the store */

import { LiveManager } from "@/services/liveManager";
import { ConnectionState } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

/* 1. Define the store type */
type AudioStore = {
  connectionState: ConnectionState;
  error: string | null;
  liveManagerInstance: LiveManager | null;
  connect: () => Promise<void>;
};

/* 2. Create the store with Redux DevTools */
export const useAudioStore = create<AudioStore>()(
  devtools((set, get) => ({
    /**
     * 2.a. Store variables
     */
    connectionState: ConnectionState.CONNECTING,
    liveManagerInstance: null,
    error: null,

    /**
     * 2.b. Store methods
     */
    connect: async () => {
      /* Get the current state */
      const state = get();

      if (
        state.connectionState === ConnectionState.CONNECTING ||
        state.connectionState === ConnectionState.CONNECTED
      ) {
        return;
      }

      set({ error: null });

      /* Request microphone permission */
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        set({ error: "Microphone permission denied" });
      }

      /* Create the LiveManager singleton */
      let manager = state.liveManagerInstance;

      if (!manager) {
        manager = new LiveManager();
        set({ liveManagerInstance: manager });
      }

      /* Start the audio session */
      manager.startSession();
    },
  })),
);

/* 3. Connect the store to your components */