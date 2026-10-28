// Reads QR codes from the back camera into a <video>. Uses the browser's own BarcodeDetector
// where it exists, and jsQR (only downloaded when first needed) everywhere else.
// In the Android app, Capacitor turns the camera request into the usual permission prompt.

export const canUseCamera =
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices?.getUserMedia === "function";

export type ScannerError = "denied" | "unavailable";

type Detect = (video: HTMLVideoElement) => Promise<string | null>;

// Not in TypeScript's DOM types yet.
type BarcodeDetectorClass = {
  new (options: { formats: string[] }): {
    detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
  };
  getSupportedFormats: () => Promise<string[]>;
};

const createDetector = async (): Promise<Detect> => {
  const Native = (window as { BarcodeDetector?: BarcodeDetectorClass })
    .BarcodeDetector;
  if (Native && (await Native.getSupportedFormats()).includes("qr_code")) {
    const detector = new Native({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }

  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!context || video.videoWidth === 0) return null;
    // A smaller frame is plenty for a code held up to the camera, and much faster to read.
    const scale = Math.min(
      1,
      720 / Math.max(video.videoWidth, video.videoHeight),
    );
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    return (
      jsQR(frame.data, frame.width, frame.height, {
        inversionAttempts: "dontInvert",
      })?.data ?? null
    );
  };
};

// Starts the camera and calls onCode for every code it reads until the returned stop
// function is called. Rejects with a ScannerError if the camera can't be used.
export const startQrScanner = async (
  video: HTMLVideoElement,
  onCode: (text: string) => void,
): Promise<() => void> => {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
  } catch (error) {
    throw (
      error instanceof DOMException &&
      (error.name === "NotAllowedError" || error.name === "SecurityError")
        ? "denied"
        : "unavailable"
    ) satisfies ScannerError;
  }

  let stopped = false;
  let timer: number | undefined;
  const stop = () => {
    stopped = true;
    window.clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };

  try {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    const detect = await createDetector();
    const tick = async () => {
      if (stopped) return;
      try {
        const text = await detect(video);
        if (text && !stopped) onCode(text);
      } catch {
        // A frame that can't be read; try the next one.
      }
      if (!stopped) timer = window.setTimeout(tick, 150);
    };
    void tick();
  } catch {
    stop();
    throw "unavailable" satisfies ScannerError;
  }

  return stop;
};
