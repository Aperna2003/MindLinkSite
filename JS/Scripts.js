const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const browse = document.getElementById("browse");

if (dropzone && fileInput && browse) {

    browse.onclick = () => fileInput.click();

    fileInput.onchange = () => handleFile(fileInput.files[0]);

    dropzone.ondragover = e => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    };

    dropzone.ondragleave = () => {
        dropzone.classList.remove("dragover");
    };

    dropzone.ondrop = e => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        handleFile(e.dataTransfer.files[0]);
    };
}


const uploadToolbar = document.getElementById("uploadToolbar");
const mediaToolbar = document.getElementById("mediaToolbar");

function handleFile(file) {
    if (!file) return;
    if (file.type !== "application/pdf") {
        alert("Carica un PDF");
        return;
    }
    console.log("PDF caricato:", file.name);

    //switch toolbar
    uploadToolbar.classList.add("hidden");
    mediaToolbar.classList.remove("hidden");
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

/* ===== FAKE AUDIO STATE ===== */
const audioState = {
    playing: false,
    volume: 100
};

const playPauseBtn = document.getElementById("playPauseBtn");
const playPauseIcon = document.getElementById("playPauseIcon");
const stopBtn = document.getElementById("stopBtn");
const volumeSlider = document.getElementById("volumeSlider");
const volumeIcon = document.getElementById("volumeIcon");

/* ===== PLAY / PAUSE ===== */
playPauseBtn.addEventListener("click", () => {
    audioState.playing = !audioState.playing;
    playPauseIcon.src = audioState.playing
        ? "img/pauseIcon.png"
        : "img/playIcon.png";
    console.log("PLAY:", audioState.playing);
});

/* ===== STOP ===== */
stopBtn.addEventListener("click", () => {
    audioState.playing = false;
    playPauseIcon.src = "img/playIcon.png";

    console.log("STOP");
});

/* ===== VOLUME ===== */
volumeSlider.addEventListener("input", () => {
    audioState.volume = parseInt(volumeSlider.value, 10);
    updateVolumeIcon(audioState.volume);

    console.log("VOLUME:", audioState.volume);
});

/* ===== ICON LOGIC ===== */
function updateVolumeIcon(volume) {
    if (volume === 0) {
        volumeIcon.src = "img/volume/offIcon.png";
    } else if (volume < 50) {
        volumeIcon.src = "img/volume/lowIcon.png";
    } else if (volume < 100) {
        volumeIcon.src = "img/volume/midIcon.png";
    } else {
        volumeIcon.src = "img/volume/highIcon.png";
    }
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

    console.log("MUTE TOGGLE →", audioState.volume);
});

/* init */
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
    }
  }

  function onMouseUp() {
    if (state.isPanning) {
      state.isPanning = false;
      canvas.classList.remove("sticky-app__canvas--panning");
    }

    if (state.isDraggingNote && state.draggedNote) {
      const note = state.draggedNote;
      note.classList.remove("sticky-note--dragging");
      note.classList.add("sticky-note--animate-drop");

      const randomRestRot = Math.random() * 6 - 3;
      note.style.transform = `rotate(${randomRestRot}deg)`;

      state.isDraggingNote = false;
      state.draggedNote = null;
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

  btnAdd.addEventListener("click", () => createNote());
})();
