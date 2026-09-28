# AMDATA — Data Reselling App

Cikakken app na saye da sayar da Data/Airtime, tare da:
- Rajista/Shiga (bcrypt password hashing + JWT)
- Wallet + ledger na kowace transaction
- Sayen data ta VTpass (MTN, Airtel, Glo, 9mobile)
- Cajen wallet ta Paystack
- Admin dashboard (users, stats, daidaita wallet)
- PWA — ana iya "Install" a Android kai tsaye daga browser

Backend: Node.js + Express + PostgreSQL
Frontend: PWA (HTML/CSS/JS, babu framework — sauki don gyara)

---

## 1. Abin da kake bukata kafin fara aiki

### a) Paystack (don karban kudi cikin wallet)
1. Je zuwa https://dashboard.paystack.com/#/signup ka bude account (free).
2. Bayan ka shiga, je **Settings → API Keys & Webhooks**.
3. Ka kwafi **Test Secret Key** (`sk_test_...`) da **Test Public Key** (`pk_test_...`).
4. Zaka fara da Test keys — babu wani kudi na gaske da zai tafi har sai ka canza zuwa Live keys daga baya.

### b) VTpass (don siyan data daga network)
1. Je zuwa https://vtpass.com/ ka bude account.
2. Don gwaji kafin ka fara aiki na gaske, yi amfani da https://sandbox.vtpass.com — akwai sabon account daban don sandbox (duba VTpass documentation don yadda za a samu sandbox credentials, http://sandbox.vtpass.com/documentation).
3. A VTpass dashboard, je **API** section ka samo: `api-key` (Public Key) da `secret-key` (Secret Key).
4. Idan an gama gwaji sosai, za ka canza `VTPASS_BASE_URL` zuwa `https://vtpass.com/api` (live) ka kuma yi amfani da live keys.

---

## 2. Ina za a yi hosting?

Shawarar da na fi bayarwa ga wanda ke fara aiki (mai sauki, kuma yana da free tier):

**Render.com** — zaka iya samun kai tsaye a wuri daya:
- Web Service (backend Node.js) — kyauta ko $7/wata don ci gaba da gudana ba tare da barci ba
- PostgreSQL database — akwai free tier

Matakai:
1. Buga code din zuwa GitHub repo (private ko public).
2. A Render.com, danna **New → PostgreSQL**, ka bar shi ya kirkiri database, ka kwafi "Internal Database URL".
3. Danna **New → Web Service**, ka hade shi da GitHub repo dinka, ka zabi `backend` a matsayin root directory.
4. Build command: `npm install` · Start command: `npm start`
5. A **Environment** tab, ka sanya duk abubuwan da ke cikin `.env.example` (DATABASE_URL daga mataki na 2, JWT_SECRET, PAYSTACK keys, VTPASS keys, da sauransu).
6. Danna Deploy. Bayan minti kadan, app dinka zai kasance akan wani link kamar `https://amdata.onrender.com`.

**Madadin:** Railway.app yana aiki iri daya (Node.js + PostgreSQL a wuri daya, mai sauki).

---

## 3. Gudanarwa a gida (local development)

```bash
cd backend
npm install
cp .env.example .env
# buga dukkan sirrikan API keys a cikin .env
npm run dev
```

Bude http://localhost:5000 a browser — frontend din yana gudana daga wannan server din din kansa.

---

## 4. Yadda tsarin database yake (PostgreSQL)

An zabi PostgreSQL saboda:
- Free tier akwai a Render/Railway/Neon
- Ya dace sosai da alaka tsakanin users ↔ wallets ↔ transactions ↔ orders (ledger integrity)
- Yana amfani da "transactions" (BEGIN/COMMIT) wajen cire kudi daga wallet, don kada mutum biyu su iya cin kudi sau biyu a lokaci guda

Ba sai ka kirkiri tables da kanka ba — `backend/src/db.js` yana kirkiro su kai tsaye idan basu wanzu ba, duk lokacin da server ya tashi.

---

## 5. Admin account

Don yin rajistar admin na farko:
1. A `.env`, sanya `ADMIN_SIGNUP_CODE` zuwa wani sirrin lamba/kalma.
2. A shafin register (ko ta Postman/curl zuwa `/api/auth/register`), sanya filin `admin_code` daidai da wancan sirrin — sabon account zai zama admin.
3. Bayan haka, kar a raba wannan code — kawai amfani da shi sau daya don kirkiri admin na farko, sauran za a iya kara su daga admin dashboard nan gaba (ana iya kara wannan feature idan an bukata).

Admin zai iya shiga ta http://your-app-url/admin.html bayan ya login.

---

## 6. Mayar da PWA zuwa APK (Android app)

Bayan an gama deploy (app dinka yana da live URL, misali `https://amdata.onrender.com`):

**Zabi mafi sauki — PWABuilder (kyauta, babu coding):**
1. Je zuwa https://www.pwabuilder.com
2. Buga URL na app dinka (dole ya zama HTTPS live link, ba localhost ba)
3. Danna "Start" — zai duba `manifest.json` da `service-worker.js` dinka (mun riga mun shirya su)
4. Zabi **Android** → zai bada maka `.apk` ko `.aab` file wanda za ka iya girka ko turawa Google Play Store

**Madadin — Capacitor (idan kana son karin gyara ta hanyar code):**
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init AMDATA com.yourcompany.amdata
npx cap add android
npx cap open android
```

---

## 7. Tsarin fayiloli

```
amdata-app/
  backend/
    src/
      server.js          # Babban server
      db.js               # Database schema + connection
      middleware/auth.js  # JWT verification
      routes/
        auth.js            # register, login
        wallet.js           # balance, fund (Paystack), ledger
        data.js              # data plans + purchase (VTpass)
        admin.js              # stats, users, adjust wallet
      utils/
        paystack.js
        vtpass.js
    package.json
    .env.example
  frontend/
    index.html, login.html, register.html, dashboard.html, admin.html
    payment-callback.html   # bayan Paystack redirect
    manifest.json, service-worker.js
    css/style.css
    js/app.js
    icons/
```

---

## 8. Abubuwan da za a iya kara gaba (idan kana bukata)

- Tabbatar da lambar waya/imel ta OTP kafin login
- "Forgot password" flow ta imel
- Paystack webhook (a matsayin backup ga verify endpoint, don kada a rasa wani credit idan mai amfani bai koma zuwa app ba)
- Push notifications
- Bonus/referral system
- Auto price markup akan farashin VTpass (misali, VTpass ya baka ₦490, ka sayar akan ₦500)

Idan kana son wani daga cikin wadannan, gaya mani, zan kara masa.
