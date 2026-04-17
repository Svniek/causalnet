# CausalNet — Productnotities

Lopend document met uitleg, beslissingen en achtergrond bij de ontwikkeling van CausalNet.
Bedoeld om te delen met collega's in overleg.

---

## Inhoud

1. [Concepten](#concepten)
   - [Verschil tussen correlatiesterkte en invloed](#verschil-tussen-correlatiesterkte-en-invloed-2026-04-17)
   - [Wat er gebeurt als je op AI Analyse klikt](#wat-er-gebeurt-als-je-op-ai-analyse-klikt-2026-04-17)
   - [Wat betekent "eigen wetenschappelijke kennis van het model"?](#wat-betekent-eigen-wetenschappelijke-kennis-van-het-model-2026-04-17)
2. [Ontwerpkeuzes](#ontwerpkeuzes)
   - [Null-correlaties bij ontbrekend bewijs](#null-correlaties-bij-ontbrekend-bewijs-2026-04-17)

---

## Concepten

### Verschil tussen correlatiesterkte en invloed (2026-04-17)

In het factorenmodel werken we met twee fundamenteel verschillende meetwaarden:

#### Correlatiesterkte (r)
- Statistische samenhang tussen **twee variabelen**, gemeten als Pearson's r (0.00–1.00)
- Antwoordt op: *"Als factor A toeneemt, neemt factor B dan ook toe (of af)?"*
- Bidirectioneel — zegt niets over oorzaak/gevolg, louter beschrijvend
- Voorbeeld: r=0.72 tussen "Actieve sociale netwerken" en "Kwaliteit van leven" betekent dat ze sterk samen variëren in de data
- **Zichtbaar in het netwerk als: dikte van de lijn**

#### Invloedscore (%)
- Samengestelde maat voor hoe sterk een factor het *hoofddoel* beïnvloedt, rekening houdend met het hele netwerk
- Antwoordt op: *"Hoe belangrijk is deze factor voor het bereiken van het hoofddoel, alles meegewogen?"*
- Weegt directe én indirecte paden mee (via andere factoren)
- Kijkt ook naar de positie in het netwerk: is de factor een centrale schakel?
- **Zichtbaar in het netwerk als: grootte van de bol en afstand tot het midden**

#### Praktische implicatie
Een factor kan een **hoge invloed** hebben maar een **lage directe correlatie** met het doel — namelijk als hij via andere factoren werkt (indirect pad). In dat geval tekent het systeem terecht geen lijn (geen bewijs voor directe correlatie), maar geeft het wel een hoge invloedscore.

> Voorbeeld: "Sterke familierelaties" met 69% invloed en r=0.05 naar hoofddoel. Geen directe lijn in het netwerk, maar hoge indirecte invloed via sociale netwerken en participatie.

---

### Wat er gebeurt als je op AI Analyse klikt (2026-04-17)

Bij het klikken op **🔬 AI Analyse** voert de app vier stappen achter elkaar uit:

#### Stap 1 — Papers zoeken via Semantic Scholar
Per factor wordt automatisch gezocht naar echte wetenschappelijke papers via de Semantic Scholar API. Dit levert geverifieerde titels, auteurs, jaar, tijdschrift en abstracts op met echte DOI-links.

#### Stap 2 — Analyserapport schrijven (Claude-aanroep 1)
Claude schrijft een uitgebreid wetenschappelijk rapport in het Nederlands, gebaseerd op:
- De gevonden Semantic Scholar papers
- Eventueel toegevoegde eigen bronnen (PDF of URL)
- Wetenschappelijke kennis van het model zelf

Het rapport bevat inline citaten (`[Auteur, jaar](doi-link)`) na elke feitelijke claim en een bronnenlijst aan het einde.

#### Stap 3 — Correlatiematrix berekenen (Claude-aanroep 2)
Een aparte Claude-aanroep vult een JSON-matrix in met twee waarden per factor:
- **`F_INF`** — invloedscore op het hoofddoel (altijd een getal, 0.01–0.99)
- **`F_G0`** — Pearson correlatie met het hoofddoel (`null` als er geen wetenschappelijk bewijs is)

Dit is bewust een aparte aanroep: het model is dan uitsluitend gefocust op getallen, niet op tekst.

#### Stap 4 — Netwerk opbouwen + DOI's verifiëren
- De correlatiematrix wordt omgezet naar **lijnen** in het netwerk — bij `null` geen lijn
- Invloedscores bepalen **bolgrootte** en **afstand tot het midden**
- Alle DOI-links worden geverifieerd via CrossRef API — ongeldige links worden vervangen door een Google Scholar zoekopdracht

#### Totaaloverzicht: 2 Claude-aanroepen + 2 externe API's

| Aanroep | Model | Doel |
|---------|-------|------|
| 1 | claude-sonnet | Tekstrapport schrijven |
| 2 | claude-sonnet | Correlatiematrix vullen |
| Semantic Scholar | — | Echte papers vinden |
| CrossRef | — | DOI-links verifiëren |

---

### Wat betekent "eigen wetenschappelijke kennis van het model"? (2026-04-17)

Claude is getraind op een grote hoeveelheid tekst — waaronder wetenschappelijke artikelen, handboeken en reviewstudies — tot een **kenniscutoff van begin 2024**. Het model kent verbanden uit de literatuur, begrijpt wetenschappelijke begrippen en kan redeneren over oorzaak-gevolgrelaties.

#### Twee belangrijke beperkingen

**1. Hallucinations** — Claude kan referenties verzinnen die niet bestaan. Daarom verifieert CausalNet alle DOI-links via CrossRef, en haalt de app echte papers op via Semantic Scholar vóórdat Claude schrijft.

**2. Verouderd** — Alles na begin 2024 is onbekend voor Claude. Nieuwe inzichten, recentere studies en herziene richtlijnen zitten er niet in.

#### Rol van de eigen kennis in CausalNet

De trainingskennis van Claude fungeert als **achtergrondkennis voor redeneren**, niet als primaire bron:

| Rol | Wat het doet |
|-----|-------------|
| Semantic Scholar | Levert de échte, geverifieerde papers |
| Eigen bronnen (PDF/URL) | Jouw specifieke context |
| Claudes trainingskennis | Verbindt de puzzelstukjes, schrijft coherente analyse, schat verbanden in waar geen paper beschikbaar is |

Het risico zit in dat laatste: als er geen paper gevonden wordt én de eigen kennis als vul wordt gebruikt, is de uitkomst minder betrouwbaar. Vandaar de keuze om `null` te geven bij correlaties zonder bewijs — beter eerlijk over onzekerheid dan een getal verzinnen.

---

### Hoe billing werkt en wat het kost (2026-04-17)

#### Twee scenario's

**Scenario A — Eigen API-sleutel (rechtsboven invoeren)**
De gebruiker betaalt rechtstreeks aan Anthropic. Kosten zijn zichtbaar op [console.anthropic.com](https://console.anthropic.com) → Usage.

**Scenario B — Via Vercel (geen sleutel invoeren)**
De API-sleutel staat op de server (Vercel environment variable). De eigenaar van het Vercel-project betaalt.

#### Welke modellen worden gebruikt

| Model | Wanneer |
|-------|---------|
| `claude-sonnet-4-20250514` | Altijd eerst geprobeerd |
| `claude-haiku-4-5-20251001` | Fallback als Sonnet overbelast is |

#### Kosten per analyse

Elke analyse doet **2 Claude-aanroepen**:

| Aanroep | Doel | Geschatte tokens |
|---------|------|-----------------|
| 1 | Rapport schrijven | ~8.000–25.000 input + ~2.800 output |
| 2 | Correlatiematrix | ~500 input + ~1.200 output |

**Prijzen Anthropic (per miljoen tokens):**

| Model | Input | Output |
|-------|-------|--------|
| Claude Sonnet 4 | $3,00 | $15,00 |
| Claude Haiku 4.5 | $0,80 | $4,00 |

#### Geschatte kosten

| Situatie | Kosten per analyse |
|----------|--------------------|
| Sonnet, met eigen bronnen | ~$0,10 (€0,09) |
| Sonnet, zonder bronnen | ~$0,03–0,05 |
| Haiku (fallback) | ~75% goedkoper, minder nauwkeurig |

**Bij normaal gebruik (5–10 analyses/dag):** $0,50–$1,00 per dag.

> Dit is actiepunt 1 uit de vergadering van 17-4-2026 (Stephan).

---

## Ontwerpkeuzes

### Null-correlaties bij ontbrekend bewijs (2026-04-17)

Het systeem verzint geen correlaties als er geen wetenschappelijk bewijs is.

- Claude geeft `null` terug voor een correlatie als de literatuur geen relatie beschrijft
- `null` → geen lijn in het netwerk, `—` in de datatabel
- De gebruiker kan zelf onderzoek doen en later een bron toevoegen om de correlatie te onderbouwen
- Invloedscores (`F_INF`) zijn altijd verplicht numeriek — die weerspiegelen de totale literatuurbeoordeling

**Reden:** Lage verzonnen waarden (zoals r=0.05) zijn misleidend — ze suggereren een zwak verband terwijl het werkelijk "onbekend" is.

---

*Voeg notities toe door "📝 toevoegen" te typen na een uitleg in de chat.*
