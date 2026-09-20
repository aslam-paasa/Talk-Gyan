class MicProcessor extends AudioWorkletProcessor {
    process(inputs) {
        if (!inputs.length) return true;

        /**
         * Mono Channel:
         * inputs = [
         *   [
         *      Float32Array(...)  <== mono
         *   ]
         * ]
        */
        const input = inputs[0];
        if (!input.length) return true;

        /**
         * First channel data:
        */
        const channelData = input[0];
        if(!channelData) return true;

        /**
         * Copy the audio data: 
         */
        const pcm = new Float32Array(channelData.length)
        pcm.set(channelData);

        /**
         * Send the audio data from AudioWorklet thread to the main JS thread
        */
        this.port.postMessage(pcm);

        return true;
    }
}

registerProcessor("mic-processor", MicProcessor)