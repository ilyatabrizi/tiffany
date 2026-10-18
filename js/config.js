/* One place for everything the studio might want to change.

   What deliberately stays in Latin script, in every language on this site:
   the wordmark (TIFFANY / BY VANDA), the three collection names, the size
   codes, the Instagram handle, the tab bar, and Alpha's signature. Those are
   names, not words — translating them would be translating a logo. */
import { L } from './i18n.js';

export const BRAND = {
  name: 'TIFFANY',
  sub: 'BY VANDA',
  full: 'TIFFANY by Vanda',
  instagram: 'tiffanyiran',
  instagramUrl: 'https://instagram.com/tiffanyiran',
  country: L('ایران', 'Iran', 'İran'),
  currency: L('تومان', 'Toman', 'Toman'),
  /* Delivery is free on every order and takes three working days at most —
     the studio's own terms, 2026-10-07. */
  shipping: 0,
  deliveryDays: 3,
  since: 1399,
  email: 'Ameervanda@gmail.com',
  /* «استعلام محصول» on every product page opens a WhatsApp chat with the
     studio (sent 2026-10-18: 0935 211 8977). */
  whatsapp: '989352118977',
};

/* The four shops, as the studio sent them. A branch with no landline yet
   simply has no phone line; one with no postal code or hours shows none.
   Digits are written Latin here — the Persian face draws them Persian. */
export const STORES = [
  {
    id: 'teras',
    city: L('تهران', 'Tehran', 'Tahran'),
    name: L('تراس سنتر', 'Terrace Center', 'Terrace Center'),
    address: L('تهران، سعادت‌آباد، میدان کتاب، مجتمع تجاری تراس سنتر، طبقه‌ی دوم',
      'Terrace Center Mall, 2nd floor, Ketab Square, Saadat Abad, Tehran',
      'Terrace Center AVM, 2. kat, Ketab Meydanı, Saadat Abad, Tahran'),
  },
  {
    id: 'laleh',
    city: L('تبریز', 'Tabriz', 'Tebriz'),
    name: L('لاله پارک', 'Laleh Park', 'Laleh Park'),
    address: L('تبریز، میدان فهمیده، مجتمع تجاری لاله پارک، طبقه‌ی اول',
      'Laleh Park Mall, 1st floor, Fahmideh Square, Tabriz',
      'Laleh Park AVM, 1. kat, Fahmideh Meydanı, Tebriz'),
    phone: '041-36600185',
    tel: '+984136600185',
    hours: ['10:00', '22:30'],
    postal: '5158489885',
  },
  {
    id: 'atlas',
    city: L('تبریز', 'Tabriz', 'Tebriz'),
    name: L('اطلس', 'Atlas', 'Atlas'),
    address: L('تبریز، ولیعصر، نگین پارک، مجتمع تجاری اطلس، طبقه‌ی دوم',
      'Atlas Mall, 2nd floor, Negin Park, Valiasr, Tabriz',
      'Atlas AVM, 2. kat, Negin Park, Valiasr, Tebriz'),
    phone: '041-33249176',
    tel: '+984133249176',
    hours: ['10:00', '22:30'],
    postal: '5157638919',
  },
  {
    id: 'valiasr',
    city: L('تبریز', 'Tabriz', 'Tebriz'),
    name: L('ولیعصر', 'Valiasr', 'Valiasr'),
    address: L('تبریز، ولیعصر، فلکه‌ی بزرگ، نرسیده به بانک صادرات',
      'Valiasr, Falakeh Bozorg roundabout, just before Bank Saderat, Tabriz',
      'Valiasr, Falakeh Bozorg kavşağı, Bank Saderat’tan hemen önce, Tebriz'),
    hours: ['10:00', '23:00'],
    postal: '5157933511',
  },
];

export const STORE_KEY = 'tiffany.v1';
