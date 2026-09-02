/* Add to Home Screen.

   Chrome hands over a beforeinstallprompt event; iOS Safari never will, and
   that is where most of this audience lives — so the fallback is the actual
   three-step instruction, not a dead button. */
import { openSheet, toast } from './ui.js';

let deferred = null;

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
addEventListener('appinstalled', () => { deferred = null; toast('Installed', 'check'); });

export const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export async function promptInstall() {
  if (standalone()) { toast('Already installed', 'check'); return; }
  if (deferred) {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome !== 'accepted') toast('Add it from your profile any time');
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openSheet(`
    <h2>Add TIFFANY to your home screen</h2>
    <p class="lede">It installs without an app store and opens like an app —
      offline, full screen, no browser bar.</p>
    <ol class="steps">
      ${(ios ? [
        'Tap the Share button in Safari’s bottom bar.',
        'Choose <b>Add to Home Screen</b>.',
        'Tap <b>Add</b> — the wordmark lands on your screen.',
      ] : [
        'Open the browser menu (three dots).',
        'Choose <b>Install app</b> or <b>Add to Home screen</b>.',
        'Confirm — the wordmark lands on your screen.',
      ]).map((t, i) => `<li><i>${i + 1}</i><span>${t}</span></li>`).join('')}
    </ol>
    <button class="btn btn-ink btn-block" data-act="sheet-close" type="button">Got it</button>`,
  { label: 'Install' });
}
