# CausalNet — Gebruikershandleiding

## Wat is CausalNet?

CausalNet is een wetenschappelijke analysetool die complexe maatschappelijke, klinische of gedragskundige vraagstukken ontleedt in een **causaal factorennetwerk**. Je voert een onderwerp of probleemstelling in, en Claude genereert — met onderbouwing uit de wetenschappelijke literatuur — welke factoren erbij horen, hoe ze samenhangen, en welke interventies volgens het onderzoek effectief zijn. De uitkomst is een interactief netwerk van knopen en lijnen, aangevuld met een leesbaar analyserapport en een lijst geverifieerde bronnen.

---

## Doorloop in drie stappen

### Stap 1 — Onderwerp
Typ je probleemstelling in natuurlijk Nederlands (bijvoorbeeld *"Schooluitval bij jongeren met ADHD"*). Op dit scherm kun je ook een eerder opgeslagen analyse laden.

### Stap 2 — Factoren bevestigen
Claude stelt een set factoren voor, verdeeld over vijf categorieën:

| Type | Wat het betekent | Kleur |
|---|---|---|
| **Hoofddoel** | De centrale uitkomst die je wilt beïnvloeden | Oranje |
| **Doel** | Onderliggende sub-uitkomsten | Groen |
| **Risicofactor** | Factoren die het probleem vergroten | Rood |
| **Beschermende factor** | Factoren die beschermen | Blauw |
| **Versterkende factor** | Factoren die risico's uitvergroten | Paars |

Vink aan wat relevant is. Deselecteren is even belangrijk als selecteren — het netwerk wordt fijnmaziger als je de juiste scope kiest.

### Stap 3 — Bronnen
Kies of de analyse stoelt op:
- **Eigen documenten** — upload PDFs (samen max ~3 MB) en Claude gebruikt alléén deze
- **Gecombineerd** — eigen documenten aangevuld met externe literatuur (standaard)

Klik daarna op **AI Analyse**.

---

## Het netwerk

Na een analyse (2–3 minuten) zie je:

- **Netwerk-tab** — het interactieve causale netwerk
- **Analyse-tab** — het geschreven rapport met inline citaten en DOI-links
- **Data-tab** — de ruwe cijfers

### Hoe lees je het netwerk?

Drie visuele signalen dragen betekenis:

**Grootte van de bollen** → invloedscore
`straal = 6 + invloed × 30 px`. Een invloedscore van 0.85 geeft een duidelijk grotere bol dan 0.45. Het hoofddoel heeft een vaste grootte.

**Dikte van de lijnen** → correlatiesterkte (Pearson-r)
`dikte = 1 + correlatie × 8 px`. Dikke lijnen = robuust verband in de literatuur, dunne lijnen = zwak of gemengd bewijs.

**Afstand tot het midden** → kwadratische relatie met invloed
Hoge invloed (0.95) landt op ~40 px van het centrum; lage invloed (0.05) op ~600 px. Factoren met grote impact komen dus letterlijk dichterbij het hoofddoel te staan.

De verdeling wordt berekend door een **force-directed layout** (physics simulatie): botsingsafweer, veerkrachten richting de doel-afstand, en een langzaam afkoelend dempingsschema. Je kunt bollen vrij verslepen — ook de centrale bol, dan schuift het hele cluster mee.

### Filteren en focussen
- **Correlatie-slider** (linksboven) verbergt lijnen onder een drempel, zo zie je alleen de sterkere verbanden
- **Zijbalk** laat je individuele factoren aan/uit zetten
- **Klikken op een factor** opent opties voor sub-analyse

---

## Sub-analyses: oorzaken en oplossingen

Klik op een factor en kies:

- **🔎 Oorzaken analyseren** — Claude zoekt 5–7 dieperliggende oorzaken en categoriseert ze als *onderliggend*, *versterkend*, *trigger* of *structureel*
- **🔍 Oplossingen analyseren** — 5–7 evidence-based interventies, gecategoriseerd als *interventie*, *beleid*, *omgeving* of *gedrag*

Elke sub-analyse krijgt een eigen tabblad met zijn eigen mini-netwerk, rapport en scores. Je kunt deze:
- **Toevoegen aan het hoofdnetwerk** (📌) — dan worden de sub-knopen mee-gevisualiseerd in het hoofdaanzicht
- **Heranalyseren** met aangepaste bronnen of een ander nodeset

---

## Wetenschappelijke onderbouwing

### Hoe "weet" Claude wat het zegt?

De analyse-prompt instrueert het model expliciet:

> *"Je bent een klinisch-wetenschappelijke expert. Gebruik ALTIJD inline citaten na elke feitelijke claim in het formaat ([Auteur, jaar](https://doi.org/xxxxx)). Gebruik echte, bestaande DOI-links — verzin geen DOIs."*

Het rapport wordt opgebouwd uit vijf verplichte secties:

1. **Causale verbanden** — per factor de richting, het onderliggende mechanisme en de effectgrootte
2. **Centrale knooppunten** — welke factoren fungeren als hefbomen (betweenness-centrality)
3. **Prioritaire interventies** — 5–6 gerangschikte acties met effectgroottes
4. **Risicowaarschuwing** — cascade-effecten en urgente factoren
5. **Wetenschappelijke bronnen** — genummerde referentielijst

### Drie lagen van bronbetrouwbaarheid

Om hallucinatie van DOIs tegen te gaan, combineert CausalNet drie mechanismen:

1. **Semantic Scholar verrijking** — vóór de analyse haalt de tool per factor tot 3 echt bestaande papers op via `api.semanticscholar.org` (gesorteerd op citatiescore). Titels, abstracts en DOIs worden als geverifieerde context aan Claude gegeven, met de instructie deze bij voorkeur te gebruiken.
2. **CrossRef-verificatie** — alle DOIs die Claude uiteindelijk noemt, worden geverifieerd tegen `api.crossref.org`. Ongeldige DOIs worden automatisch vervangen door een Google Scholar-zoeklink.
3. **Eigen documenten** — upload je eigen PDFs, dan worden die prioritair gebruikt (en kun je externe bronnen volledig uitschakelen).

### De correlatiematrix

Naast het tekstrapport vraagt CausalNet Claude om een **aparte JSON-uitvoer** met numerieke invloedsscores en Pearson-correlaties:

- `F{n}_INF` — invloed van factor *n* op het hoofddoel (0.01–0.99)
- `F{n}_G{m}` — correlatie met doel *m* (0.01–0.99 of `null`)

De instructie is strikt: *"Use null for correlations with NO scientific evidence."* Daarmee dwing je dat lege cellen in de matrix geen gegokte waarden zijn, maar erkende onzekerheid. De bollen en lijndiktes in het netwerk zijn directe visualisaties van deze matrix.

### Beperkingen — waarom je altijd moet meelezen

- Claude is een taalmodel, geen meta-analyse. Effectgroottes zijn indicaties uit de literatuur, geen primaire metingen.
- Correlatie is geen causaliteit; de richting van pijlen is gebaseerd op theoretische modellen die Claude uit de literatuur afleidt.
- Ook met Semantic Scholar en CrossRef blijft verificatie aan jou: klik door op DOIs die centraal in je conclusies staan.
- De invloedsscores zijn relatief binnen *dit* netwerk, niet absoluut vergelijkbaar tussen analyses.

---

## Exporteren en bewaren

| Optie | Bestand | Inhoud |
|---|---|---|
| **Opslaan** | `.json` | Volledige analyse inclusief posities en sub-tabs — opnieuw laadbaar |
| **PDF wit** | `.pdf` | Leesbaar rapport met citaten en balkgrafieken |
| **PDF + screenshots** | `.pdf` | Als boven, maar met schermopnames van het hoofd- en sub-netwerk |
| **Word** | `.doc` | Bewerkbaar rapport |
| **Screenshot** | `.png` | Alleen het netwerk |

Opgeslagen bestanden bewaren de exacte positie van de bollen — je kunt dus je layout finetunen en die behouden.

---

## Tips voor goede resultaten

- **Formuleer specifiek**: *"Slaapproblemen bij tieners"* geeft betere factoren dan *"Slaap"*.
- **Kies een scope**: selecteer in stap 2 vooral factoren die je écht wilt onderzoeken — te veel knopen maken het netwerk ruis.
- **Gebruik sub-analyses voor diepte**: begin breed, zoom in op dé factor die uit je hoofdanalyse als hefboom naar voren komt.
- **Controleer de DOIs**: de bronnensectie is goud als je verder wilt lezen, maar klik door op ten minste de meest centrale claims.

---

## Technische noten

- **Model**: Claude Sonnet 4.5, met automatische fallback naar Haiku bij overbelasting.
- **API-sleutel**: optioneel, alleen nodig bij draaien buiten Claude.ai. Wordt uitsluitend lokaal (localStorage) bewaard en alleen naar `api.anthropic.com` gestuurd.
- **Bronnenlimiet**: PDF-uploads samen max ~10 MB. PDFs worden lokaal in de browser omgezet naar platte tekst (via `unpdf`), dus alleen de tekst wordt naar Claude verstuurd — niet de originele bestanden. De écht harde grens is het contextvenster van Claude Sonnet 4 (~200.000 tokens, ca. 2 MB platte tekst). Hou de tokenmeter op het bronnen-scherm in de gaten: boven ~150.000 tokens wordt het krap en kan de analyse langzamer zijn, duurder worden, of kerndetails missen ("needle-in-haystack"-effect).
- **Taal**: alle prompts, uitvoer en UI zijn in het Nederlands.

---

## Technische overweging: overstap naar Anthropic Files API

Momenteel worden PDFs **lokaal in de browser** omgezet naar platte tekst via `unpdf`. Alternatief is de Files API, waarbij de volledige PDF (inclusief figuren, tabellen en scans) naar Anthropic wordt geüpload en door Claude natively wordt gelezen.

### Tokens per pagina

| Methode | Tokens/pagina | Waarom |
|---|---|---|
| Huidige tekst-extractie | ~400–600 | Alleen platte tekst, geen afbeeldingen |
| Files API / document-block | ~1.500–3.000 | Tekst + gerenderde pagina-afbeelding |

### Kosten per sessie (5 PDFs × 20 pagina's, 1 hoofd- + 2 sub-analyses)

| Scenario | Totaal | Toelichting |
|---|---|---|
| Huidige setup | ~$0,90 | Tekst-extractie, geen caching |
| Files API zonder caching | ~$2,25 | 2,5× duurder |
| Files API mét prompt caching | ~$2,80 | Sub-analyses raken cache (90% korting); feitelijk slechts ~€0,50 extra |

Bij 100 sessies per jaar: **€40–135 extra** afhankelijk van cache-gedrag.

### Afweging

| Aspect | Toelichting |
|---|---|
| **Kwaliteitswinst** | Figuren, tabellen, formules en gescande PDFs (image-only) worden bruikbaar — `unpdf` faalt nu op scans en verliest tabelstructuur |
| **Latentie** | Eerste analyse 30–90 sec trager door grotere upload + pre-processing |
| **Request-grootte** | Grotere JSON-body; proxies/CDN's kunnen eerder 413-fouten geven |
| **Aanbeveling** | Zinvol voor onderzoekspapers met veel grafieken/tabellen; niet nodig voor tekstrijke beleidsrapporten |
