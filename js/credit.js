/* Cashback, the way the shop shows it.

   An order of the minimum or more (its subtotal plus delivery), placed while
   signed in, earns a share (6% unless the back office says otherwise) of the
   amount actually paid as credit. The credit is «on the way» while the order
   is, and spendable once it is delivered; in the bag it comes off the next
   order before paying. The server (api/lib/shop.php) decides every number;
   these are the same sums, so the bag can say them before checkout. */
import { live } from './live.js';
import { account } from './account.js';
import { num, toman } from './util.js';
import { L } from './i18n.js';

export const cbOn = () => Boolean(live.cashback?.on) && live.cashback.pct > 0;

/** «۶٪» / «6%». */
export const pctText = () => L(`${num(live.cashback.pct)}٪`, `${live.cashback.pct}%`, `%${live.cashback.pct}`);
export const minText = () => toman(live.cashback.min);

/* The customer's choice in the bag: spend the credit on this order or keep it.
   It lasts the visit; spending is the default, as asked. */
let spend = true;
export const spending = () => spend;
export const setSpending = (on) => { spend = Boolean(on); };

/** Credit that would come off an order of $gross now. */
export const creditFor = (gross) => (account.user && spend
  ? Math.max(0, Math.min(account.credit.balance, gross)) : 0);

/** Cashback an order of $gross earns when $credit of it is paid with credit. */
export function earns(gross, credit = 0) {
  if (!cbOn() || gross < live.cashback.min) return 0;
  const paid = gross - credit;
  return paid > 0 ? Math.floor((paid * live.cashback.pct) / 100) : 0;
}
