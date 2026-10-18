/* A voice note, recorded in the browser. Shared by the shop's tickets and the
   panel (which loads it with import('../js/recorder.js')), so it imports
   nothing and touches no page markup.

   Each browser records in its own format: Chrome and Android make WebM/Opus,
   Safari makes MP4/AAC. The server takes either (api/lib/shop.php) and the
   other side plays what it can; every voice note also has a download link.

     const rec = await record({ max: 300, onTick: (secs) => … });
     const { blob, secs, mime } = await rec.stop();      // or rec.cancel()  */

const TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];

export const canRecord = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

/** Asks for the microphone, then records until stop(), cancel() or `max` seconds. */
export async function record({ max = 300, onTick, onAutoStop } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const type = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
  const mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined);
  const parts = [];
  const t0 = performance.now();
  let tick = 0;
  let done = null;
  const finished = new Promise((r) => { done = r; });
  mr.addEventListener('dataavailable', (e) => { if (e.data && e.data.size) parts.push(e.data); });
  mr.addEventListener('stop', () => {
    stream.getTracks().forEach((t) => t.stop());
    clearInterval(tick);
    done();
  });
  mr.start(500);
  const secs = () => Math.round((performance.now() - t0) / 1000);
  tick = setInterval(() => {
    onTick?.(secs());
    if (secs() >= max && mr.state === 'recording') { mr.stop(); onAutoStop?.(); }
  }, 250);

  return {
    secs,
    async stop() {
      const length = Math.min(secs(), max);
      if (mr.state !== 'inactive') mr.stop();
      await finished;
      const mime = (mr.mimeType || type || 'audio/webm').split(';')[0];
      return { blob: new Blob(parts, { type: mime }), secs: length, mime };
    },
    cancel() {
      if (mr.state !== 'inactive') mr.stop();
      parts.length = 0;
    },
  };
}

/** «۰:۱۴» style, digits left to the caller's formatter. */
export const clock = (s, fmt = String) => `${fmt(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0').replace(/\d/g, (d) => fmt(Number(d)))}`;
