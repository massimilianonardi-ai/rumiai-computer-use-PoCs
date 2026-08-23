# ComputerUse agent-ctrl — macOS Apple Silicon

Laboratorio portabile usato per i test di **Computer Use di RumiAI** su macOS Apple Silicon.

Questo progetto non vuole ancora essere l'architettura definitiva: raccoglie in un unico albero i componenti che abbiamo verificato sul campo, in modo da poter ripetere rapidamente benchmark ed esperimenti senza dipendere da installazioni globali.

## Stack attualmente usato dal PoC Computer Use

Il test corrente usa:

- **Node.js** per `app/agent-loop.js`
- **agent-ctrl 0.1.4** come livello di percezione/esecuzione macOS Accessibility
- **Ollama** come server LLM locale
- **ministral-3:3b** come piccolo modello locale

Il PoC corrente non usa vision, OCR o coordinate generate dal LLM.

Nel progetto sono presenti anche **micromamba** e **ComfyUI**, mantenuti come componenti del laboratorio già sperimentati. Non sono dipendenze del test Computer Use corrente.

## Struttura principale

```text
app/       codice dei PoC/test
bin/       runtime e binari locali
cmd/       installazione, environment, start/stop e diagnostica
srv/       software/server installati localmente
home/      HOME e cache isolate del progetto
log/       log dei servizi
run/       PID e stato runtime dei servizi
data/      dati applicativi
models/    fallback locale per i modelli
```

Se esiste `/Volumes/AI-Models`, `cmd/env` usa attualmente:

```text
/Volumes/AI-Models/models
```

come `MODEL_ROOT`/`MODELS_DIR`. Di conseguenza lo store Ollama è:

```text
/Volumes/AI-Models/models/ollama
```

In assenza del volume esterno, viene usata la directory `models/` interna al progetto.

## Diagnostica

Prima di un benchmark è utile eseguire:

```bash
cmd/doctor
```

Il doctor controlla senza installare o aggiornare componenti:

- Node.js
- sintassi di `app/agent-loop.js`
- agent-ctrl e `agent-ctrl doctor`
- Ollama
- stato dei servizi Ollama/ComfyUI
- raggiungibilità API Ollama
- disponibilità di `ministral-3:3b`
- path effettivo dei modelli
- presenza opzionale di micromamba e ComfyUI

Le assenze di micromamba/ComfyUI sono solo warning perché non bloccano il Computer Use.

## Installazione dei componenti principali

Gli script installano i componenti all'interno del progetto.

```bash
cmd/nodejs-install
cmd/agent-ctrl-install
cmd/ollama-install
cmd/ollama-update-models
```

`agent-ctrl-install` è volutamente fissato alla versione **0.1.4**, cioè quella utilizzata nei benchmark validati finora.

Per aggiornare/scaricare il modello usato dal PoC:

```bash
cmd/ollama-update-models
```

## Avvio del test Computer Use

```bash
cmd/agent-ctrl-start-cu-test
```

Lo script verifica/installabile Node.js e agent-ctrl, avvia Ollama tramite il service wrapper e lancia:

```text
app/agent-loop.js
```

### Gestione del servizio Ollama

`srv-start` e `srv-stop` tengono traccia di chi ha realmente avviato un servizio.

Se il test trova Ollama già in esecuzione:

```text
srv-start ollama
```

lo riusa e **non ne acquisisce la proprietà**. Alla fine del test, `srv-stop ollama` lo lascia quindi attivo.

Se invece il test ha avviato Ollama, lo fermerà normalmente alla propria uscita.

Sono inoltre gestiti automaticamente i PID file stale.

Comandi manuali:

```bash
cmd/srv-start ollama
cmd/srv-stop ollama
```

Per fermare esplicitamente un servizio avviato da un altro processo/sessione:

```bash
cmd/srv-stop --force ollama
```

I log dei servizi sono in:

```text
log/<servizio>.log
```

## Permessi macOS

`agent-ctrl` richiede il permesso **Accessibilità** di macOS.

Per il PoC senza vision non è necessario Screen Recording, salvo test che introducano esplicitamente screenshot o altre funzioni che lo richiedano.

Verifica lo stato con:

```bash
cmd/doctor
```

oppure direttamente:

```bash
agent-ctrl doctor
```

## Benchmark Computer Use validati

Il PoC contenuto in `app/agent-loop.js` deriva dalla serie di esperimenti fino alla v13 e usa il modello:

```text
linguaggio naturale
    ↓
planner LLM locale
    ↓
piano di intenti semantici
    ↓
executor deterministici
    ↓
resolver semantico
    ↓
agent-ctrl / macOS Accessibility
    ↓
nuova osservazione e verifica
```

Esempi di task usati durante i test:

```text
Open System Settings, search for Bluetooth, then open the Bluetooth result.
```

```text
Open Safari, search for OpenAI, then open the first result.
```

Il secondo benchmark ha anche evidenziato i limiti attuali della percezione AX del contenuto web: questo è materiale di test utile e non viene nascosto o aggirato nel packaging corrente.

## Componenti opzionali del laboratorio

### micromamba

```bash
cmd/micromamba-install
```

Utility disponibili:

```text
cmd/micromamba-run
cmd/micromamba-python
cmd/micromamba-pip
```

### ComfyUI

```bash
cmd/comfyui-install
cmd/comfyui-start
```

oppure:

```bash
cmd/comfyui-start-use-split-cross-attention
```

Questi componenti vengono mantenuti perché fanno parte dei pezzi funzionanti già sperimentati, ma sono indipendenti dal PoC Computer Use corrente.

## Filosofia di questo repository

Per ora la priorità è:

1. mantenere insieme i pezzi funzionanti;
2. poter ripetere rapidamente i test;
3. evitare dipendenze globali non necessarie;
4. conservare i comportamenti già validati;
5. rimandare modularizzazione e ottimizzazione architetturale alla fase successiva.

Non è quindi intenzionale fare refactoring solo per eleganza finché non serve ai benchmark.
