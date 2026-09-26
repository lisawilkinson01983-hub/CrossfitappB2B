export type VideoInfo = { duration: number; thumbnail: Blob | null };

/**
 * Reads a video file's duration and captures a frame near its start as a
 * JPEG thumbnail — all in the browser, without uploading it. Used both to
 * enforce the length limit client-side and to give <video> a poster image
 * (without one, it just shows a black box until played).
 */
export function readVideoInfo(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => URL.revokeObjectURL(video.src);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      // A hair past the very start — a phone recording's first frame is
      // sometimes solid black during exposure ramp-up.
      video.currentTime = Math.min(0.1, duration / 2);

      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || canvas.width === 0 || canvas.height === 0) {
          cleanup();
          resolve({ duration, thumbnail: null });
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve({ duration, thumbnail: blob });
          },
          "image/jpeg",
          0.8
        );
      };
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not read video"));
    };
    video.src = URL.createObjectURL(file);
  });
}
