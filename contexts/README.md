# RumiAI runtime contexts

Questa cartella contiene esclusivamente dati JSON caricati dal Context Manager prima della pianificazione. Non contiene codice eseguibile né documentazione dei micro-PoC.

## Contesti correnti

- `generic-gui` — base GUI indipendente dalla piattaforma;
- `macos` — convenzioni macOS, attivo solo su Darwin;
- `linux` — convenzioni Linux senza assumere un backend GUI;
- `system-settings` — conoscenza specifica di macOS System Settings;
- `text-editing` — conoscenza condivisa per attività di editing testuale;
- `textedit` — conoscenza specifica di TextEdit;
- `pulsar` — conoscenza specifica di Pulsar.

Ogni contesto può dichiarare scope, trigger, piattaforme, dipendenze, competenza, conoscenze, regole di pianificazione e un `planner_delta` compatto.

Il Context Manager filtra i contesti per piattaforma, seleziona quelli rilevanti per task e applicazione, espande le dipendenze e mantiene nella sessione i contesti delle applicazioni realmente osservate.

La documentazione delle decisioni architetturali e dei micro-PoC si trova in `docs/micro-pocs/`.
