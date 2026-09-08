import { MODEL } from "@/lib/constants";
import { GoogleGenAI, Session, Modality } from "@google/genai";

/**
 * LiveManager:
 * - This class manages the connection between our application and the Gemini Live API.
 * - Flow:
 * 
 *    Controls Panel
 *          |
 *          | connect()
 *          v
 *    Global State
 *          |
 *          | create/get LiveManager
 *          v
 *    LiveManager
 *          |
 *          | startSession()
 *          v
 *    Gemini Live API
 *          |
 *          | Events
 *          v
 *    onopen/onmessage/onerror/onclose
 */


export class LiveManager {
  /* 1. Store the Gemini AI client and active session */
  private ai: GoogleGenAI;
  private activeSession: Session | null = null;

  /* 2. Create the Gemini AI client */
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    });
  }

  /**
   * 3. Start a Live API session
   *    a. Session Configuration
   *       - Enable audio responses from Gemini
   *       - Give Gemini its basic behavior/instructions.
   *    b. Connect to the Gemini Live API
   *       - The returned session is stored so we can use it later to communicate
   *         with the active session.
   *    c. Handle Live Events:
   *       - onopen   : Called when the connection is established
   *       - onmessage: receives messages from gemini
   *       - onerror  : handles connection errors
   *       - onclose  : called when the session is closed
   */
  async startSession() {
    console.log("starting the session");

    const config = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: "You are a helpful and friendly AI Assistant.",
    };

    this.activeSession = await this.ai.live.connect({
      model: MODEL,
      config: config,
      callbacks: {
        onopen: () => console.log("Connected to Gemini Live API"),
        onmessage: (message) => console.log(message),
        onerror: (e) => console.error("Error:", e.message),
        onclose: (e) => console.log("Closed:", e.reason),
      },
    });

    console.log("Session", this.activeSession);
  }
}
