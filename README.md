# 📨 Notifier

**Notifier** je Node.js aplikacija za automatsko dohvaćanje i slanje obavijesti s internetskih stranica (ili bilo kojeg portala s obavijestima) na **Discord** putem webhookova.

Program automatski:
-  dohvaća obavijesti za više predmeta (svaki sa svojim URL-om)
-  ponovno se prijavljuje ako sesija istekne
-  sinkronizira kolačiće (`tough-cookie`)
-  podržava *Compound login* sustav (SSO)
-  šalje obavijesti na Discord s poštivanjem *rate limita*
-  automatski kreira sve potrebne konfiguracijske datoteke pri prvom pokretanju


## Značajke

✅ Podrška za praćenje obavijesti s više predmeta       
✅ Automatsko prepoznavanje strukture obavijesti  
✅ Detekcija Compound login sustava  
✅ Pohrana već poslanih obavijesti u lokalne `.json` datoteke  
✅ Rate limit obrada za Discord webhookove  
✅ Interaktivni `setup` pomoću CLI sučelja  [U RAZVOJU]


## ⚙️ Instalacija

1. **Kloniraj repozitorij**
```bash
git clone https://github.com/marioolcar/notifier.git
cd notifier
```

2. **Instaliraj potrebne pakete**
```bash
npm install
```

3. **Pokreni program prvi put (pokreće interaktivni setup)** [U RAZVOJU, trenutno je potrebno napraviti setup ručno]
```bash
node index.js
```

---

## ** Interaktivni vodič pri prvom pokretanju [U RAZVOJU]**
Pri prvom pokretanju, program automatski pokreće interaktivni setup, koji te pita za:

 USERNAME – tvoje korisničko ime za stranicu

 PASSWORD – lozinku za prijavu

 WEBSITE – osnovni URL stranice (npr. https://www.skola.hr)

 Naziv predmeta

 URL obavijesti za taj predmet

 Discord webhook URL

Nakon unosa, automatski se stvaraju:

```bash
.env
/config/subjects.json
/config/endpoints.json
/data/
```
## 📁 Struktura projekta
```yaml
notifier/
├── config/
│   ├── subjects.json        # Popis predmeta i njihovih webhookova
│   └── endpoints.json       # URL-ovi za login i baznu stranicu
├── data/
│   └── obavijesti_<predmet>.json   # Lokalne kopije već obrađenih obavijesti
├── notifier.js              # Glavna aplikacija
├── package.json
├── package-lock.json
└── .env                     # Login podaci i osnovna konfiguracija
```

##  Primjer konfiguracije

`.env`
```env
USERNAME="student123"
PASSWORD="lozinka123"
WEBSITE="https://nastava.skola.hr"
```
`config/subjects.json`
```json
[
  {
    "naziv": "Programsko inženjerstvo",
    "url": "https://nastava.skola.hr/predmet/pi/obavijesti",
    "webhook": "https://discord.com/api/webhooks/XXXX/XXXX"
  }
]
```

`config/endpoints.json`
```json
{
  "baseSite": "https://nastava.skola.hr",
  "loginPage": "https://nastava.skola.hr/login",
  "loginAction": "https://nastava.skola.hr/login"
}
```


##  Kako radi

1. Program se prijavljuje na web stranicu pomoću zadanih korisničkih podataka.
2. Parsira HTML obavijesti pomoću Cheerio.
3. Provjerava postoje li nove obavijesti u odnosu na lokalno spremljene.
4. Nove obavijesti automatski šalje na pripadajući Discord kanal putem webhooka.
5. Ciklus se ponavlja svakih 5 minuta.

 Rukovanje sesijom

Ako sesija istekne ili se pojavi Compound login redirect, program:
- automatski detektira potrebu za ponovnim loginom
- ponovno se prijavljuje bez prekida rada

##  LICENCA

Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)

Ovaj program (Notifier) dostupan je samo za edukativne i nekomercijalne svrhe.
Dozvoljeno je pregledavanje, učenje i mijenjanje koda, uz navođenje autora.

Zabranjena je svaka komercijalna distribucija, prodaja, ili uključivanje ovog koda
u komercijalne projekte bez prethodnog pisanog dopuštenja autora.

© 2025 <Mario Olčar>

## ⚠️ Upozorenje – web scraping i odgovornost

Ovaj program koristi web scraping isključivo u edukativne svrhe.
Autor ne potiče, ne podržava i ne preuzima odgovornost za bilo kakvu zloupotrebu alata.

 Svrha projekta je demonstracija tehnika za dohvaćanje i obradu javno dostupnih informacija.

 Ne koristi se za zaobilaženje autentikacije, plaćenih sadržaja ili kršenje pravila korištenja web stranica.

 Preporučuje se uvijek provjeriti pravila korištenja (Terms of Service) web stranice prije bilo kakvog automatiziranog pristupa.

 Autor ne snosi odgovornost za moguće kršenje zakona, ograničenja pristupa ili uvjeta korištenja od strane korisnika.
