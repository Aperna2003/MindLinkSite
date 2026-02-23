const DRAG_BORDER_SIZE = 30;

/* =========================
   GLOBAL STICKY APP
========================= */

window.StickyApp = {

    canvas: null,
    btnAdd: null,
    activeStickyNote: null,
    draggedWord: null,

    state: {
        scale: 1,
        viewportX: 0,
        viewportY: 0,
        isPanning: false,
        panStart: { x: 0, y: 0 },
        isDraggingNote: false,
        draggedNote: null,
        dragOffset: { x: 0, y: 0 },
        lastMouse: { x: 0, y: 0 },
        zIndexCounter: 100
    },

    THEME_CLASSES: [
        "sticky-note--yellow",
        "sticky-note--blue",
        "sticky-note--green",
        "sticky-note--pink"
    ],

    init() {
        this.isMapEditor = window.location.pathname.toLowerCase().includes("mapeditor");

        this.canvas = document.getElementById("canvas");
        this.btnAdd = document.getElementById("btn-add");

        window.addEventListener("mousedown", this.onMouseDown.bind(this));
        window.addEventListener("mousemove", this.onMouseMove.bind(this));
        window.addEventListener("mouseup", this.onMouseUp.bind(this));
        window.addEventListener("wheel", this.onWheel.bind(this), { passive: false });

        const savedPDF = localStorage.getItem("cmapPDF");

        if (savedPDF) {

            const binary = atob(savedPDF);
            const len = binary.length;
            const bytes = new Uint8Array(len);

            for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            pdfjsLib.getDocument({ data: bytes }).promise.then(pdf => {
                if (typeof renderPDF === "function") {
                    renderPDF(pdf);
                }
            });
        }

        if (this.btnAdd) {
            this.btnAdd.addEventListener("click", () => {
                const note = this.createNote();
                if (typeof animateNotesAppear === "function") {
                    animateNotesAppear(note);
                }
            });
        }

        if (this.isMapEditor) {

            this.canvas.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            this.canvas.addEventListener("drop", (e) => {
                e.preventDefault();

                const type = e.dataTransfer.getData("source-type");
                if (type !== "sticky-word") return;

                const text = e.dataTransfer.getData("text/plain");
                if (!text) return;

                this.createMapNode(e.clientX, e.clientY, text);

                if (this.draggedWord) {

                    const parentNote = this.draggedWord.closest(".sticky-note");

                    this.draggedWord.remove();

                    if (parentNote) {
                        const remaining = parentNote.querySelectorAll(".sticky-word");
                        if (remaining.length === 0) {
                            parentNote.remove();
                        }
                    }

                    this.draggedWord = null;

                    this.saveProject();
                }
            });
        }

        this.loadProject();
    },

    screenToWorld(sx, sy) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (sx - rect.left - this.state.viewportX) / this.state.scale,
            y: (sy - rect.top - this.state.viewportY) / this.state.scale
        };
    },

    createNote(initialX, initialY) {

        const note = document.createElement("article");

        note.dataset.type = "text";

        const theme = this.THEME_CLASSES[
            Math.floor(Math.random() * this.THEME_CLASSES.length)
        ];

        note.className = `sticky-note ${theme}`;
        note.style.zIndex = ++this.state.zIndexCounter;

        const center = this.screenToWorld(
            window.innerWidth / 2,
            window.innerHeight / 2
        );

        const x = (initialX !== undefined) ? initialX : center.x - 120;
        const y = (initialY !== undefined) ? initialY : center.y - 120;

        const randomRot = Math.random() * 4 - 2;

        note.style.left = `${x}px`;
        note.style.top = `${y}px`;
        note.style.transform = `rotate(${randomRot}deg)`;

        const textarea = document.createElement("textarea");
        textarea.className = "sticky-note__content";
        textarea.placeholder = "Take a note...";

        note.appendChild(textarea);

        textarea.addEventListener("input", () => {
            StickyApp.saveProject();
        });

        note.addEventListener("dragover", (e) => {
            if (note.dataset.type !== "text") return;
            e.preventDefault();
        });

        note.addEventListener("drop", (e) => {
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
            textarea.selectionStart =
                textarea.selectionEnd = start + text.length + 1;
        });

        note.addEventListener("mousemove", (e) => {
            if (this.state.isDraggingNote) return;

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

        note.addEventListener("mousedown", (e) => {
            this.handleNoteMouseDown(e);
        });

        this.canvas.appendChild(note);

        this.saveProject();

        return note;
    },

    createListNote(initialX, initialY) {

        const note = document.createElement("article");

        note.dataset.type = "list";

        const theme = this.THEME_CLASSES[
            Math.floor(Math.random() * this.THEME_CLASSES.length)
        ];

        note.className = `sticky-note ${theme}`;
        note.style.zIndex = ++this.state.zIndexCounter;

        note.style.left = initialX || "120px";
        note.style.top = initialY || "120px";

        const content = document.createElement("div");
        content.className = "sticky-note__content";

        note.appendChild(content);

        note.addEventListener("mousedown", (e) => {
            this.handleNoteMouseDown(e);
        });

        this.canvas.appendChild(note);

        this.activeStickyNote = note;

        this.saveProject();

        return note;
    },

    makeNodeDraggable(node) {

        let offsetX = 0;
        let offsetY = 0;
        let dragging = false;

        node.addEventListener("mousedown", (e) => {
            if (document.activeElement === node) return;

            dragging = true;
            offsetX = e.offsetX;
            offsetY = e.offsetY;
            node.style.zIndex = ++this.state.zIndexCounter;
        });

        window.addEventListener("mousemove", (e) => {
            if (!dragging) return;

            const world = this.screenToWorld(e.clientX, e.clientY);

            node.style.left = (world.x - offsetX) + "px";
            node.style.top = (world.y - offsetY) + "px";
        });

        window.addEventListener("mouseup", () => {
            if (dragging) {
                dragging = false;
                StickyApp.saveProject();
            }
        });
    },

    createMapNode(x, y, text, isWorld = false) {
        let world;

        if (isWorld) {
            world = { x, y };
        } else {
            world = this.screenToWorld(x, y);
        }

        const node = document.createElement("div");
        node.className = "map-node";
        node.textContent = text;
        node.setAttribute("contenteditable", "true");

        node.addEventListener("input", () => {
            this.saveProject();
        });

        node.style.position = "absolute";
        node.style.left = world.x + "px";
        node.style.top = world.y + "px";
        node.style.zIndex = ++this.state.zIndexCounter;

        this.canvas.appendChild(node);

        this.makeNodeDraggable(node);

        if (!isWorld) this.saveProject();
    },

    handleNoteMouseDown(e) {

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

        this.state.isDraggingNote = true;
        this.state.draggedNote = note;

        if (typeof showDeleteToolbar === "function") {
            showDeleteToolbar();
        }

        note.style.zIndex = ++this.state.zIndexCounter;
        note.classList.add("sticky-note--dragging");

        const worldMouse = this.screenToWorld(e.clientX, e.clientY);
        const noteLeft = parseFloat(note.style.left);
        const noteTop = parseFloat(note.style.top);

        this.state.dragOffset.x = worldMouse.x - noteLeft;
        this.state.dragOffset.y = worldMouse.y - noteTop;
        this.state.lastMouse = { x: e.clientX, y: e.clientY };
    },

    onMouseMove(e) {
        if (this.state.isDraggingNote && this.state.draggedNote) {

            const worldMouse = this.screenToWorld(e.clientX, e.clientY);

            const deltaX = e.clientX - this.state.lastMouse.x;
            const velocity = Math.max(-25, Math.min(25, deltaX * 1.5));

            const x = worldMouse.x - this.state.dragOffset.x;
            const y = worldMouse.y - this.state.dragOffset.y;

            this.state.draggedNote.style.left = `${x}px`;
            this.state.draggedNote.style.top = `${y}px`;
            this.state.draggedNote.style.transform =
                `scale(1.02) rotate(${velocity}deg)`;

            this.state.lastMouse = { x: e.clientX, y: e.clientY };

            if (typeof deleteDropzone !== "undefined" && deleteDropzone) {

                const rect = deleteDropzone.getBoundingClientRect();
                const mouseX = e.clientX;
                const mouseY = e.clientY;

                const isOver =
                    mouseX >= rect.left &&
                    mouseX <= rect.right &&
                    mouseY >= rect.top &&
                    mouseY <= rect.bottom;

                if (isOver) {
                    deleteDropzone.classList.add("active");
                } else {
                    deleteDropzone.classList.remove("active");
                }
            }

        }
    },

    onMouseUp() {
        if (this.state.isDraggingNote && this.state.draggedNote) {

            const note = this.state.draggedNote;

            note.classList.remove("sticky-note--dragging");

            const randomRestRot = Math.random() * 6 - 3;
            note.style.transform = `rotate(${randomRestRot}deg)`;

            if (this.state.isDraggingNote && this.state.draggedNote) {

                const note = this.state.draggedNote;

                const rect = deleteDropzone?.getBoundingClientRect?.();
                const mouseX = this.state.lastMouse.x;
                const mouseY = this.state.lastMouse.y;

                const isOverDelete = rect &&
                    mouseX >= rect.left &&
                    mouseX <= rect.right &&
                    mouseY >= rect.top &&
                    mouseY <= rect.bottom;

                if (isOverDelete) {

                    const words = note.querySelectorAll(".sticky-word");

                    words.forEach(w => {
                        const linked = w._pdfSpans || [];
                        linked.forEach(sp => {
                            sp.classList.remove("saved");
                            sp.dataset.saved = "0";
                        });
                    });

                    if (this.activeStickyNote === note) {
                        this.activeStickyNote = null;
                    }

                    note.remove();

                } else {
                    note.classList.remove("sticky-note--dragging");
                    const randomRestRot = Math.random() * 6 - 3;
                    note.style.transform = `rotate(${randomRestRot}deg)`;
                }

                this.state.isDraggingNote = false;
                this.state.draggedNote = null;

                this.saveProject();
            }

            if (typeof hideDeleteToolbar === "function") {
                hideDeleteToolbar();
            }
        }
    },

    onMouseDown(e) {
        if (e.target.closest(".sticky-app__toolbar") || this.state.isDraggingNote)
            return;

        this.state.isPanning = true;
    },

    onWheel(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
        }
    },

    attachStickyWordEvents(span) {

        span.draggable = true;

        span.addEventListener("dragstart", (e) => {
            this.draggedWord = span;
            span.classList.add("dragging");

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

            const sig1 = span.dataset.sig ? span.dataset.sig.split(",") : [];
            const sig2 = draggedEl.dataset.sig ? draggedEl.dataset.sig.split(",") : [];

            const merged = [...new Set([...sig1, ...sig2])];

            if (merged.length) {
                span.dataset.sig = merged.join(",");
            }

            draggedEl.remove();

            this.saveProject();
        });

        span.addEventListener("contextmenu", e => {
            e.preventDefault();

            const sig = span.dataset.sig;

            if (sig) {
                sig.split(",").forEach(pid => {
                    const pdfSpan = document.querySelector(`.pdf-word[data-pid="${pid}"]`);
                    if (pdfSpan) {
                        pdfSpan.classList.remove("saved");
                        pdfSpan.dataset.saved = "0";
                    }
                });
            }

            span.remove();
            this.saveProject();
        });
    },



    projectKey: "cmapProject",

    saveProject() {

        const project = {
            textNotes: [],
            mapNodes: [],
            highlights: []
        };

        const notes = this.canvas.querySelectorAll(".sticky-note");

        notes.forEach(note => {
            if (note.dataset.help) return;

            const textarea = note.querySelector("textarea");
            const contentDiv = note.querySelector(".sticky-note__content");

            project.textNotes.push({
                type: note.dataset.type,
                content: textarea
                    ? textarea.value
                    : contentDiv?.innerHTML || "",
                left: note.style.left,
                top: note.style.top,
                transform: note.style.transform,
                colorClass: [...note.classList]
                    .find(c => this.THEME_CLASSES.includes(c))
            });
        });

        if (this.isMapEditor) {

            const nodes = this.canvas.querySelectorAll(".map-node");

            nodes.forEach(node => {
                project.mapNodes.push({
                    text: node.textContent,
                    left: node.style.left,
                    top: node.style.top
                });
            });

        } else {
            // Se NON sei in mapEditor, conserva i nodi vecchi
            const oldRaw = localStorage.getItem(this.projectKey);
            const oldProject = oldRaw ? JSON.parse(oldRaw) : null;
            project.mapNodes = oldProject?.mapNodes || [];
        }

        const existingRaw = localStorage.getItem(this.projectKey);
        const oldProject = existingRaw ? JSON.parse(existingRaw) : null;

        const pdfWords = document.querySelectorAll(".pdf-word");

        if (pdfWords.length > 0) {
            const savedHighlights = Array.from(
                document.querySelectorAll(".pdf-word.saved")
            ).map(span => span.dataset.pid);

            project.highlights = savedHighlights;

        } else
            project.highlights = oldProject?.highlights || [];

        localStorage.setItem(this.projectKey, JSON.stringify(project));
    },

    loadProject() {
        console.log("LOAD START");

        this.activeStickyNote = null;

        const raw = localStorage.getItem(this.projectKey);
        if (!raw) return;

        const project = JSON.parse(raw);

        if (project.textNotes) {

            project.textNotes.forEach(data => {

                let note = null;

                if (data.type === "text") {

                    note = this.createNote();
                    note.querySelector("textarea").value = data.content;

                } else if (data.type === "list") {

                    note = this.createListNote();

                    const content = note.querySelector(".sticky-note__content");
                    content.innerHTML = data.content;

                    content.querySelectorAll(".sticky-word").forEach(word => {
                        this.attachStickyWordEvents(word);
                    });

                    this.activeStickyNote = note;
                }

                if (!note) return;

                note.style.left = data.left;
                note.style.top = data.top;
                note.style.transform = data.transform;

                if (data.colorClass) {
                    this.THEME_CLASSES.forEach(c => note.classList.remove(c));
                    note.classList.add(data.colorClass);
                }
            });
        }

        if (this.isMapEditor && Array.isArray(project.mapNodes)) {

            project.mapNodes.forEach(data => {
                this.createMapNode(
                    parseFloat(data.left),
                    parseFloat(data.top),
                    data.text,
                    true
                );
            });
        }
    }
};

/* =========================
   AUTO INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {
    StickyApp.init();
});