import { encodeWav } from "./wav";

const SAMPLE_RATE = 16000;

export type Recording = {
  /** stops and returns the question as 16 kHz mono WAV */
  stop: () => Promise<Blob>;
  cancel: () => void;
};

/**
 * Records from the microphone. Browsers record compressed audio (WebM on Chrome, MP4 on Safari),
 * so on stop it is decoded and resampled to the WAV that Muse Voice Transcribe accepts.
 * Needs a secure context (https or localhost).
 */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
  });
  const release = () => stream.getTracks().forEach((t) => t.stop());
  recorder.start();

  return {
    async stop() {
      if (recorder.state !== "inactive") recorder.stop();
      const compressed = await stopped;
      release();
      return toWav(compressed);
    },
    cancel() {
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
}

async function toWav(compressed: Blob): Promise<Blob> {
  const context = new AudioContext();
  const decoded = await context.decodeAudioData(await compressed.arrayBuffer());
  void context.close();
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE)), SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return new Blob([encodeWav(rendered.getChannelData(0), SAMPLE_RATE)], { type: "audio/wav" });
}
