const SENTENCE_END_REGEX = /[.!?]$/;

/* ===== AUDIO STATE ===== */
const audioState = {
  playing: false,
  volume: 100,
  rate: 1
};

/* ===== READER STATE ===== */
const readerState = {
  words: [],
  index: 0,              
  sentenceStart: 0,      
  sentenceWords: [],
  sentenceIndex: 0,
  speaking: false
};


/* ===== SPEECH SYNTH ===== */
const synth = window.speechSynthesis;
let currentUtterance = null;
let activeStickyNote = null;


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
  deleteToolbar.classList.remove("hidden");
}

function hideDeleteToolbar() {
  deleteToolbar.classList.add("hidden");

  if (readerState.words.length > 0) {
    mediaToolbar.classList.remove("hidden");
  } else {
    uploadToolbar.classList.remove("hidden");
  }
}



async function handleFile(file) {
  if (!file || file.type !== "application/pdf") {
    alert("Carica un PDF valido");
    return;
  }

  uploadToolbar.classList.add("hidden");
  mediaToolbar.classList.remove("hidden");

  createHelpStickyNote();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  pdfSheet.innerHTML = "";
  readerState.words = [];
  readerState.index = 0;
  readerState.reading = false;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    content.items.forEach(item => {
      item.str.split(/\s+/).forEach(word => {
        if (!word) return;

        const span = document.createElement("span");
        span.className = "pdf-word";
        span.textContent = word + " ";

        span.addEventListener("click", (e) => {
          e.preventDefault();

          const word = span.textContent.trim();
          addWordToSticky(word);
        });

        span.addEventListener("contextmenu", (e) => {
          e.preventDefault(); // blocca menu browser

          synth.cancel();

          readerState.index = readerState.words.indexOf(span);
          audioState.playing = true;
          readerState.speaking = false;

          playPauseIcon.src = "img/pauseIcon.png";

          requestAnimationFrame(speakSentence);
        });



        pdfSheet.appendChild(span);
        readerState.words.push(span);
      });
    });

    pdfSheet.appendChild(document.createElement("br"));
    pdfSheet.appendChild(document.createElement("br"));
  }
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

  const sentenceText = readerState.sentenceWords.join(" ");

  currentUtterance = new SpeechSynthesisUtterance(sentenceText);
  currentUtterance.lang = "it-IT";
  currentUtterance.volume = audioState.volume / 100;
  currentUtterance.rate = audioState.rate;

  readerState.speaking = true;

  currentUtterance.onboundary = e => {
    if (e.name === "word") {
      const spoken = sentenceText.slice(0, e.charIndex);
      readerState.sentenceIndex = spoken.trim().split(/\s+/).length;
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

function restartFromLastWord() {
  if (!audioState.playing) return;

  synth.cancel();
  readerState.speaking = false;

  // torna esattamente all'ultima parola completata
  readerState.index =
    readerState.sentenceStart + readerState.sentenceIndex;

  requestAnimationFrame(speakSentence);
}


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



volumeSlider.addEventListener("input", () => {
  audioState.volume = parseInt(volumeSlider.value, 10);
  updateVolumeIcon(audioState.volume);
  restartFromLastWord();
});

speedSlider.addEventListener("input", () => {
  audioState.rate = parseFloat(speedSlider.value);
  restartFromLastWord();
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

  if (audioState.playing) {
    restartFromLastWord();
  }

  console.log("MUTE TOGGLE →", audioState.volume);
});


updateVolumeIcon(audioState.volume);














































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

    note.appendChild(textarea);

    note.addEventListener("mousedown", handleNoteMouseDown);

    canvas.appendChild(note);

    note.animate(
      [
        { transform: `scale(0.8) rotate(${randomRot}deg)`, opacity: 0 },
        { transform: `scale(1) rotate(${randomRot}deg)`, opacity: 1 }
      ],
      { duration: 300, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
    );
  }

  function handleNoteMouseDown(e) {
    if (e.target.tagName === "TEXTAREA") return;

    e.preventDefault();
    e.stopPropagation();

    const note = e.currentTarget;
    state.isDraggingNote = true;
    state.draggedNote = note;

    state.zIndexCounter++;
    note.style.zIndex = state.zIndexCounter;

    note.classList.remove("sticky-note--animate-drop");
    note.classList.add("sticky-note--dragging");

    const rect = note.getBoundingClientRect();
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

        if (note === activeStickyNote) {
          activeStickyNote = null;
        }
      }else {
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

  function handleNoteMouseDown(e) {
    if (e.target.tagName === "TEXTAREA") return;

    e.preventDefault();
    e.stopPropagation();

    const note = e.currentTarget;
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


  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("wheel", onWheel, { passive: false });

  btnAdd.addEventListener("click", () => createNote());
})();

function getRandomStickyColorClass() {
  const colors = [
    "sticky-note--yellow",
    "sticky-note--blue",
    "sticky-note--green",
    "sticky-note--pink"
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}

function createHelpStickyNote() {
  const canvas = document.getElementById("canvas");

  if (document.getElementById("helpSticky")) return;

  const note = document.createElement("article");
  note.id = "helpSticky";
  note.className = `sticky-note ${getRandomStickyColorClass()} sticky-note--readonly`;
  note.style.left = "1500px";
  note.style.top = "80px";
  note.style.zIndex = 1000;

  const content = document.createElement("div");
  content.className = "sticky-note__content sticky-note__content--readonly";

  const rows = [
    { titolo: "Comandi" },
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
  note.addEventListener("mousedown", handleNoteMouseDown);
  canvas.appendChild(note);
}


window.createStickyNote = function () {
  const canvas = document.getElementById("canvas");

  const note = document.createElement("article");
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
};


function addWordToSticky(word) {
  if (!activeStickyNote) {
    activeStickyNote = createStickyNote();
  }

  const content = activeStickyNote.querySelector(".sticky-note__content");

  const span = document.createElement("span");
  span.className = "sticky-word";
  span.textContent = word;

  span.addEventListener("click", () => {
    span.remove();
  });

  content.appendChild(span);
}

function isOverDeleteZone(note) {
  const noteRect = note.getBoundingClientRect();
  const deleteRect = deleteDropzone.getBoundingClientRect();

  return !(
    noteRect.right < deleteRect.left ||
    noteRect.left > deleteRect.right ||
    noteRect.bottom < deleteRect.top ||
    noteRect.top > deleteRect.bottom
  );
}
