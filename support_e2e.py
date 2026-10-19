"""Accounts, tickets, stories and the WhatsApp button — in a real browser.

    SMS_MOCK_LOG=/tmp/sms.log php -S 127.0.0.1:8139 tests/sms_mock.php
    TIFFANY_DATA=/tmp/tf-e2e php -d upload_max_filesize=8M -d post_max_size=20M -S localhost:8135 -t .
    SMS_MOCK_LOG=/tmp/sms.log TIFFANY_DATA=/tmp/tf-e2e python3 support_e2e.py http://localhost:8135

The data folder needs catalog-import.json (the real catalogue) and an
sms.json pointing at the stand-in; this script sets the two template ids.
Chromium runs with a fake microphone, so voice notes are really recorded."""
import io
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse

import requests
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8135').rstrip('/')
DATA = os.environ['TIFFANY_DATA']
MOCK = os.environ['SMS_MOCK_LOG']
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
PHONE = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
QUIET = ("try{localStorage.setItem('tiffany.a2hs','{\"done\":true}');"
         "sessionStorage.setItem('tiffany.consent.later','later')}catch(e){}")
SHOTS = os.environ.get('SHOTS', '/tmp/support-shots')
os.makedirs(SHOTS, exist_ok=True)
ok = bad = 0
errors = []


def check(name, cond, extra=''):
    global ok, bad
    if cond:
        ok += 1
        print('  ok  ', name)
    else:
        bad += 1
        print('  FAIL', name, extra)


def sql(q, *a):
    con = sqlite3.connect(os.path.join(DATA, 'tiffany.sqlite'), timeout=20)
    try:
        rows = con.execute(q, a).fetchall()
        con.commit()
        return rows
    finally:
        con.close()


def sms():
    try:
        return [x for x in map(json.loads, open(MOCK).read().splitlines()) if x['path'] == '/v1/send/verify']
    except FileNotFoundError:
        return []


def code_for(phone):
    for x in reversed(sms()):
        if x['body']['mobile'] == phone and x['body']['templateId'] == 555001:
            return x['body']['parameters'][0]['value']
    return None


def overflow(page):
    """Anything wider than the phone (a page that scrolls sideways)."""
    return page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')


def shot(page, name, full=False):
    page.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=full)


def ready(page):
    page.wait_for_selector('#boot', state='detached', timeout=15000)


requests.get(BASE + '/api/catalog.php')        # the database and the real catalogue
sql("INSERT OR REPLACE INTO settings (k, v) VALUES ('sms_tpl_otp', '555001')")
sql("INSERT OR REPLACE INTO settings (k, v) VALUES ('sms_tpl_ticket', '555002')")
panel = requests.Session()
panel.post(BASE + '/api/admin.php', json={'a': 'state'})
key = re.search(r'[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}', open(os.path.join(DATA, 'SETUP-KEY.txt')).read()).group(0)
assert panel.post(BASE + '/api/admin.php', json={'a': 'setup', 'key': key, 'name': 'آمیر وندا', 'email': 'ceo@tiffany.test',
                                                  'password': 'ceo-pass-123'}).status_code == 200
photo = io.BytesIO()
Image.new('RGB', (1500, 1100), (120, 30, 60)).save(photo, 'JPEG', quality=90)
open(os.path.join(SHOTS, 'photo.jpg'), 'wb').write(photo.getvalue())
story = io.BytesIO()
Image.new('RGB', (1080, 1920), (200, 120, 60)).save(story, 'JPEG', quality=90)
open(os.path.join(SHOTS, 'story.jpg'), 'wb').write(story.getvalue())

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME,
                                 args=['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])

    def phone():
        ctx = browser.new_context(**PHONE)
        ctx.add_init_script(QUIET)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        return ctx, page

    print('\nWhatsApp on every product page')
    ctx, page = phone()
    page.goto(BASE + '/#/p/oiled-leather-jacket', wait_until='domcontentloaded')
    ready(page)
    page.wait_for_selector('.wa-ask')
    href = page.get_attribute('.wa-ask', 'href')
    text = urllib.parse.parse_qs(urllib.parse.urlparse(href).query).get('text', [''])[0]
    check('«استعلام محصول» is on the product page', 'استعلام محصول' in page.inner_text('.wa-ask'))
    check('…and opens WhatsApp with 0935 211 8977', href.startswith('https://wa.me/989352118977?text='), href[:60])
    check('…with the piece and its own page already written', 'کاپشن چرم' in text and text.rstrip().endswith('/p/oiled-leather-jacket'), text)
    check('…in a new tab', page.get_attribute('.wa-ask', 'target') == '_blank')
    ids = [p['id'] for p in requests.get(BASE + '/api/catalog.php').json()['products']]
    seen = 0
    for pid in ids:
        page.goto(f'{BASE}/#/p/{pid}')
        page.wait_for_selector('.wa-ask')
        seen += urllib.parse.parse_qs(urllib.parse.urlparse(page.get_attribute('.wa-ask', 'href')).query)['text'][0].rstrip().endswith(f'/p/{pid}')
    check(f'…on every piece in the catalogue ({len(ids)}), each naming its own link', seen == len(ids), f'{seen}/{len(ids)}')
    shot(page, '01-whatsapp')

    print('\nthe Tickets tab, signed out')
    page.goto(BASE + '/#/shop')
    page.wait_for_selector('.tabbar:not(.hide)')
    check('six tabs, Tickets before Profile', page.evaluate(
        "[...document.querySelectorAll('.tab-label')].map(e=>e.textContent).join()") == 'Home,Shop,Bag,Orders,Tickets,Profile')
    page.click('.tab[data-tab="tickets"]')
    page.wait_for_selector('[data-tk="signin"]')
    check('signed out: sign-in and sign-up, and WhatsApp as the other way', page.locator('[data-tk="signup"]').count() == 1
          and 'wa.me/989352118977' in page.get_attribute('.wa-line', 'href'))
    shot(page, '02-tickets-signed-out')

    print('\nsigning up with the SMS code')
    page.click('[data-tk="signup"]')
    page.wait_for_selector('.auth-tabs')
    check('the sign-up sheet: two tabs, «ساخت حساب» chosen, step 1 of 2 lit',
          page.inner_text('.auth-tabs [aria-selected="true"]').strip() == 'ساخت حساب'
          and page.locator('.auth-steps li').count() == 2 and page.locator('.auth-steps li.on').count() == 1
          and 'اطلاعات تو' in page.inner_text('.auth-steps li.on'))
    check('…the password can be shown and hidden', page.locator('#ac-password').get_attribute('type') == 'password')
    page.click('.pw-eye')
    check('…(shown)', page.locator('#ac-password').get_attribute('type') == 'text')
    page.click('.pw-eye')
    check('…the sheet fits the phone', overflow(page) <= 0)
    shot(page, '02b-signup-sheet')
    page.fill('#ac-name', 'مریم احمدی')
    page.fill('#ac-phone', '۰۹۱۲ ۱۱۱ ۲۲۳۳')
    page.fill('#ac-password', '123')
    page.click('#acForm [type=submit]')
    page.wait_for_selector('[data-field="password"].err')
    check('a short password is caught under its field, before any SMS', 'حداقل ۶' in page.inner_text('[data-field="password"] .field-msg')
          and not sms())
    page.fill('#ac-password', 'tiffany-1')
    page.click('#acForm [type=submit]')
    page.wait_for_selector('#ac-code')
    check('…then step 2 of 2: the code', 'کد پیامکی' in page.inner_text('.auth-steps li.on')
          and page.locator('.auth-steps li.done').count() == 1)
    check('the code is texted to the number typed in Persian digits', code_for('09121112233') is not None)
    check('the code box fills from the SMS (one-time-code)', page.get_attribute('#ac-code', 'autocomplete') == 'one-time-code')
    check('resend waits a minute', page.locator('#acResend').is_disabled())
    shot(page, '03-code')
    page.fill('#ac-code', '00000' if code_for('09121112233') != '00000' else '11111')
    page.click('#acCode [type=submit]')
    page.wait_for_selector('[data-field="code"].err')
    check('a wrong code says so', 'درست نیست' in page.inner_text('[data-field="code"] .field-msg'))
    page.fill('#ac-code', code_for('09121112233'))       # six digits submit by themselves
    page.wait_for_selector('.tk-new', timeout=8000)
    check('six digits sign up and sign in: the tickets list opens', page.locator('.tk-new').is_visible())
    st = page.evaluate("JSON.parse(localStorage.getItem('tiffany.v1'))")
    check('checkout will be filled with the account name and number', st['profile']['name'] == 'مریم احمدی'
          and st['profile']['phone'] == '09121112233', str(st['profile']))
    check('the sign-in cookie is HttpOnly (no script can read it)', 'tf_shop' not in page.evaluate('document.cookie'))

    print('\na new ticket: words, a photo, a piece')
    page.click('.tk-new')
    page.wait_for_selector('#compText')
    check('new-ticket page fits the phone', overflow(page) <= 0)
    page.fill('#tkSubj', 'سایز کاپشن')
    page.fill('#compText', 'سلام، کاپشن چرم سایز M هم دارید؟')
    page.set_input_files('#compFile', os.path.join(SHOTS, 'photo.jpg'))
    page.click('[data-c="product"]')
    page.wait_for_selector('#pickQ')
    page.fill('#pickQ', 'کاپشن چرم')
    page.click('.pick-row >> nth=0')
    page.wait_for_selector('.chip-c >> nth=1')
    check('the photo and the piece wait as chips', page.locator('.chip-c').count() == 2)
    shot(page, '04-new-ticket')
    page.click('[data-c="send"]')
    page.wait_for_selector('.msg.mine', timeout=10000)
    page.wait_for_function("location.hash.startsWith('#/tickets/T-')")
    code = page.evaluate("location.hash.split('/')[2]")
    check('sent: the thread opens on its own code', re.fullmatch(r'T-\d{5}', code or '') is not None, page.url)
    check('…the message carries the photo and the piece', page.locator('.msg.mine .msg-img img').count() == 1
          and 'کاپشن چرم' in page.inner_text('.msg.mine .msg-prod'))
    page.wait_for_function("document.querySelector('.msg-img img').naturalWidth > 0")
    check('…and the photo loads through its signed link', page.evaluate("document.querySelector('.msg-img img').naturalWidth") == 1500)
    check('…waiting for the team', 'در انتظار پاسخ' in page.inner_text('#tkStatus'))
    check('the thread has a back arrow from the start', page.locator('#topbarBack').is_visible())
    check('the thread fits the phone', overflow(page) <= 0)

    print('\na voice note')
    check('an empty reply box offers the microphone, not send', page.locator('[data-c="mic"]').is_visible()
          and not page.locator('[data-c="send"]').is_visible())
    page.click('[data-c="mic"]')
    page.wait_for_selector('#compRec:not([hidden])')
    time.sleep(2.3)
    page.click('[data-c="rec-stop"]')
    page.wait_for_selector('.chip-voice')
    check('recorded: a voice chip, and now send shows', page.locator('[data-c="send"]').is_visible())
    shot(page, '05-voice')
    page.click('[data-c="send"]')
    page.wait_for_function("document.querySelectorAll('.msg.mine').length === 2", timeout=10000)
    check('the voice note is in the thread with a player', page.locator('.msg.mine audio').count() == 1)
    secs = sql("SELECT secs, voice, mime FROM ticket_files WHERE voice = 1")
    check('…stored as a voice note with its length', secs and secs[0][1] == 1 and 1 <= secs[0][0] <= 4
          and secs[0][2] in ('audio/webm', 'audio/ogg', 'audio/mp4'), str(secs))
    shot(page, '06-thread')

    print('\nthe team answers in the panel')
    dt = browser.new_context(viewport={'width': 1280, 'height': 860})
    pp = dt.new_page()
    pp.on('pageerror', lambda e: errors.append('panel: ' + str(e)))
    pp.goto(BASE + '/admin/')
    pp.wait_for_selector('#f-email')
    pp.fill('#f-email', 'ceo@tiffany.test')
    pp.fill('#f-password', 'ceo-pass-123')
    pp.click('button[type=submit]')
    pp.wait_for_selector('#main .greet')
    pp.wait_for_selector('#navTBadge:not([hidden])', timeout=8000)
    check('the panel badge counts the waiting ticket', pp.inner_text('#navTBadge') == '۱')
    pp.click('[data-nav="tickets"]')
    pp.wait_for_selector('.tk-it')
    check('the list shows the customer and number', 'مریم احمدی' in pp.inner_text('.tk-it')
          and '09121112233' in pp.inner_text('.tk-it'))
    pp.click('.tk-it')
    pp.wait_for_selector('.tm.cust')
    check('the thread shows the photo, the piece and the voice note', pp.locator('.tm-img').count() == 1
          and pp.locator('.tm-prod').count() == 1 and pp.locator('.tm audio').count() == 1)
    check('…and who the customer is', '09121112233' in pp.inner_text('.tk-cust'))
    check('…and that the answer will be texted', 'پیامک خبردار' in pp.inner_text('#tnote'))
    shot(pp, '07-panel-thread', full=True)
    before = len(sms())
    pp.fill('#f-body', 'سلام مریم جان، بله سایز M موجوده.')
    pp.set_input_files('#tfile', os.path.join(SHOTS, 'photo.jpg'))
    pp.click('#tsend')
    pp.wait_for_function("document.querySelectorAll('.tm.staff').length === 1", timeout=10000)
    check('answered: status «جواب داده شد»', 'جواب داده شد' in pp.inner_text('#tkPill'))
    time.sleep(0.8)
    tx = [x for x in sms()[before:] if x['body']['templateId'] == 555002]
    check('the customer is texted that there is an answer', len(tx) == 1 and tx[0]['body']['mobile'] == '09121112233'
          and tx[0]['body']['parameters'][1]['value'] == code, str(tx))

    print('\nthe customer sees it')
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    page.goto(BASE + '/#/tickets')
    page.wait_for_selector('.tk-item')
    page.wait_for_selector('.tab[data-tab="tickets"] .tab-dot:not([hidden])', timeout=8000)
    check('a dot on the Tickets tab', page.inner_text('.tab[data-tab="tickets"] .tab-dot') == '۱')
    check('the list marks the ticket unread, answered', page.locator('.tk-item.unread').count() == 1
          and 'پاسخ داده شد' in page.inner_text('.tk-item'))
    shot(page, '08-list-answered')
    page.click('.tk-item')
    page.wait_for_selector('.msg.theirs')
    check('the answer reads «تیم تیفانی», never a staff name', 'تیم تیفانی' in page.inner_text('.msg.theirs')
          and 'آمیر' not in page.inner_text('.msg.theirs'))
    page.wait_for_selector('.tab[data-tab="tickets"] .tab-dot[hidden]', state='attached', timeout=8000)
    check('opening it clears the dot', page.locator('.tab[data-tab="tickets"] .tab-dot').is_hidden())
    page.click('#tkClose')
    page.wait_for_function("document.querySelector('#tkStatus').textContent.includes('بسته')")
    check('the customer closes it', 'بسته شد' in page.inner_text('#tkStatus'))

    print('\nprofile, sign out, forgotten password')
    page.goto(BASE + '/#/profile')
    page.wait_for_selector('.phead')
    check('the profile header is the account (name, number, confirmed)', 'مریم احمدی' in page.inner_text('.phead')
          and 'تأییدشده' in page.inner_text('.phead'))
    page.click('[data-act="account"]')
    page.click('#acOut')
    page.wait_for_selector('.acct-box')
    two = page.eval_on_selector_all('.acct-two .btn', 'e => e.map(x => x.textContent.trim())')
    check('signed out: what an account is for, then «ورود» and «ساخت حساب» side by side',
          two == ['ورود', 'ساخت حساب'] and page.locator('.acct-perks li').count() == 3
          and page.locator('.phead .btn').count() == 0, str(two))
    shot(page, '09b-profile-signed-out')
    page.click('.acct-two [data-act="signup"]')
    page.wait_for_selector('.auth-tabs')
    check('«ساخت حساب» opens the sign-up tab', page.inner_text('.auth-tabs [aria-selected="true"]').strip() == 'ساخت حساب')
    page.click('.auth-tabs [data-go="signin"]')
    page.wait_for_selector('.auth-forgot')
    check('…and the tab switches to sign in', page.inner_text('.auth-tabs [aria-selected="true"]').strip() == 'ورود'
          and page.locator('#ac-name').count() == 0)
    page.keyboard.press('Escape')
    page.wait_for_timeout(500)
    page.click('.acct-two [data-act="signin"]')
    page.wait_for_selector('.auth-forgot')
    shot(page, '09c-signin-sheet')
    page.click('[data-go="reset"]')
    page.fill('#ac-phone', '09121112233')
    page.click('#acForm [type=submit]')
    page.wait_for_selector('#ac-code')
    time.sleep(0.3)
    page.fill('#ac-code', code_for('09121112233'))
    page.fill('#ac-password', 'new-pass-77')
    page.click('#acCode [type=submit]')
    page.wait_for_selector('.phead [data-act="account"]', timeout=8000)
    check('a forgotten password is reset by SMS code and signs in', 'مریم احمدی' in page.inner_text('.phead'))
    r = requests.post(BASE + '/api/account.php', json={'a': 'login', 'phone': '09121112233', 'password': 'new-pass-77'})
    check('…the new password works', r.status_code == 200)
    shot(page, '09-profile')

    print('\nstories from the panel')
    pp.click('[data-nav="stories"]')
    pp.wait_for_selector('#stPick')
    pp.set_input_files('#stFile', os.path.join(SHOTS, 'story.jpg'))
    pp.wait_for_selector('#stGo:not([disabled])')
    pp.fill('#f-caption_fa', 'رسید جدید پاییزه')
    pp.click('#stAddItems')
    pp.wait_for_selector('.item.pick')
    pp.click('.item.pick >> nth=0')
    pp.click('#pkok')
    pp.select_option('#stLinkBox [data-lk-kind]', 'url')
    pp.fill('#stLinkBox [data-lk-url]', 'instagram.com/tiffanyiran')
    pp.click('#stGo')
    pp.wait_for_selector('#stLinkBox [data-field="link"].err')
    check('a half-written address is caught in the panel, before anything is sent',
          'https://' in pp.inner_text('#stLinkBox .msg') and not requests.get(BASE + '/api/catalog.php').json()['stories'])
    pp.select_option('#stLinkBox [data-lk-kind]', 'c')
    pp.select_option('#stLinkBox [data-lk-col]', 'aw27-denim-red')
    pp.fill('#stLinkBox [data-lw="fa"]', 'دیدن کالکشن')
    pp.click('#stGo')
    pp.wait_for_selector('.st-card[data-sid]', timeout=10000)
    check('a photo story goes up, with time left and its button', 'ساعت مونده' in pp.inner_text('.st-card[data-sid]')
          and 'دکمه' in pp.inner_text('.st-card[data-sid]'))
    live = requests.get(BASE + '/api/catalog.php').json()['stories']
    check('…the button points at the collection, with its words', live[0]['link'] == {
        'url': '#/c/aw27-denim-red', 'label': {'fa': 'دیدن کالکشن', 'en': '', 'tr': ''}}, str(live[0].get('link')))
    pp.set_input_files('#stFile', 'tests/story-vp8.webm')
    pp.wait_for_selector('#stGo:not([disabled])', timeout=10000)
    pp.click('#stGo')
    pp.wait_for_function("document.querySelectorAll('.st-card[data-sid]').length === 2", timeout=10000)
    live = requests.get(BASE + '/api/catalog.php').json()['stories']
    check('a video story too, with a cover made in the browser', [s['kind'] for s in live] == ['video', 'image']
          and live[0]['poster'] and live[0]['w'] == 360 and live[0]['h'] == 640, str(live)[:200])
    pp.set_input_files('#stFile', 'tests/story-hevc.mp4')
    pp.wait_for_selector('#stGo:not([disabled])', timeout=10000)
    pp.click('#stGo')
    pp.wait_for_selector('[data-field="media"].err', timeout=10000)
    check('an HEVC video is refused, with how to fix it on an iPhone', 'Most Compatible' in pp.inner_text('[data-field="media"] .msg'))
    shot(pp, '10-panel-stories', full=True)

    page.goto(BASE + '/')
    ready(page)
    page.locator('.looks-strip').scroll_into_view_if_needed()
    tiles = page.eval_on_selector_all('.look-tile', 'e => e.map(x => x.className)')
    check('the shop: the two stories first, ringed, then the twenty-two outfit stories', len(tiles) == 24
          and all('unseen' in t for t in tiles[:2]) and not any('live' in t for t in tiles[2:]), str(tiles))
    shot(page, '11-strip')
    page.click('.look-tile >> nth=1')
    page.wait_for_selector('.viewer.open')
    check('the photo story opens with its caption and the piece', 'رسید جدید پاییزه' in page.inner_text('.viewer-slide >> nth=1')
          and page.locator('.viewer-slide >> nth=1').locator('.vitem').count() == 1)
    shot(page, '12-viewer')
    btn = page.locator('.viewer-slide >> nth=1').locator('.vlink')
    check('…and its button, in the words the panel wrote', btn.count() == 1 and btn.inner_text().strip() == 'دیدن کالکشن')
    page.evaluate("document.querySelector('#viewerTrack').scrollLeft = 0")
    page.wait_for_function("(() => { const v = document.querySelector('.viewer-slide video'); return v && !v.paused })()", timeout=8000)
    check('the video story plays (muted) when it is on screen', page.evaluate("document.querySelector('.viewer-slide video').muted"))
    page.click('.viewer-sound')
    check('…and the speaker turns its sound on', page.evaluate("!document.querySelector('.viewer-slide video').muted"))
    page.click('.viewer-close')
    tiles = page.eval_on_selector_all('.look-tile', 'e => e.map(x => x.className)')
    check('watched stories lose their ring', not any('unseen' in t for t in tiles), str(tiles[:2]))
    page.click('.look-tile >> nth=1')
    page.wait_for_selector('.viewer.open')
    page.locator('.viewer-slide >> nth=1').locator('.vlink').click()
    page.wait_for_function("location.hash === '#/c/aw27-denim-red'", timeout=5000)
    check('the button takes the visitor to the collection, the stories closed',
          page.locator('#viewer.open').count() == 0 and page.locator('.grid-p .card').count() == 9)

    print('\ncampaign stories, changed from the panel')
    pp.on('dialog', lambda d: d.accept())
    pp.click('[data-lid="r2"] [data-look-edit]')
    pp.wait_for_selector('#lkEd')
    check('the editor starts from the story as written', pp.input_value('#lkEd [name="tfa"]') != ''
          and pp.locator('#lkItems .chip').count() >= 1)
    pp.fill('#lkEd [name="tfa"]', 'ست جین روی جین')
    pp.fill('#lkEd [name="cfa"]', 'همه‌ی تیکه‌ها توی شعبه‌ها هست.')
    pp.select_option('#lkLinkBox [data-lk-kind]', 'url')
    pp.fill('#lkLinkBox [data-lk-url]', 'https://instagram.com/tiffanyiran')
    pp.fill('#lkLinkBox [data-lw="fa"]', 'اینستاگرام')
    pp.click('#lkEd [type=submit]')
    pp.wait_for_selector('#lkEd', state='detached')
    pp.wait_for_selector('[data-lid="r2"]')
    check('saved: the card says it was changed and has a button', 'تغییر داده شده' in pp.inner_text('[data-lid="r2"]')
          and 'دکمه' in pp.inner_text('[data-lid="r2"]') and 'ست جین روی جین' in pp.inner_text('[data-lid="r2"]'))
    pp.click('[data-lid="r3"] [data-look-edit]')
    pp.wait_for_selector('#lkEd')
    pp.click('#lkEd .switch')
    pp.click('#lkEd [type=submit]')
    pp.wait_for_selector('#lkEd', state='detached')
    looks = requests.get(BASE + '/api/catalog.php').json()['looks']
    check('the shop gets both changes', looks.get('r2', {}).get('title', {}).get('fa') == 'ست جین روی جین'
          and looks.get('r2', {}).get('link', {}).get('url') == 'https://instagram.com/tiffanyiran'
          and looks.get('r3') == {'hidden': True} and 'items' not in looks['r2'], str(looks)[:300])
    page.goto(BASE + '/#/')
    page.reload()
    ready(page)
    labels = page.eval_on_selector_all('.look-tile', 'e => e.map(x => x.getAttribute("aria-label"))')
    check('the hidden one is off the strip (2 live + 21), the renamed one carries its new title',
          len(labels) == 23 and 'ست جین روی جین' in labels, str(labels[:4]))
    page.click(f'.look-tile >> nth={labels.index("ست جین روی جین")}')
    page.wait_for_selector('.viewer.open')
    a = page.locator('.viewer-slide >> nth=' + str(labels.index('ست جین روی جین'))).locator('a.vlink')
    check('…and its button opens Instagram in a new tab, nothing passed along',
          a.count() == 1 and a.get_attribute('href') == 'https://instagram.com/tiffanyiran'
          and a.get_attribute('target') == '_blank' and a.get_attribute('rel') == 'noopener noreferrer'
          and a.inner_text().strip() == 'اینستاگرام')
    shot(page, '12b-campaign-link')
    page.keyboard.press('Escape')
    for lid in ('r2', 'r3'):
        pp.click(f'[data-lid="{lid}"] [data-look-edit]')
        pp.wait_for_selector('#lkReset')
        pp.click('#lkReset')
        pp.wait_for_selector('#lkEd', state='detached')
        pp.wait_for_selector(f'[data-lid="{lid}"]')
    check('«برگردوندن به حالت اول» undoes both', requests.get(BASE + '/api/catalog.php').json()['looks'] == {})
    sql('UPDATE stories SET expires_at = ?', int(time.time()) - 1)
    page.reload()
    ready(page)
    check('after 24 hours they are gone from the shop', page.locator('.look-tile.live').count() == 0
          and page.locator('.look-tile').count() == 22)
    pp.reload()
    pp.wait_for_selector('.st-card[data-sid]')
    check('…and wait in the panel archive, ready to go up again', 'دوباره، ۲۴ ساعت' in pp.inner_text('main'))

    print('\nnothing broke')
    check('no script errors anywhere', not errors, '\n'.join(errors[:5]))
    browser.close()

print(f'\n{ok} passed, {bad} failed')
sys.exit(1 if bad else 0)
