const SENTENCE_END_REGEX = /[.!?]$/;

let pdfAlreadyRendered = false;

/*const DRAG_BORDER_SIZE = 30;*/

/* ===== AUDIO STATE ===== */
const audioState = {
  playing: false,
  volume: 100,
  rate: 1
};

/* ===== READER STATE ===== 
const readerState = {
  words: [],
  index: 0,
  sentenceStart: 0,
  sentenceWords: [],
  sentenceIndex: 0,
  speaking: false
};*/

const readerState = {
  words: [],

  index: 0,              // indice globale
  sentenceStart: 0,      // inizio frase
  sentenceIndex: 0,      // parole già lette NELLA FRASE
  speaking: false
};

let currentLang = "it-IT";

const languageMenu = document.getElementById("languageMenu");
const languageOptions = languageMenu.querySelectorAll("[data-lang]");

if (languageMenu) {
  const defaultLangOption = languageMenu.querySelector(
    `[data-lang="${currentLang}"]`
  );

  if (defaultLangOption) {
    defaultLangOption.classList.add("active-lang");
  }
}

languageOptions.forEach(option => {
  option.addEventListener("click", function (e) {
    e.stopPropagation();

    const selectedLang = this.dataset.lang;
    currentLang = selectedLang;

    languageOptions.forEach(opt => {
      opt.classList.remove("active-lang");
    });

    this.classList.add("active-lang");

    if (tts.playing || tts.paused) {
      startReadingFromIndex(tts.progressIndex ?? readerState.index ?? 0);
    }

    languageMenu.classList.remove("active");
  });
});

let voices = [];

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
}
loadVoices();
window.speechSynthesis.onvoiceschanged = loadVoices;

function pickVoiceForLang(lang) {
  if (!voices.length) return null;

  const l = lang.toLowerCase();
  // prima prova match esatto (es: en-US)
  let v = voices.find(x => (x.lang || "").toLowerCase() === l);
  if (v) return v;

  // poi match per prefisso (es: en)
  const prefix = l.split("-")[0];
  v = voices.find(x => (x.lang || "").toLowerCase().startsWith(prefix));
  return v || null;
}
/*

function setSpeechLanguage(lang) {
  currentLang = lang;

  if (tts.playing || tts.paused) {
    const idx = (tts.progressIndex ?? readerState.index ?? 0);
    startReadingFromIndex(idx);
  }
}*/



const tts = {
  playing: false,
  paused: false,
  queued: 0,
  maxQueue: 4,
  nextIndex: 0,

  currentStart: null,     // start del chunk in corso
  progressIndex: null,    // punto di resume globale
  lastWordIndex: null,    // ultima parola COMPLETATA (globale)
};

function countWords(str) {
  const s = (str || "").trim();
  if (!s) return 0;
  return s.split(/\s+/).length;
}



function synthIsActive() {
  return synth.speaking || synth.pending;
}



/* ===== SPEECH SYNTH ===== */
const synth = window.speechSynthesis;
let currentUtterance = null;

function setSpeechLanguage(lang) {
  currentLang = lang;

  if (tts.playing || tts.paused) {
    // riparte dalla frase corrente (punto sicuro)
    startReadingFromIndex(tts.lastSafeIndex || readerState.index || 0);
  }
}


tts.maxQueue = 4;

function normalizeMathForTTS(text, lang = "it-IT") {
  const it = lang.startsWith("it");
  const en = lang.startsWith("en");

  const dict = it ? {
    // IT
    "∀": " per ogni ",
    "∃": " esiste ",
    "∧": " e ",
    "∨": " o ",
    "¬": " non ",
    "⇒": " implica ",
    "⇐": " è implicato da ",
    "⇔": " se e solo se ",
    "∴": " quindi ",
    "∵": " perché ",
    "∅": " insieme vuoto ",
    "ℕ": " insieme dei naturali ",
    "ℤ": " insieme degli interi ",
    "ℚ": " insieme dei razionali ",
    "ℝ": " insieme dei reali ",

    "±": " più o meno ",
    "∓": " meno o più ",
    "×": " per ",
    "⋅": " per ",
    "·": " per ",
    "÷": " diviso ",
    "∕": " diviso ",
    "√": " radice di ",
    "∑": " sommatoria ",
    "∏": " produttoria ",
    "∫": " integrale ",
    "∞": " infinito ",
    "≈": " circa uguale a ",
    "≃": " circa uguale a ",
    "≅": " congruente a ",
    "≠": " diverso da ",
    "≤": " minore o uguale a ",
    "≥": " maggiore o uguale a ",
    "<": " minore di ",
    ">": " maggiore di ",
    "=": " uguale ",
    "∈": " appartenente a ",
    "∉": " non appartenente a ",
    "⊂": " sottoinsieme di ",
    "⊆": " sottoinsieme o uguale a ",
    "⊃": " contiene ",
    "⊇": " contiene o uguale a ",
    "∪": " unione ",
    "∩": " intersezione ",
    "→": " tende a ",
    "↦": " mappa in ",
    "⇒": " implica ",
    "⇔": " se e solo se ",
    "∝": " proporzionale a ",
    "°": " gradi ",
    "π": " pi greco ",
    "θ": " teta ",
    "α": " alfa ",
    "β": " beta ",
    "γ": " gamma ",
    "Δ": " delta ",
    "δ": " delta ",
    "λ": " lambda ",
    "μ": " mu ",
    "σ": " sigma ",
    "Σ": " sigma ",
    "Ω": " omega ",
    "ω": " omega ",
    "∂": " derivata parziale ",
    "∇": " nabla ",
    "^": " elevato alla ",
  } : en ? {
    // EN
    "∀": " for all ",
    "∃": " there exists ",
    "∧": " and ",
    "∨": " or ",
    "¬": " not ",
    "⇒": " implies ",
    "⇐": " is implied by ",
    "⇔": " if and only if ",
    "∴": " therefore ",
    "∵": " because ",
    "∅": " empty set ",
    "ℕ": " natural numbers ",
    "ℤ": " integers ",
    "ℚ": " rational numbers ",
    "ℝ": " real numbers ",

    "±": " plus or minus ",
    "∓": " minus or plus ",
    "×": " times ",
    "⋅": " times ",
    "·": " times ",
    "÷": " divided by ",
    "∕": " divided by ",
    "√": " square root of ",
    "∑": " summation ",
    "∏": " product ",
    "∫": " integral ",
    "∞": " infinity ",
    "≈": " approximately equal to ",
    "≠": " not equal to ",
    "≤": " less than or equal to ",
    "≥": " greater than or equal to ",
    "<": " less than ",
    ">": " greater than ",
    "=": " equals ",
    "∈": " element of ",
    "∉": " not an element of ",
    "⊂": " subset of ",
    "⊆": " subset or equal to ",
    "∪": " union ",
    "∩": " intersection ",
    "→": " tends to ",
    "⇒": " implies ",
    "⇔": " if and only if ",
    "∝": " proportional to ",
    "°": " degrees ",
    "π": " pi ",
    "θ": " theta ",
    "α": " alpha ",
    "β": " beta ",
    "γ": " gamma ",
    "Δ": " delta ",
    "λ": " lambda ",
    "μ": " mu ",
    "σ": " sigma ",
    "Ω": " omega ",
    "∂": " partial derivative ",
    "∇": " nabla ",
    "^": " to the power of ",
  } : {};

  // sostituzioni dirette simboli
  let out = text;
  for (const [sym, spoken] of Object.entries(dict)) {
    out = out.split(sym).join(spoken);
  }

  // gestione frazioni tipo 1/2 (non perfetta ma utile)
  out = out.replace(/(\d+)\s*\/\s*(\d+)/g, it ? " $1 fratto $2 " : " $1 over $2 ");

  // gestione esponenti tipo x^2 oppure 10^3
  out = out.replace(/([a-zA-Z0-9]+)\s*\^\s*([a-zA-Z0-9]+)/g,
    it ? " $1 elevato alla $2 " : " $1 to the power of $2 ");

  // pulizia spazi
  out = out.replace(/\s+/g, " ").trim();
  return out;
}


let pdfSpanId = 0;
let suppressSelectionSaveUntil = 0;



const playPauseBtn = document.getElementById("playPauseBtn");
const playPauseIcon = document.getElementById("playPauseIcon");
const stopBtn = document.getElementById("stopBtn");
const volumeSlider = document.getElementById("volumeSlider");
const volumeIcon = document.getElementById("volumeIcon");
const speedSlider = document.getElementById("speedSlider");

const uploadToolbar = document.getElementById("uploadToolbar");
const mediaToolbar = document.getElementById("mediaToolbar");
const pdfSheet = document.getElementById("pdfSheet");

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const browse = document.getElementById("browse");

const deleteToolbar = document.getElementById("deleteToolbar");
const deleteDropzone = document.getElementById("deleteDropzone");

const helpToolbar = document.getElementById("helpToolbar");
const helpBtn = document.getElementById("helpBtn");
const helpIcon = document.getElementById("helpIcon");

const settingsBtn = document.getElementById("settingsBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const closeSettings = document.getElementById("closeSettings");

settingsBtn.addEventListener("click", () => {
  settingsOverlay.classList.remove("hidden");
});

closeSettings.addEventListener("click", () => {
  settingsOverlay.classList.add("hidden");
});

// click fuori dal pannello → chiude
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) {
    settingsOverlay.classList.add("hidden");
  }
});


let helpVisible = false;

volumeSlider.value = audioState.volume;
speedSlider.value = audioState.rate;

if (browse && fileInput) {
  browse.onclick = () => fileInput.click();
  fileInput.onchange = () => handleFile(fileInput.files[0]);
}

if (dropzone) {
  dropzone.ondragover = e => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  };

  dropzone.ondragleave = () => dropzone.classList.remove("dragover");

  dropzone.ondrop = e => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    handleFile(e.dataTransfer.files[0]);
  };
}

document.addEventListener("dragover", e => {
  e.preventDefault();
});

document.addEventListener("drop", e => {
  e.preventDefault();

  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    handleFile(e.dataTransfer.files[0]);
  }
});

function showDeleteToolbar() {
  uploadToolbar.classList.add("hidden");
  mediaToolbar.classList.add("hidden");
  helpToolbar.classList.add("hidden");
  deleteToolbar.classList.remove("hidden");
}

function hideDeleteToolbar() {
  deleteToolbar.classList.add("hidden");

  if (readerState.words.length > 0) {
    mediaToolbar.classList.remove("hidden");
    helpToolbar.classList.remove("hidden");
  } else {
    uploadToolbar.classList.remove("hidden");
  }
}

/*
async function handleFile(file) {
  if (!file || file.type !== "application/pdf") {
    alert("Carica un PDF valido");
    return;
  }

  uploadToolbar.classList.add("hidden");
  mediaToolbar.classList.remove("hidden");
  helpToolbar.classList.remove("hidden");

  //createHelpStickyNote();

  const arrayBuffer = await file.arrayBuffer();

  const base64 = btoa(
    new Uint8Array(arrayBuffer)
      .reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  pdfSheet.innerHTML = "";
  readerState.words = [];
  readerState.index = 0;
  readerState.reading = false;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    content.items.forEach(item => {

      // ✅ dimensione stimata dal PDF
      const fontSize = Math.abs(item.transform[3]);

      // scegli stile in base alla grandezza
      let sizeClass = "pdf-text";

      if (fontSize >= 18) sizeClass = "pdf-title";
      else if (fontSize >= 14) sizeClass = "pdf-subtitle";

      item.str.split(/\s+/).forEach(word => {
        if (!word) return;

        const span = document.createElement("span");
        span.dataset.pid = String(++pdfSpanId); // ✅ id univoco per QUELLA parola nel PDF
        span.className = `pdf-word ${sizeClass}`;
        span.textContent = word + " ";

        span.addEventListener("dblclick", (e) => {
          e.preventDefault();
          e.stopPropagation();

          suppressSelectionSaveUntil = Date.now() + 350;

          const sel = window.getSelection();
          let picked = (sel && !sel.isCollapsed) ? sel.toString().trim() : "";
          if (!picked) picked = span.textContent.trim();

          if (picked) addWordToStickyUnique(picked, span);
          highlightSpan(span);

          if (sel) sel.removeAllRanges();
        });



        span.addEventListener("contextmenu", (e) => {
          e.preventDefault();

          // 🔥 reset TOTALE stato lettura
          synth.cancel();

          audioState.playing = true;
          readerState.speaking = false;

          readerState.index = readerState.words.indexOf(span);
          readerState.sentenceStart = readerState.index;
          readerState.sentenceIndex = 0;

          playPauseIcon.src = "img/pauseIcon.png";

          // ▶️ avvio pulito da QUI
          requestAnimationFrame(speakSentence);
        });


        pdfSheet.appendChild(span);
        readerState.words.push(span);
      });

      // ✅ accapo vero dal PDF
      if (item.hasEOL) {
        pdfSheet.appendChild(document.createElement("br"));
      }
    });


    pdfSheet.appendChild(document.createElement("br"));
    pdfSheet.appendChild(document.createElement("br"));
  }
}
*/

async function handleFile(file) {

  if (!file || file.type !== "application/pdf") {
    alert("Carica un PDF valido");
    return;
  }

  const MAX_SIZE = 3 * 1024 * 1024;
  const arrayBuffer = await file.arrayBuffer();

  if (file.size <= MAX_SIZE) {

    const base64 = btoa(
      new Uint8Array(arrayBuffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    localStorage.setItem("cmapPDF", base64);

  } else {
    alert("PDF troppo grande per il salvataggio automatico (max 3MB).");
  }

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  await renderPDF(pdf);

  // 🔥 FIX CRITICO
  if (window.StickyApp && !StickyApp._initializedAfterUpload) {
    StickyApp._initializedAfterUpload = true;
    StickyApp.loadProject();
  }

  uploadToolbar.classList.add("hidden");
  mediaToolbar.classList.remove("hidden");
  helpToolbar.classList.remove("hidden");
}

window.renderPDF = async function (pdf) {

  if (pdfAlreadyRendered) return;
  pdfAlreadyRendered = true;

  console.log("RENDER PDF CALLED");

  pdfSpanId = 0;

  pdfSheet.innerHTML = "";
  readerState.words = [];
  readerState.index = 0;
  readerState.reading = false;

  // 🔥 Carico highlights UNA SOLA VOLTA
  const raw = localStorage.getItem("cmapProject");
  let highlightSet = new Set();

  if (raw) {
    const project = JSON.parse(raw);
    if (project.highlights?.length) {
      highlightSet = new Set(project.highlights.map(String));
    }
  }

  for (let i = 1; i <= pdf.numPages; i++) {

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    content.items.forEach(item => {

      const fontSize = Math.abs(item.transform[3]);

      let sizeClass = "pdf-text";
      if (fontSize >= 18) sizeClass = "pdf-title";
      else if (fontSize >= 14) sizeClass = "pdf-subtitle";

      item.str.split(/\s+/).forEach(word => {
        if (!word) return;

        const span = document.createElement("span");

        const pid = String(++pdfSpanId);
        span.dataset.pid = pid;

        span.className = `pdf-word ${sizeClass}`;
        span.textContent = word + " ";

        span.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const idx = readerState.words.indexOf(span);
          if (idx < 0) return;

          synth.cancel();

          audioState.playing = true;

          readerState.index = idx;

          playPauseIcon.src = "img/pauseIcon.png";

          startReadingFromIndex(idx);
        });

        // 🔥 QUI applico highlight correttamente
        if (highlightSet.has(pid)) {
          span.classList.add("saved");
          span.dataset.saved = "1";
        }

        pdfSheet.appendChild(span);
        readerState.words.push(span);
      });

      if (item.hasEOL) {
        pdfSheet.appendChild(document.createElement("br"));
      }

    });

    pdfSheet.appendChild(document.createElement("br"));
    pdfSheet.appendChild(document.createElement("br"));
  }
};


pdfSheet.addEventListener("mouseup", () => {
  if (Date.now() < suppressSelectionSaveUntil) return;

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;

  const range = sel.getRangeAt(0);
  if (!pdfSheet.contains(range.commonAncestorContainer)) return;

  // ✅ prendo tutti gli span parola intercettati dalla selezione
  const spans = Array.from(pdfSheet.querySelectorAll(".pdf-word"))
    .filter(sp => range.intersectsNode(sp));

  if (!spans.length) return;

  // ✅ creo UN SOLO testo con tutte le parole selezionate
  const phrase = spans
    .map(s => s.textContent.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!phrase) return;

  // ✅ aggiungo UNA SOLA voce in lista, collegata a TUTTI gli span selezionati
  addWordToStickyUnique(phrase, spans);

  // ✅ evidenzio tutti gli span selezionati
  highlightSpans(spans);

  sel.removeAllRanges();
});



function highlightSpan(span) {
  if (!span) return;
  span.classList.add("saved");
  span.dataset.saved = "1";
  span.classList.add("flash");
  setTimeout(() => span.classList.remove("flash"), 300);

  if (window.StickyApp?.saveProject) {
    StickyApp.saveProject();
  }
}

function highlightSpans(spans) {
  (spans || []).forEach(highlightSpan);
}

function highlightSelectionInPdf() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;

  const range = sel.getRangeAt(0);

  // evidenzia tutti gli span .pdf-word che intersecano la selezione
  const spans = Array.from(pdfSheet.querySelectorAll(".pdf-word"));
  spans.forEach(sp => {
    if (range.intersectsNode(sp)) highlightSpan(sp);
  });
}

let readingSpan = null;

function setReadingHighlight(idx) {
  const spans = readerState.words;
  if (!spans || !spans.length) return;

  // clamp
  const i = Math.max(0, Math.min(idx, spans.length - 1));
  const sp = spans[i];
  if (!sp) return;

  // rimuovi vecchio
  if (readingSpan && readingSpan !== sp) {
    readingSpan.classList.remove("reading");
  }

  // aggiungi nuovo
  sp.classList.add("reading");
  readingSpan = sp;

  // (opzionale) autoscroll per tenerla visibile
  sp.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function clearReadingHighlight() {
  if (readingSpan) {
    readingSpan.classList.remove("reading");
    readingSpan = null;
  }
}

function highlightReadingWord(index) {
  clearReadingHighlight();

  const span = readerState.words[index];
  if (!span) return;

  span.classList.add("reading");

  // scroll morbido verso la parola
  span.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function buildSpeakData(sentenceWords, lang) {
  const speakWords = [];
  const tokenMap = []; // speakWordIndex → tokenIndex

  sentenceWords.forEach((token, tokenIndex) => {
    const normalized = normalizeMathForTTS(token, lang);
    const parts = normalized.split(/\s+/).filter(Boolean);

    parts.forEach(p => {
      speakWords.push(p);
      tokenMap.push(tokenIndex);
    });
  });

  return {
    speakText: speakWords.join(" "),
    tokenMap
  };
}




function speakSentence() {
  if (!audioState.playing) return;
  if (readerState.index >= readerState.words.length) return;

  readerState.sentenceWords = [];
  readerState.sentenceIndex = 0;
  readerState.sentenceStart = readerState.index;

  let i = readerState.index;

  while (i < readerState.words.length) {
    const word = readerState.words[i].textContent.trim();
    readerState.sentenceWords.push(word);
    if (/[.!?]$/.test(word)) break;
    i++;
  }
  const rawSentence = readerState.sentenceWords.join(" ");
  const { speakText, tokenMap } = buildSpeakData(readerState.sentenceWords, currentLang);

  currentUtterance = new SpeechSynthesisUtterance(speakText);
  currentUtterance.lang = currentLang;
  currentUtterance.volume = audioState.volume / 100;
  currentUtterance.rate = audioState.rate;


  readerState.speaking = true;

  let lastTokenIdx = -1;

  currentUtterance.onboundary = (e) => {
    if (e.name !== "word") return;

    const spokenWords =
      speakText.slice(0, e.charIndex).trim().split(/\s+/);

    const speakWordIndex = spokenWords.length - 1;
    const tokenIdx = tokenMap[speakWordIndex];

    // 🔒 avanza SOLO quando cambia token PDF
    if (tokenIdx !== lastTokenIdx) {
      readerState.sentenceIndex = tokenIdx;
      lastTokenIdx = tokenIdx;
    }
  };



  currentUtterance.onend = () => {
    readerState.speaking = false;
    readerState.index = readerState.sentenceStart + readerState.sentenceWords.length;
    speakSentence();
  };

  currentUtterance.onerror = () => {
    readerState.speaking = false;
  };

  synth.speak(currentUtterance);
}

function buildNextSentence(fromIdx) {
  const parts = [];
  let i = fromIdx;

  const MAX_WORDS = 40;     // sicurezza: migliora la reattività del pause
  const MAX_CHARS = 260;    // idem
  let lastSoftCut = -1;     // , ; :

  while (i < readerState.words.length) {
    const w = readerState.words[i].textContent.trim();
    if (w) {
      parts.push(w);

      if (/[,:;]$/.test(w)) lastSoftCut = i + 1; // cut DOPO questo token

      // fine frase vera
      if (SENTENCE_END_REGEX.test(w)) {
        i++;
        break;
      }

      // se sta diventando troppo lunga, taglia su virgola/;/: se possibile
      if (parts.length >= MAX_WORDS || parts.join(" ").length >= MAX_CHARS) {
        if (lastSoftCut !== -1 && lastSoftCut > fromIdx + 5) {
          i = lastSoftCut;
        } else {
          i++; // fallback: taglia dove sei
        }
        break;
      }
    }
    i++;
  }

  return { text: parts.join(" "), nextIndex: i };
}


function fillQueue() {
  while (tts.playing && tts.queued < tts.maxQueue && tts.nextIndex < readerState.words.length) {
    enqueueSentence();
  }
}








/**
 * Trasforma una lista di token ORIGINALI (1 token = 1 span/parola PDF)
 * in speakText e crea una mappa speakWordIndex -> tokenIndex
 */
function buildSpeakTextAndMap(tokens, lang) {
  const speakWords = [];
  const map = [];     // speakWordIndex -> tokenIndex
  const starts = [];  // speakWordIndex -> start charIndex nel speakText finale

  tokens.forEach((tok, tokenIdx) => {
    const normalized = normalizeMathForTTS(tok, lang);
    const ws = (normalized || "").split(/\s+/).filter(Boolean);

    ws.forEach(w => {
      speakWords.push(w);
      map.push(tokenIdx);
    });
  });

  // calcola gli start charIndex di ogni parola nel join con spazio singolo
  let pos = 0;
  for (let i = 0; i < speakWords.length; i++) {
    starts[i] = pos;
    pos += speakWords[i].length + 1; // +1 spazio
  }

  return { speakText: speakWords.join(" "), map, starts, speakWords };
}

function wordIndexFromCharIndex(starts, charIndex) {
  // trova l'ultima parola con start <= charIndex (binary search)
  let lo = 0, hi = starts.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= charIndex) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function countWordsUpToChar(str, charIndex) {
  const s = (str || "").slice(0, charIndex).trim();
  if (!s) return 0;
  return s.split(/\s+/).length;
}







function enqueueSentence() {
  const startIdx = tts.nextIndex;
  const { text, nextIndex } = buildNextSentence(startIdx);
  if (!text) {
    tts.nextIndex = Math.min(startIdx + 1, readerState.words.length);
    return;
  }

  // ✅ tokens originali (uno span = uno token)
  const tokenSpans = readerState.words.slice(startIdx, nextIndex);
  const tokens = tokenSpans.map(sp => sp.textContent.trim()).filter(Boolean);

  // ✅ speakText + mappa parole pronunciate -> token originale
  const { speakText, map, starts } = buildSpeakTextAndMap(tokens, currentLang);

  const u = new SpeechSynthesisUtterance(speakText);
  u.lang = currentLang;
  u.voice = pickVoiceForLang(currentLang) || null;
  u.volume = audioState.volume / 100;
  u.rate = audioState.rate;


  let boundaryCount = -1;       // conta i "word boundary" ricevuti
  let lastSpokenWordIdx = -1;   // evita regressi

  u.onstart = () => {
    tts.currentStart = startIdx;

    if (tts.progressIndex == null) tts.progressIndex = startIdx;
    if (tts.lastWordIndex == null) tts.lastWordIndex = startIdx;

    readerState.index = startIdx;

  };

  u.onboundary = (e) => {
    if (e.name !== "word") return;

    // calcolo indice (come già fai)
    boundaryCount++;

    const idxFromChar = wordIndexFromCharIndex(starts, e.charIndex);
    let spokenWordIdx = Math.max(boundaryCount, idxFromChar, lastSpokenWordIdx + 1);
    spokenWordIdx = Math.min(spokenWordIdx, map.length - 1);
    lastSpokenWordIdx = spokenWordIdx;

    const tokenIndex = map[spokenWordIdx] ?? 0;
    const globalWordIndex = startIdx + tokenIndex;

    // ✅ SOLO MEMORIZZAZIONE
    tts.lastWordIndex = globalWordIndex;
    tts.progressIndex = globalWordIndex;
    readerState.index = globalWordIndex;
  };


  u.onend = () => {

    if (!tts.playing) return;

    tts.progressIndex = nextIndex;
    tts.lastWordIndex = nextIndex;
    readerState.index = nextIndex;

    tts.queued = Math.max(0, tts.queued - 1);

    fillQueue();
  };

  u.onerror = () => {
    tts.queued = Math.max(0, tts.queued - 1);
    fillQueue();
  };

  tts.nextIndex = nextIndex;
  tts.queued++;

  synth.speak(u);
}

function highlightReadingWord(index) {
  clearReadingHighlight();

  const span = readerState.words[index];
  if (!span) return;

  span.classList.add("reading");
  readingSpan = span;

  span.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}





function restartFromLastWord() {
  if (!audioState.playing) return;

  synth.cancel();
  readerState.speaking = false;

  readerState.index =
    readerState.sentenceStart + readerState.sentenceIndex;

  requestAnimationFrame(speakSentence);
}

/*
playPauseBtn.addEventListener("click", () => {
  if (!audioState.playing) {
    audioState.playing = true;
    playPauseIcon.src = "img/pauseIcon.png";
    restartFromLastWord();
  } else {
    audioState.playing = false;
    playPauseIcon.src = "img/playIcon.png";
    synth.cancel();
    readerState.speaking = false;
  }
});

stopBtn.addEventListener("click", () => {
  audioState.playing = false;

  readerState.index = 0;
  readerState.sentenceStart = 0;
  readerState.sentenceIndex = 0;
  readerState.speaking = false;

  synth.cancel();
  playPauseIcon.src = "img/playIcon.png";
});
*/

function startReadingFromIndex(idx) {
  synth.cancel();

  tts.playing = true;
  tts.paused = false;
  tts.queued = 0;

  tts.nextIndex = idx;
  tts.currentStart = idx;
  tts.progressIndex = idx;

  playPauseIcon.src = "img/pauseIcon.png";
  fillQueue();
}


playPauseBtn.addEventListener("click", () => {

  // ▶️ PLAY
  if (!tts.playing) {

    tts.playing = true;
    audioState.playing = true;

    playPauseIcon.src = "img/pauseIcon.png";

    const idx = tts.progressIndex ?? readerState.index ?? 0;

    startReadingFromIndex(idx);
    return;
  }

  // ⏸ PAUSE
  tts.playing = false;
  audioState.playing = false;

  playPauseIcon.src = "img/playIcon.png";

  synth.cancel();
});

stopBtn.addEventListener("click", () => {

  synth.cancel();

  audioState.playing = false;
  tts.playing = false;
  tts.paused = false;

  playPauseIcon.src = "img/playIcon.png";

  // reset reader
  readerState.index = 0;
  readerState.sentenceStart = 0;
  readerState.sentenceIndex = 0;
  readerState.speaking = false;

  // 🔥 reset motore TTS
  tts.nextIndex = 0;
  tts.progressIndex = 0;
  tts.lastWordIndex = 0;
  tts.currentStart = 0;
  tts.queued = 0;

  clearReadingHighlight();
});



/*
volumeSlider.addEventListener("input", () => {
  audioState.volume = parseInt(volumeSlider.value, 10);
  updateVolumeIcon(audioState.volume);
  restartFromLastWord();
});

speedSlider.addEventListener("input", () => {
  audioState.rate = parseFloat(speedSlider.value);
  restartFromLastWord();
});

*/

let volumeTimer = null;

volumeSlider.addEventListener("input", () => {

  audioState.volume = parseInt(volumeSlider.value, 10);
  updateVolumeIcon(audioState.volume);

  if (!tts.playing) return;

  clearTimeout(volumeTimer);

  volumeTimer = setTimeout(() => {

    const idx = tts.progressIndex ?? readerState.index ?? 0;

    synth.cancel();

    requestAnimationFrame(() => {
      startReadingFromIndex(idx);
    });

  }, 150);

});

let speedTimer = null;

speedSlider.addEventListener("input", () => {

  audioState.rate = parseFloat(speedSlider.value);

  if (!tts.playing) return;

  clearTimeout(speedTimer);

  speedTimer = setTimeout(() => {

    const idx = tts.progressIndex ?? readerState.index ?? 0;

    synth.cancel();

    requestAnimationFrame(() => {
      startReadingFromIndex(idx);
    });

  }, 150);

});


function jumpToWord(span) {
  synth.cancel();
  readerState.index = readerState.words.indexOf(span);
  audioState.playing = true;
  readerState.reading = true;
  playPauseIcon.src = "img/pauseIcon.png";
  readNextWord();
}





function updateVolumeIcon(volume) {
  if (volume === 0) volumeIcon.src = "img/volume/offIcon.png";
  else if (volume < 50) volumeIcon.src = "img/volume/lowIcon.png";
  else if (volume < 100) volumeIcon.src = "img/volume/midIcon.png";
  else volumeIcon.src = "img/volume/highIcon.png";
}

let lastVolume = audioState.volume;

volumeIcon.addEventListener("click", () => {
  if (audioState.volume > 0) {
    lastVolume = audioState.volume;
    audioState.volume = 0;
    volumeSlider.value = 0;
  } else {
    audioState.volume = lastVolume || 50;
    volumeSlider.value = audioState.volume;
  }

  updateVolumeIcon(audioState.volume);
  /*
    if (audioState.playing) {
      restartFromLastWord();
    }*/

  if (tts.playing || tts.paused) startReadingFromIndex(tts.lastSafeIndex || readerState.index || 0);



  console.log("MUTE TOGGLE →", audioState.volume);
});


updateVolumeIcon(audioState.volume);

/*
(function () {
  const canvas = document.getElementById("canvas");
  const btnAdd = document.getElementById("btn-add");
  const btnReset = document.getElementById("btn-reset");

  const state = {
    scale: 1,
    viewportX: 0,
    viewportY: 0,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    isDraggingNote: false,
    draggedNote: null,
    dragOffset: { x: 0, y: 0 },
    dragVelocity: { x: 0, y: 0 },
    lastMouse: { x: 0, y: 0 },
    zIndexCounter: 100
  };

  const THEME_CLASSES = [
    "sticky-note--yellow",
    "sticky-note--blue",
    "sticky-note--green",
    "sticky-note--pink"
  ];

  function screenToWorld(sx, sy) {
    return {
      x: (sx - state.viewportX) / state.scale,
      y: (sy - state.viewportY) / state.scale
    };
  }

  function createNote(initialX, initialY) {
    const note = document.createElement("article");
    note.addEventListener("mousemove", e => {
      if (state.isDraggingNote) return;

      const rect = note.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const isOnBorder =
        x < DRAG_BORDER_SIZE ||
        x > rect.width - DRAG_BORDER_SIZE ||
        y < DRAG_BORDER_SIZE ||
        y > rect.height - DRAG_BORDER_SIZE;

      note.style.cursor = isOnBorder ? "grab" : "default";
    });

    note.dataset.type = "text";

    const theme = THEME_CLASSES[Math.floor(Math.random() * THEME_CLASSES.length)];

    note.className = `sticky-note ${theme}`;
    note.style.zIndex = ++state.zIndexCounter;

    const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    const x = initialX || center.x - 120;
    const y = initialY || center.y - 120;

    const randomRot = Math.random() * 4 - 2;
    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
    note.style.transform = `rotate(${randomRot}deg)`;

    const textarea = document.createElement("textarea");

    textarea.className = "sticky-note__content";
    textarea.setAttribute("aria-label", "Sticky note content");
    textarea.placeholder = "Take a note...";

    note.addEventListener("dragover", e => {
      if (note.dataset.type !== "text") return;
      e.preventDefault();
    });

    note.addEventListener("drop", e => {
      if (note.dataset.type !== "text") return;

      e.preventDefault();

      const text = e.dataTransfer.getData("text/plain");
      if (!text) return;

      const textarea = note.querySelector("textarea");
      if (!textarea) return;

      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;

      textarea.value =
        textarea.value.slice(0, start) +
        text + " " +
        textarea.value.slice(end);

      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length + 1;
    });


    note.appendChild(textarea);

    note.addEventListener("mousedown", handleNoteMouseDown);

    canvas.appendChild(note);

    return note;
  }

  function handleNoteMouseDown(e) {
    const note = e.currentTarget;

    const rect = note.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const isOnBorder =
      x < DRAG_BORDER_SIZE ||
      x > rect.width - DRAG_BORDER_SIZE ||
      y < DRAG_BORDER_SIZE ||
      y > rect.height - DRAG_BORDER_SIZE;

    if (!isOnBorder) return;

    e.preventDefault();
    e.stopPropagation();

    state.isDraggingNote = true;
    state.draggedNote = note;

    showDeleteToolbar();

    state.zIndexCounter++;
    note.style.zIndex = state.zIndexCounter;

    note.classList.remove("sticky-note--animate-drop");
    note.classList.add("sticky-note--dragging");

    const worldMouse = screenToWorld(e.clientX, e.clientY);
    const noteLeft = parseFloat(note.style.left);
    const noteTop = parseFloat(note.style.top);

    state.dragOffset.x = worldMouse.x - noteLeft;
    state.dragOffset.y = worldMouse.y - noteTop;
    state.lastMouse = { x: e.clientX, y: e.clientY };
  }


  window.handleNoteMouseDown = handleNoteMouseDown;

  function onMouseDown(e) {
    if (e.target.closest(".sticky-app__toolbar") || state.isDraggingNote)
      return;

    state.isPanning = true;
    state.panStart.x = e.clientX - state.viewportX;
    state.panStart.y = e.clientY - state.viewportY;
    canvas.classList.add("sticky-app__canvas--panning");
  }

  function onMouseMove(e) {
    if (state.isDraggingNote && state.draggedNote) {
      const worldMouse = screenToWorld(e.clientX, e.clientY);

      const deltaX = e.clientX - state.lastMouse.x;
      const velocity = Math.max(-25, Math.min(25, deltaX * 1.5));

      const x = worldMouse.x - state.dragOffset.x;
      const y = worldMouse.y - state.dragOffset.y;

      state.draggedNote.style.left = `${x}px`;
      state.draggedNote.style.top = `${y}px`;
      state.draggedNote.style.transform = `scale(1.02) rotate(${velocity}deg)`;

      state.lastMouse = { x: e.clientX, y: e.clientY };

      const mouseX = state.lastMouse.x;
      const mouseY = state.lastMouse.y;

      if (isMouseOverDeleteZone(mouseX, mouseY)) {
        deleteDropzone.classList.add("active");
        deleteDropzone.querySelector("img").src = "img/deleteIconR.png";
      } else {
        deleteDropzone.classList.remove("active");
        deleteDropzone.querySelector("img").src = "img/deleteIcon.png";
      }

    }
  }

  function isMouseOverDeleteZone(mouseX, mouseY) {
    const rect = deleteDropzone.getBoundingClientRect();

    return (
      mouseX >= rect.left &&
      mouseX <= rect.right &&
      mouseY >= rect.top &&
      mouseY <= rect.bottom
    );
  }


  function onMouseUp() {
    if (state.isDraggingNote && state.draggedNote) {
      const note = state.draggedNote;

      const { x, y } = state.lastMouse;

      if (isMouseOverDeleteZone(x, y)) {
        note.remove();

        if (note.dataset.help === "true") {
          helpBtn.classList.remove("sticky-btn--primary");
          helpBtn.classList.add("sticky-btn--secondary");
          helpIcon.src = "img/helpIcon.png";
        }


        if (note === activeStickyNote) {
          activeStickyNote = null;
        }
      } else {
        note.classList.remove("sticky-note--dragging");
        note.classList.add("sticky-note--animate-drop");

        const randomRestRot = Math.random() * 6 - 3;
        note.style.transform = `rotate(${randomRestRot}deg)`;
      }

      state.isDraggingNote = false;
      state.draggedNote = null;

      hideDeleteToolbar();
    }

    if (state.isPanning) {
      state.isPanning = false;
      canvas.classList.remove("sticky-app__canvas--panning");
    }
  }


  function onWheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const zoomIntensity = 0.1;
      const wheel = e.deltaY < 0 ? 1 : -1;
      const zoom = Math.exp(wheel * zoomIntensity);

      const newScale = Math.min(Math.max(0.2, state.scale * zoom), 4);

      state.viewportX -= worldPos.x * newScale - worldPos.x * state.scale;
      state.viewportY -= worldPos.y * newScale - worldPos.y * state.scale;
      state.scale = newScale;

      updateTransform();
    }
  }

  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("wheel", onWheel, { passive: false });

  btnAdd.addEventListener("click", () => {
    const note = createNote();
    animateNotesAppear(note);
  });

})();
*/
function getRandomStickyColorClass() {
  const colors = [
    "sticky-note--yellow",
    "sticky-note--blue",
    "sticky-note--green",
    "sticky-note--pink"
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}


function createHelpText() {
  const canvas = document.getElementById("canvas");

  const note = document.createElement("article");
  note.addEventListener("mousemove", e => {
    if (StickyApp.state.isDraggingNote) return;

    const rect = note.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const isOnBorder =
      x < DRAG_BORDER_SIZE ||
      x > rect.width - DRAG_BORDER_SIZE ||
      y < DRAG_BORDER_SIZE ||
      y > rect.height - DRAG_BORDER_SIZE;

    note.style.cursor = isOnBorder ? "grab" : "default";
  });



  note.dataset.help = "true";
  note.className = `sticky-note ${getRandomStickyColorClass()} sticky-note--readonly`;
  note.style.left = "1545px";
  note.style.top = "60px";
  note.style.zIndex = 1000;

  const content = document.createElement("div");
  content.className = "sticky-note__content sticky-note__content--readonly";

  const rows = [
    { titolo: "Comandi Testo" },
    { icon: "img/leftClick.png", text: "Segna parola nella lista" },
    { icon: "img/rightClick.png", text: "Leggi dalla parola selezionata" },
    { icon: "", text: "" },
    { icon: "img/playIcon.png", text: "Avvia / Metti in pausa la lettura" },
    { icon: "img/stopIcon.png", text: "Ferma la lettura e torna all’inizio" },
    { icon: "img/volume/highIcon.png", text: "Regola o disattiva il volume" },
    { icon: "img/flashIcon.png", text: "Modifica la velocità di lettura" },

  ];

  rows.forEach(row => {
    if (row.titolo) {
      const title = document.createElement("h3");
      title.className = "sticky-note__title";
      title.textContent = row.titolo;
      note.appendChild(title); // aggiunge il titolo
      return;
    }

    if (!row.icon && !row.text) {
      content.appendChild(document.createElement("hr"));
      return;
    }

    const line = document.createElement("div");
    line.className = "help-line";

    if (row.icon) {
      const img = document.createElement("img");
      img.src = row.icon;
      img.className = "help-icon";
      line.appendChild(img);
    }

    const span = document.createElement("span");
    span.textContent = row.text;

    line.appendChild(span);
    content.appendChild(line);
  });

  note.appendChild(content);
  note.addEventListener("mousedown", (e) => {
    StickyApp.handleNoteMouseDown(e);
  });

  canvas.appendChild(note);
}



function createHelpStickyNote() {
  const canvas = document.getElementById("canvas");

  const note = document.createElement("article");
  note.addEventListener("mousemove", e => {
    if (state.isDraggingNote) return;

    const rect = note.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const isOnBorder =
      x < DRAG_BORDER_SIZE ||
      x > rect.width - DRAG_BORDER_SIZE ||
      y < DRAG_BORDER_SIZE ||
      y > rect.height - DRAG_BORDER_SIZE;

    note.style.cursor = isOnBorder ? "grab" : "default";
  });



  note.dataset.help = "true";
  note.className = `sticky-note ${getRandomStickyColorClass()} sticky-note--readonly`;
  note.style.left = "80px";
  note.style.top = "450px";
  note.style.zIndex = 999;

  const content = document.createElement("div");
  content.className = "sticky-note__content sticky-note__content--readonly";

  const rows = [
    { titolo: "Comandi Post-it" },
    { icon: "img/leftClick.png", text: "Trascina la parola in un post-it per copiarla" },
    { icon: "img/leftClick.png", text: "Trascina la parola su una parola della lista per unirla" },
    { icon: "img/rightClick.png", text: "Cancella la parola dalla lista" }
  ];

  rows.forEach(row => {
    if (row.titolo) {
      const title = document.createElement("h3");
      title.className = "sticky-note__title";
      title.textContent = row.titolo;
      note.appendChild(title);
      return;
    }

    if (!row.icon && !row.text) {
      content.appendChild(document.createElement("hr"));
      return;
    }

    const line = document.createElement("div");
    line.className = "help-line";

    if (row.icon) {
      const img = document.createElement("img");
      img.src = row.icon;
      img.className = "help-icon";
      line.appendChild(img);
    }

    const span = document.createElement("span");
    span.textContent = row.text;

    line.appendChild(span);
    content.appendChild(line);
  });

  note.appendChild(content);
  /*note.addEventListener("mousedown", handleNoteMouseDown);*/
  note.addEventListener("mousedown", (e) => {
    StickyApp.handleNoteMouseDown(e);
  });
  canvas.appendChild(note);
}

/*
window.createStickyNote = function () {
  const canvas = document.getElementById("canvas");

  const note = document.createElement("article");

  note.addEventListener("mousemove", e => {
    if (state.isDraggingNote) return;

    const rect = note.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const isOnBorder =
      x < DRAG_BORDER_SIZE ||
      x > rect.width - DRAG_BORDER_SIZE ||
      y < DRAG_BORDER_SIZE ||
      y > rect.height - DRAG_BORDER_SIZE;

    note.style.cursor = isOnBorder ? "grab" : "default";
  });

  note.dataset.type = "list";
  note.className = `sticky-note ${getRandomStickyColorClass()} sticky-note--readonly`;
  note.style.left = "120px";
  note.style.top = "120px";
  note.style.zIndex = 999;

  const content = document.createElement("div");
  content.className = "sticky-note__content";

  note.appendChild(content);

  note.addEventListener("mousedown", handleNoteMouseDown);

  canvas.appendChild(note);

  activeStickyNote = note;
  return note;
};*/

window.createStickyNote = function () {

  const note = document.createElement("article");

  note.addEventListener("mousemove", e => {
    if (StickyApp.state.isDraggingNote) return;

    const rect = note.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const isOnBorder =
      x < DRAG_BORDER_SIZE ||
      x > rect.width - DRAG_BORDER_SIZE ||
      y < DRAG_BORDER_SIZE ||
      y > rect.height - DRAG_BORDER_SIZE;

    note.style.cursor = isOnBorder ? "grab" : "default";
  });

  note.dataset.type = "list";
  note.className = `sticky-note ${getRandomStickyColorClass()} sticky-note--readonly`;
  note.style.left = "120px";
  note.style.top = "120px";
  note.style.zIndex = 999;

  const content = document.createElement("div");
  content.className = "sticky-note__content";

  note.appendChild(content);

  note.addEventListener("mousedown", (e) => {
    StickyApp.handleNoteMouseDown(e);
  });

  StickyApp.canvas.appendChild(note);

  StickyApp.activeStickyNote = note;
  return note;
};

function cleanWord(word) {
  return word
    .replace(/^[^a-zA-ZÀ-ÿ0-9]+/, "") // rimuove simboli iniziali
    .replace(/[^a-zA-ZÀ-ÿ0-9]+$/, "") // rimuove simboli finali
    .trim();
}
/*
function addWordToSticky(word) {
  if (!activeStickyNote) {
    activeStickyNote = createStickyNote();
  }

  const content = activeStickyNote.querySelector(".sticky-note__content");

  const span = document.createElement("span");
  span.className = "sticky-word";
  span.textContent = word;
  span.draggable = true;

  span.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", span.textContent);
    e.dataTransfer.setData("source-id", span.dataset.id);
    e.dataTransfer.setData("source-el", "sticky-word");
    span.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  span.addEventListener("dragend", () => {
    span.classList.remove("dragging");
  });


  span.addEventListener("dragover", e => {
    e.preventDefault();
    span.classList.add("merge-hover");
  });

  span.addEventListener("dragleave", () => {
    span.classList.remove("merge-hover");
  });

  span.addEventListener("drop", e => {
    e.preventDefault();
    span.classList.remove("merge-hover");

    const draggedEl = document.querySelector(".sticky-word.dragging");
    if (!draggedEl || draggedEl === span) return;

    span.textContent = `${span.textContent} ${draggedEl.textContent}`;
    draggedEl.remove();
  });

  span.addEventListener("contextmenu", e => {
    e.preventDefault();
    span.remove();
  });

  content.appendChild(span);
}*/

function addWordToSticky(word, sourceSpanOrSpans = null) {

  const existingList = document.querySelector('.sticky-note[data-type="list"]');

  if (existingList) {
    StickyApp.activeStickyNote = existingList;
  } else {
    StickyApp.activeStickyNote = StickyApp.createListNote();
  }



  const content = StickyApp.activeStickyNote.querySelector(".sticky-note__content");

  const existingWords = Array.from(content.querySelectorAll(".sticky-word"));
  if (existingWords.some(w => w.textContent.trim() === word.trim())) {
    return;
  }

  const span = document.createElement("span");
  span.className = "sticky-word";
  span.textContent = word;
  span.draggable = true;

  const spansArr = Array.isArray(sourceSpanOrSpans)
    ? sourceSpanOrSpans.filter(Boolean)
    : (sourceSpanOrSpans ? [sourceSpanOrSpans] : []);

  if (spansArr.length) {
    span._pdfSpans = spansArr;

    // firma unica basata sugli id dei pdf span (non sul testo!)
    const sig = spansArr
      .map(s => s.dataset.pid)
      .filter(Boolean)
      .join(",");

    span.dataset.sig = sig;
  }

  span.draggable = true;

  span.addEventListener("dragstart", (e) => {

    currentDraggedWord = span;

    e.dataTransfer.setData("text/plain", span.textContent);
    e.dataTransfer.setData("source-type", "sticky-word");
  });

  span.addEventListener("dragend", () => {
    span.classList.remove("dragging");
  });

  span.addEventListener("dragover", e => {
    e.preventDefault();
    span.classList.add("merge-hover");
  });

  span.addEventListener("dragleave", () => {
    span.classList.remove("merge-hover");
  });

  span.addEventListener("drop", e => {
    e.preventDefault();
    span.classList.remove("merge-hover");

    const draggedEl = document.querySelector(".sticky-word.dragging");
    if (!draggedEl || draggedEl === span) return;

    span.textContent = `${span.textContent} ${draggedEl.textContent}`;

    const a = span._pdfSpans || [];
    const b = draggedEl._pdfSpans || [];
    const merged = [...a, ...b].filter(Boolean);

    if (merged.length) {
      span._pdfSpans = merged;
      span.dataset.sig = merged
        .map(s => s.dataset.pid)
        .filter(Boolean)
        .join(",");
    }

    draggedEl.remove();
  });

  span.addEventListener("contextmenu", e => {
    e.preventDefault();

    const linked = span._pdfSpans || [];
    linked.forEach(s => {
      s.classList.remove("saved");
      s.dataset.saved = "0";
    });

    const note = span.closest(".sticky-note");
    span.remove();

    // SE NON CI SONO PIÙ PAROLE -> CANCELLA LA STICKY
    if (note) {
      const remaining = note.querySelectorAll(".sticky-word");
      if (remaining.length === 0) {
        note.remove();

        if (StickyApp.activeStickyNote === note)
          StickyApp.activeStickyNote = null;

      }
    }
  });

  content.appendChild(span);
  StickyApp.saveProject();
}

function addWordToStickyUnique(text, sourceSpanOrSpans = null) {
  if (!text) return;

  // 🔎 Cerca lista esistente nel DOM
  let list = document.querySelector('.sticky-note[data-type="list"]');

  // Se non esiste → creala
  if (!list) {
    list = StickyApp.createListNote();
  }

  // Aggiorna stato interno
  StickyApp.activeStickyNote = list;

  const content = list.querySelector(".sticky-note__content");

  const normalized = text.replace(/\s+/g, " ").trim();

  const spansArr = Array.isArray(sourceSpanOrSpans)
    ? sourceSpanOrSpans.filter(Boolean)
    : (sourceSpanOrSpans ? [sourceSpanOrSpans] : []);

  const sig = spansArr.length
    ? spansArr.map(s => s.dataset.pid).filter(Boolean).join(",")
    : "";

  if (sig) {
    const exists = Array.from(content.querySelectorAll(".sticky-word"))
      .some(el => (el.dataset.sig || "") === sig);
    if (exists) return;
  }

  addWordToSticky(normalized, spansArr.length ? spansArr : null);
}



document.addEventListener("mousedown", e => {
  if (e.target.classList.contains("sticky-word")) {
    e.stopPropagation();
  }
});

function showHelpStickies() {
  if (getHelpStickies().length > 0) return;

  const notes = [
    createHelpText(),
    createHelpStickyNote(),
  ];

  animateNotesAppear(notes);

  helpBtn.classList.remove("sticky-btn--secondary");
  helpBtn.classList.add("sticky-btn--primary");
  helpIcon.src = "img/helpIconW.png";
}

function destroyHelpStickies() {
  const helps = getHelpStickies();
  if (helps.length === 0) return;

  helps.forEach(h => h.remove());

  helpBtn.classList.remove("sticky-btn--primary");
  helpBtn.classList.add("sticky-btn--secondary");
  helpIcon.src = "img/helpIcon.png";
}


helpBtn.addEventListener("click", () => {
  if (getHelpStickies().length === 0) {
    showHelpStickies();
  } else {
    destroyHelpStickies();
  }
});

function getHelpStickies() {
  return document.querySelectorAll('[data-help="true"]');
}

function animateNotesAppear(notes) {
  if (!notes) return;

  const list = Array.isArray(notes) ? notes : [notes];

  list.forEach(note => {
    if (!note) return;

    const rot = Math.random() * 6 - 3;

    note.style.transform = `scale(0.8) rotate(${rot}deg)`;
    note.style.opacity = "0";

    requestAnimationFrame(() => {
      note.style.transition =
        "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease";

      note.style.transform = `scale(1) rotate(${rot}deg)`;
      note.style.opacity = "1";
    });
  });
}














const submenus = document.querySelectorAll(".has-submenu");

submenus.forEach(menu => {
  menu.addEventListener("click", function (e) {
    e.stopPropagation();

    // chiude gli altri submenu
    submenus.forEach(m => {
      if (m !== this) m.classList.remove("active");
    });

    this.classList.toggle("active");
  });
});

// chiude tutti cliccando fuori
document.addEventListener("click", function () {
  submenus.forEach(menu => menu.classList.remove("active"));
});


const fontSizeSpan = document.getElementById("fontSizeValue");
const increaseBtn = document.getElementById("increaseFont");
const decreaseBtn = document.getElementById("decreaseFont");

let currentSize = 16;

function applyFontSize(size) {
  currentSize = size;

  document.documentElement.style.setProperty(
    "--base-font-size",
    size + "px"
  );

  fontSizeSpan.textContent = size + "px";
}

/* BOTTONI */
increaseBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  if (currentSize < 40) {
    applyFontSize(currentSize + 1);
  }
});

decreaseBtn.addEventListener("click", function (e) {
  e.stopPropagation();
  if (currentSize > 10) {
    applyFontSize(currentSize - 1);
  }
});

/* MODIFICA MANUALE */
fontSizeSpan.addEventListener("blur", function () {
  let value = this.textContent.replace("px", "").trim();
  value = parseInt(value);

  if (!isNaN(value)) {
    if (value < 10) value = 10;
    if (value > 40) value = 40;
    applyFontSize(value);
  } else {
    // se scrive roba non valida torna al valore corrente
    applyFontSize(currentSize);
  }
});

/* evita invio */
fontSizeSpan.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    this.blur();
  }
});

/* inizializza */
applyFontSize(currentSize);



const fontMenu = document.getElementById("fontMenu");
const fontOptions = fontMenu.querySelectorAll("[data-font]");

fontOptions.forEach(option => {
  option.addEventListener("click", function (e) {
    e.stopPropagation();

    const selectedFont = this.dataset.font;
    let fontFamily;

    switch (selectedFont) {
      case "Lexend":
        fontFamily = '"Lexend", sans-serif';
        break;
      case "Atkinson":
        fontFamily = '"Atkinson Hyperlegible", sans-serif';
        break;
      case "IbmMono":
        fontFamily = '"IBM Plex Mono", monospace';
        break;
      case "Roboto":
        fontFamily = '"Roboto", sans-serif';
        break;
      default:
        fontFamily = 'Inter, sans-serif';
    }

    document.documentElement.style.setProperty(
      "--app-font-ui",
      fontFamily
    );

    fontMenu.classList.remove("active");
  });
});



const cmapBtn = document.getElementById("cmapBtn");
cmapBtn.addEventListener("click", () => {
  StickyApp.saveProject();
  window.location.href = "mapEditor.html";
});

const savedPDF = localStorage.getItem("cmapPDF");

if (savedPDF) {

  try {

    const binary = atob(savedPDF);
    const len = binary.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    pdfjsLib.getDocument({ data: bytes }).promise.then(pdf => {
      renderPDF(pdf);
    });

    uploadToolbar.classList.add("hidden");
    mediaToolbar.classList.remove("hidden");
    helpToolbar.classList.remove("hidden");

  } catch (err) {
    console.error("Errore nel caricamento PDF salvato:", err);
    localStorage.removeItem("cmapPDF");
  }
}


const changePDFBtn = document.getElementById("ChangePDF");

if (changePDFBtn) {

  changePDFBtn.addEventListener("click", () => {

    synth.cancel();

    localStorage.removeItem("cmapProject");
    localStorage.removeItem("cmapPDF");

    // 🔥 reset render PDF
    pdfAlreadyRendered = false;

    if (window.StickyApp) {
      StickyApp.activeStickyNote = null;
    }

    const pdfSheet = document.getElementById("pdfSheet");
    if (pdfSheet) pdfSheet.innerHTML = "";

    if (window.readerState) {
      readerState.words = [];
      readerState.index = 0;
    }

    pdfSpanId = 0;

    console.log("Cache progetto eliminata");

    uploadToolbar?.classList.remove("hidden");
    mediaToolbar?.classList.add("hidden");
    helpToolbar?.classList.add("hidden");
  });

}