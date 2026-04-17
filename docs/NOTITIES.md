# CausalNet — Productnotities

Lopend document met uitleg, beslissingen en achtergrond bij de ontwikkeling van CausalNet.
Bedoeld om te delen met collega's in overleg.

---

## Inhoud

1. [Concepten](#concepten)
2. [Ontwerpkeuzes](#ontwerpkeuzes)

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
