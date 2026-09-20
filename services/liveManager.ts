import { INPUT_SAMPLE_RATE, MODEL, OUTPUT_SAMPLE_RATE } from "@/lib/constants";
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
  /**
   * 1. Gemini: Store the Gemini AI client and active session 
   */
  private ai: GoogleGenAI;
  private activeSession: Session | null = null;

  /**
   * 2. Audio
  */
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;

  /**
   * 3. Microphone
  */
  private mediaStream: MediaStream | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;

  /**
   * 4. AudioWorklet (Thread)
  */
  private workletNode: AudioWorkletNode | null = null;


  /* 5. Constructor: Create the Gemini AI client */
  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    });
  }

  /**
   * 6. Start Gemini Live Session
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

    /**
     * a. Create Gemini Live Configuration
    */
    const config = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: "You are a helpful and friendly AI Assistant.",
    };

    /**
     * b. Connect to Gemini Live API
    */
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

    /**
     * d. Create input AudioContext & output AudioContext:
     *    - Input : Microphone > AudioWorklet
     *    - Output: Gemini > Speaker
     *    - We are preparing this now
     * 
     * e. Resume AudioContexts:
     *    - Browsers can initially create AudioContext in "suspended" state.
     *    - FIX: resume() returns a Promise, so we await it.
    */

    this.inputAudioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE })
    this.outputAudioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })

    if (this.inputAudioContext.state === 'suspended') {
      await this.inputAudioContext.resume()
    }

    if (this.outputAudioContext.state === 'suspended') {
      await this.outputAudioContext.resume()
    }


    /**
     * f. Create output GainNode
     *    - Gemini audio will eventually be connected here:
     *      > Gemini
     *      > AudioBuffer
     *      > GainNode
     *      > Speaker
    */
    this.outputNode = this.outputAudioContext.createGain()
    this.outputNode.connect(this.outputAudioContext.destination)

    /**
     * g. Load AudioWorklet Processor:
     *    - Browser load: /public/worklets/mic-processor.js
     *    - Important:
     *      - If your file is: public/worklets/mic-processor.js
     *      - then the URL is: /worklets/mic-processor.js
    */
    await this.inputAudioContext.audioWorklet.addModule("/worklets/mic-processor.js")
    console.log("AudioWorklet module loaded");

    /**
     * h. Create AudioWorkletNode:
    */
    this.workletNode = new AudioWorkletNode(this.inputAudioContext, "mic-processor")
    console.log("AudioWorkletNode created");

    /**
     * i. Receive messages from AudioWorklet:
     *    - AudioWorklet runs on the audio thread.
     *    - Micproccessor:
     *      > Float32Array
     *      > port.postMessage()
     *      > Main Thread
     *      > onmessage
    */
    this.workletNode.connect(this.inputAudioContext.destination)

    this.workletNode.port.onmessage = (event) => {
      console.log('RECEIVED MESSAGE FROM AUDIO THREAD', event.data)
    }


    /**
     * j. Ask browser for microphone permission:
     *    - This is now the ONLY place the mic is requested
     *      (the store no longer opens a second, unreleased stream).
     *    - If permission is denied this throws, and the store's
     *      try/catch handles it.
    */
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: INPUT_SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    })
    console.log('Microphone Stream: ', this.mediaStream)


    /**
     * k. Connect MediaStream > AudioWorklet
     *    > Microphone
     *    > MediaStream
     *    > MediaStreamAudioSourceNode
     *    > AudioWorkletNode
     *    > MicProcessor
    */
    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.mediaStream)
    this.inputSource.connect(this.workletNode);

    console.log("Session", this.activeSession);
  }
}