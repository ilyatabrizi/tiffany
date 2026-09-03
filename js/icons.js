/* One stroked set, 24-grid, currentColor. Nothing here is filled — the whole
   interface is line work until colour is earned. */

const P = {
  home: '<path d="M4 10.6 12 4l8 6.6V19a1.4 1.4 0 0 1-1.4 1.4h-3.2v-5.6H8.6v5.6H5.4A1.4 1.4 0 0 1 4 19z"/>',
  hanger: '<path d="M12 8.4a2.2 2.2 0 1 1 2.2-2.2"/><path d="M12 8.4v2.2"/>'
    + '<path d="M12 10.6 4.3 16a1.5 1.5 0 0 0 .9 2.7h13.6a1.5 1.5 0 0 0 .9-2.7z"/>',
  bag: '<path d="M5.6 8h12.8l.9 11.1a1.4 1.4 0 0 1-1.4 1.5H6.1a1.4 1.4 0 0 1-1.4-1.5z"/>'
    + '<path d="M8.8 10.4V7.2a3.2 3.2 0 0 1 6.4 0v3.2"/>',
  box: '<path d="M3.8 8.2 12 4l8.2 4.2v7.6L12 20l-8.2-4.2z"/><path d="M3.8 8.2 12 12.4l8.2-4.2"/>'
    + '<path d="M12 12.4V20"/>',
  user: '<circle cx="12" cy="8.4" r="3.6"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>',
  heart: '<path d="M12 20.2S3.8 15.4 3.8 9.9a4.4 4.4 0 0 1 8.2-2.2 4.4 4.4 0 0 1 8.2 2.2c0 5.5-8.2 10.3-8.2 10.3z"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevD: '<path d="M5 9l7 7 7-7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M4.5 12.8 9.4 17.6 19.5 7"/>',
  search: '<circle cx="10.8" cy="10.8" r="6"/><path d="M15.2 15.2 20 20"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/>'
    + '<circle cx="10" cy="17" r="2"/>',
  share: '<path d="M12 15.4V4M8.4 7.6 12 4l3.6 3.6"/>'
    + '<path d="M5.6 12.8V19a1.4 1.4 0 0 0 1.4 1.4h10a1.4 1.4 0 0 0 1.4-1.4v-6.2"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="4.6"/><circle cx="12" cy="12" r="3.6"/>'
    + '<circle cx="17.1" cy="6.9" r="1" fill="currentColor" stroke="none"/>',
  trash: '<path d="M5.4 7h13.2M9.6 7V5.4A1.4 1.4 0 0 1 11 4h2a1.4 1.4 0 0 1 1.4 1.4V7"/>'
    + '<path d="M6.9 7l.8 12.2A1.4 1.4 0 0 0 9.1 20.5h5.8a1.4 1.4 0 0 0 1.4-1.3L17.1 7"/>',
  ruler: '<rect x="2.6" y="8.4" width="18.8" height="7.2" rx="1.4"/>'
    + '<path d="M7 8.4v3M11 8.4v4.4M15 8.4v3M19 8.4v4.4"/>',
  truck: '<path d="M2.8 6.8h10.4v10H2.8z"/><path d="M13.2 10.2h3.6l3.4 3.2v3.4h-7z"/>'
    + '<circle cx="7" cy="18.4" r="1.8"/><circle cx="17" cy="18.4" r="1.8"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2.4"/><path d="M3 10.4h18"/>',
  pin: '<path d="M12 21s6.6-6 6.6-10.6a6.6 6.6 0 1 0-13.2 0C5.4 15 12 21 12 21z"/>'
    + '<circle cx="12" cy="10.2" r="2.4"/>',
  sparkle: '<path d="M12 3.6 13.9 9 19.4 11 13.9 13 12 18.4 10.1 13 4.6 11 10.1 9z"/>',
  arrow: '<path d="M4.6 12h14M13.6 7l5 5-5 5"/>',
  download: '<path d="M12 4v11M7.6 10.6 12 15l4.4-4.4"/><path d="M4.6 19.4h14.8"/>',
  info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.2M12 7.9v.2"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.2V12l3.2 2"/>',
  contrast: '<circle cx="12" cy="12" r="8.4"/><path d="M12 3.6a8.4 8.4 0 0 0 0 16.8z" fill="currentColor" stroke="none"/>',
  drop: '<path d="M12 3.4c3.2 3.7 5.4 6.5 5.4 9.2a5.4 5.4 0 0 1-10.8 0c0-2.7 2.2-5.5 5.4-9.2z"/>',
  lock: '<rect x="5" y="10.4" width="14" height="9.6" rx="2.2"/>'
    + '<path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6"/>',
};

export function icon(name, size = 22, cls = '') {
  const d = P[name] || P.info;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}"
    fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
