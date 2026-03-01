const DRAG_BORDER_SIZE = 30;

/* =========================
   GLOBAL STICKY APP
========================= */

window.StickyApp = {

    canvas: null,
    btnAdd: null,
    activeStickyNote: null,
    draggedWord: null,
    draggedMapNode: null,
    selectedNode: null,
    savedSelection: null,
    linking: false,
    connections: [],
    linkStartNode: null,
    linkStartSide: null,
    tempLine: null,
    lastMousePosition: { x: 0, y: 0 },
    _activeDragNode: null,
    _activeResizeNode: null,
    _dragOffsetX: 0,
    _dragOffsetY: 0,
    _resizeData: null,
    _dragSystemInitialized: false,
    isSelecting: false,
    selectionStart: { x: 0, y: 0 },
    selectionBox: null,


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
        zIndexCounter: 810
    },

    THEME_CLASSES: [
        "sticky-note--yellow",
        "sticky-note--blue",
        "sticky-note--green",
        "sticky-note--pink"
    ],

    deselectNode() {

        const multi = this.getMultiSelectedNodes();

        // 🔥 Se c'è multi selezione NON fare nulla
        if (multi.length > 1) return;

        if (!this.selectedNode) return;

        this.selectedNode.classList.remove("selected");
        this.selectedNode.querySelectorAll(".link-btn").forEach(b => b.remove());
        this.selectedNode = null;

        const insertImageBtn = document.getElementById("insertImage");
        const imageDivider = document.getElementById("imageDivider");

        insertImageBtn?.classList.remove("hidden-image-tool");
        imageDivider?.classList.remove("hidden-image-tool");
    },

    insertImageIntoNode() {

        const multi = this.getMultiSelectedNodes();
        if (multi.length > 1) return;

        if (!this.selectedNode) return;

        // 🚫 NON permettere su relation node
        if (this.selectedNode.classList.contains("relation-node")) {
            return;
        }

        const content = this.selectedNode.querySelector(".map-node__content");
        if (!content) return;

        // Crea input file invisibile
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";

        input.onchange = (e) => {

            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = (event) => {

                const img = document.createElement("img");
                img.src = event.target.result;

                img.draggable = false;
                img.style.width = "100%";
                img.style.height = "auto";
                img.style.display = "block";
                img.style.marginBottom = "8px";
                img.style.borderRadius = "6px";
                img.style.userSelect = "none";
                img.style.pointerEvents = "none";

                // 🔥 Salva il testo esistente
                const existingHTML = content.innerHTML;

                // 🔥 Svuota il contenuto
                content.innerHTML = "";

                // 🔥 Inserisci prima immagine
                content.appendChild(img);

                // 🔥 Poi reinserisci testo sotto
                const textWrapper = document.createElement("div");
                textWrapper.innerHTML = existingHTML;

                content.appendChild(textWrapper);

                // 🔥 Imposta larghezza iniziale nodo
                this.selectedNode.style.width = "300px";

                this.saveProject();
            };

            reader.readAsDataURL(file);
        };

        input.click();
    },

    selectNodesInBox(x, y, width, height) {

        const nodes = this.canvas.querySelectorAll(".map-node");

        nodes.forEach(node => {

            const rect = node.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();

            const nodeX = rect.left - canvasRect.left;
            const nodeY = rect.top - canvasRect.top;

            const intersects =
                nodeX < x + width &&
                nodeX + rect.width > x &&
                nodeY < y + height &&
                nodeY + rect.height > y;

            node.classList.toggle("multi-selected", intersects);
        });
    },

    init() {
        this.isMapEditor = window.location.pathname.toLowerCase().includes("mapeditor");

        this.canvas = document.getElementById("canvas");
        this.btnAdd = document.getElementById("btn-add");

        this.btnNode = document.getElementById("btnNode");

        const boldBtn = document.getElementById("bold");
        const italicBtn = document.getElementById("italic");
        const underlineBtn = document.getElementById("underline");
        const strikeBtn = document.getElementById("stike");

        this.canvas.addEventListener("dragstart", (e) => {

            // 🔵 Permetti drag delle sticky-word
            if (e.target.classList.contains("sticky-word")) return;

            // 🔵 Permetti drag delle textarea sticky
            if (e.target.closest("textarea")) return;

            // 🔴 Blocca drag dei map-node (evita ghost image)
            if (e.target.closest(".map-node")) {
                e.preventDefault();
            }
        });

        boldBtn?.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.applyTextStyle("bold");
        });

        italicBtn?.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.applyTextStyle("italic");
        });

        underlineBtn?.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.applyTextStyle("underline");
        });

        strikeBtn?.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.applyTextStyle("strikeThrough");
        });

        this.canvas.addEventListener("contextmenu", (e) => {
            e.preventDefault(); // blocca menu destro
        });

        const insertImageBtn = document.getElementById("insertImage");

        insertImageBtn?.addEventListener("click", () => {
            this.insertImageIntoNode();
        });

        document.addEventListener("selectionchange", () => {

            if (!this.selectedNode) return;

            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);

            if (this.selectedNode.contains(range.commonAncestorContainer)) {
                this.savedSelection = range.cloneRange();
            }
        });

        document.addEventListener("selectionchange", () => {
            this.updateToolbarState();
        });

        document.addEventListener("mousedown", (e) => {

            // 🔵 Se clicco nodo → NON deselezionare
            if (e.target.closest(".map-node")) return;

            // 🔵 Se clicco toolbar → NON deselezionare
            if (e.target.closest(".sticky-app__toolbar")) return;

            // 🔵 Se clicco controlli media → NON deselezionare
            if (e.target.closest(".mediaControl")) return;

            // 🔥 Solo se clicco sulla canvas vuota
            if (e.target === this.canvas) {
                this.clearNodeSelection();
                this.deselectNode();
            }
        });

        window.addEventListener("mousemove", (e) => {

            this.lastMousePosition = { x: e.clientX, y: e.clientY };

            if (!this.linking || !this.tempLine) return;

            const rect = this.canvas.getBoundingClientRect();
            const r1 = this.linkStartNode.getBoundingClientRect();

            const x1 = r1.left + r1.width / 2 - rect.left;
            const y1 = r1.top + r1.height / 2 - rect.top;

            const x2 = e.clientX - rect.left;
            const y2 = e.clientY - rect.top;

            this.tempLine.setAttribute("x1", x1);
            this.tempLine.setAttribute("y1", y1);
            this.tempLine.setAttribute("x2", x2);
            this.tempLine.setAttribute("y2", y2);
        });

        document.addEventListener("click", (e) => {

            // Se clicco sul bottone + NON annullare
            if (e.target.closest(".link-btn")) return;

            if (!this.linking) return;

            this.cancelLinking();
        });

        if (this.btnNode) {
            this.btnNode.addEventListener("click", () => {

                const center = this.screenToWorld(
                    window.innerWidth / 2,
                    window.innerHeight / 2
                );

                // Creo nodo vuoto
                this.createMapNode(center.x - 50, center.y - 20, "");

                // Rendo l’ultimo nodo creato editabile
                const nodes = this.canvas.querySelectorAll(".map-node");
                const lastNode = nodes[nodes.length - 1];

                if (lastNode) {
                    const content = lastNode.querySelector(".map-node__content");
                    if (content) {
                        content.setAttribute("contenteditable", "true");
                        content.focus();
                    }
                }
            });
        }

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
                if (e.target.closest(".sticky-note")) {
                    return;
                }

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

                if (this.draggedTextarea) {

                    const textarea = this.draggedTextarea;
                    const parentNote = textarea.closest(".sticky-note");

                    textarea.value = "";

                    if (!textarea.value.trim() && parentNote) {
                        parentNote.remove();
                    }

                    this.draggedTextarea = null;
                    this.saveProject();
                }
            });
        }

        this.loadProject();
    },

    screenToWorld(sx, sy) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (sx - rect.left),
            y: (sy - rect.top)
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
        textarea.draggable = true;

        textarea.addEventListener("dragover", (e) => {
            if (e.dataTransfer.getData("source-type") === "sticky-word") {
                e.preventDefault();
            }
        });

        textarea.addEventListener("drop", (e) => {

            if (e.dataTransfer.getData("source-type") !== "sticky-word") return;

            e.preventDefault();

            const text = e.dataTransfer.getData("text/plain");
            if (!text) return;

            const start = textarea.selectionStart ?? textarea.value.length;
            const end = textarea.selectionEnd ?? textarea.value.length;

            textarea.value =
                textarea.value.slice(0, start) +
                text + " " +
                textarea.value.slice(end);

            textarea.focus();
            textarea.selectionStart =
                textarea.selectionEnd = start + text.length + 1;

            this.saveProject();
        });

        textarea.addEventListener("dragstart", (e) => {

            const textToSend = textarea.value.trim();
            if (!textToSend) return;

            e.dataTransfer.setData("text/plain", textToSend);
            e.dataTransfer.setData("source-type", "sticky-word");

            this.draggedTextarea = textarea;
        });

        textarea.addEventListener("input", () => {
            this.saveProject();
        });

        note.appendChild(textarea);

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

        note.addEventListener("dragover", (e) => {
            if (e.dataTransfer.getData("source-type") === "map-node") {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        note.addEventListener("drop", (e) => {
            if (e.dataTransfer.getData("source-type") !== "map-node") return;

            if (this.draggedMapNode) {
                const originNote = this.draggedMapNode.closest(".sticky-note");
                if (originNote === note) return;
            }

            e.preventDefault();
            e.stopPropagation();

            const text = e.dataTransfer.getData("text/plain").trim();
            if (!text) return;

            let contentDiv;

            if (note.dataset.type === "list") {
                contentDiv = note.querySelector(".sticky-note__content");
            } else {

                const textarea = note.querySelector("textarea");
                const existingText = textarea ? textarea.value.trim() : "";

                if (textarea) textarea.remove();

                note.dataset.type = "list";

                contentDiv = document.createElement("div");
                contentDiv.className = "sticky-note__content";
                note.appendChild(contentDiv);

                if (existingText) {
                    const firstSpan = document.createElement("span");
                    firstSpan.className = "sticky-word";
                    firstSpan.textContent = existingText;
                    this.attachStickyWordEvents(firstSpan);
                    contentDiv.appendChild(firstSpan);
                }
            }

            const newSpan = document.createElement("span");
            newSpan.className = "sticky-word";
            newSpan.textContent = text;

            this.attachStickyWordEvents(newSpan);
            contentDiv.appendChild(newSpan);

            if (this.draggedMapNode) {
                this.draggedMapNode.remove();
                this.draggedMapNode = null;
            }

            this.saveProject();
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

        note.addEventListener("dragover", (e) => {
            if (e.dataTransfer.getData("source-type") === "map-node") {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        note.addEventListener("drop", (e) => {

            if (e.dataTransfer.getData("source-type") !== "map-node") return;

            e.preventDefault();
            e.stopPropagation();

            const text = e.dataTransfer.getData("text/plain").trim();
            if (!text) return;

            const contentDiv = note.querySelector(".sticky-note__content");

            const span = document.createElement("span");
            span.className = "sticky-word";
            span.textContent = text;

            this.attachStickyWordEvents(span);
            contentDiv.appendChild(span);

            if (this.draggedMapNode) {
                this.draggedMapNode.remove();
                this.draggedMapNode = null;
            }

            this.saveProject();
        });

        this.canvas.appendChild(note);

        this.activeStickyNote = note;

        this.saveProject();

        return note;
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

        node.dataset.id = "node_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

        const resizeLeft = document.createElement("div");
        resizeLeft.className = "resize-handle left";

        const resizeRight = document.createElement("div");
        resizeRight.className = "resize-handle right";



        const content = document.createElement("div");
        content.className = "map-node__content";
        content.innerHTML = text || "\u200B";
        content.setAttribute("contenteditable", "false");

        node.appendChild(content);

        node.appendChild(resizeLeft);
        node.appendChild(resizeRight);
        /*node.setAttribute("contenteditable", "false");*/

        if (!text) {
            requestAnimationFrame(() => {
                const content = node.querySelector(".map-node__content");
                content.setAttribute("contenteditable", "true");
                content.focus();

                // 🔥 ESC per uscire
                content.addEventListener("keydown", (e) => {
                    if (e.key === "Escape") {
                        content.blur();
                    }
                });
            });
        }

        node.addEventListener("dblclick", (e) => {
            e.stopPropagation();

            const content = node.querySelector(".map-node__content");
            content.setAttribute("contenteditable", "true");
            content.focus();

        });

        const content1 = node.querySelector(".map-node__content");

        content1.addEventListener("blur", () => {
            content1.setAttribute("contenteditable", "false");
            this.saveProject();
        });

        node.addEventListener("input", () => {
            if (node.textContent === "\u200B") {
                node.textContent = "";
            }
            this.saveProject();
        });

        node.style.position = "absolute";
        node.style.left = world.x + "px";
        node.style.top = world.y + "px";
        node.style.zIndex = ++this.state.zIndexCounter;

        this.canvas.appendChild(node);

        this.makeNodeDraggable(node);

        if (!isWorld) this.saveProject();

        return node;
    },

    clearNodeSelection() {
        this.canvas.querySelectorAll(".map-node")
            .forEach(n => n.classList.remove("multi-selected"));
    },

    getMultiSelectedNodes() {
        return Array.from(
            this.canvas.querySelectorAll(".map-node.multi-selected")
        );
    },

    startSelectionBox(e) {

        this.clearNodeSelection();

        this.state.isSelecting = true;
        this.state.selectionStart = { x: e.clientX, y: e.clientY };

        const box = document.createElement("div");
        box.className = "selection-box";

        box.style.position = "absolute";
        box.style.border = "1px dashed #4a90e2";
        box.style.background = "rgba(74,144,226,0.1)";
        box.style.pointerEvents = "none";
        box.style.zIndex = "9999";

        this.canvas.appendChild(box);
        this.state.selectionBox = box;

        // Se c'è selezione multipla → disattiva selezione singola
        const multi = this.getMultiSelectedNodes();
        if (multi.length > 0) {
            this.deselectNode();
        }

    },

    makeNodeDraggable(node) {

        const leftHandle = node.querySelector(".resize-handle.left");
        const rightHandle = node.querySelector(".resize-handle.right");

        /* =========================
           SELEZIONE NODO
        ========================= */

        node.addEventListener("mousedown", (e) => {

            if (e.target.closest(".resize-handle")) return;
            if (e.target.closest(".link-btn")) return;

            const content = node.querySelector(".map-node__content");
            if (content && content.getAttribute("contenteditable") === "true") return;

            if (StickyApp.linking && StickyApp.linkStartNode !== node) {
                StickyApp.finalizeLink(node);
                return;
            }

            StickyApp.selectNode(node);
            e.stopPropagation();
        });

        /* =========================
           START RESIZE
        ========================= */

        const startResize = (e, dir) => {

            e.stopPropagation();
            e.preventDefault();

            StickyApp._activeResizeNode = node;

            StickyApp._resizeData = {
                direction: dir,
                startX: e.clientX,
                startWidth: node.offsetWidth,
                startLeft: parseFloat(node.style.left)
            };
        };

        leftHandle?.addEventListener("mousedown", (e) => startResize(e, "left"));
        rightHandle?.addEventListener("mousedown", (e) => startResize(e, "right"));

        /* =========================
           START DRAG
        ========================= */

        node.addEventListener("mousedown", (e) => {

            if (
                e.target.closest(".resize-handle") ||
                e.target.closest(".link-btn")
            ) return;

            const content = node.querySelector(".map-node__content");
            if (content && content.getAttribute("contenteditable") === "true") return;

            StickyApp._activeDragNode = node;

            const world = StickyApp.screenToWorld(e.clientX, e.clientY);

            StickyApp._dragOffsetX =
                world.x - parseFloat(node.style.left);

            StickyApp._dragOffsetY =
                world.y - parseFloat(node.style.top);

            node.style.zIndex = ++StickyApp.state.zIndexCounter;

            if (typeof showDeleteToolbar === "function") {
                showDeleteToolbar(true);
            }
        });

        /* =========================
           GLOBAL LISTENERS (UNA SOLA VOLTA)
        ========================= */

        if (!StickyApp._dragSystemInitialized) {

            StickyApp._dragSystemInitialized = true;

            window.addEventListener("mousemove", (e) => {

                /* ===== RESIZE ===== */

                if (StickyApp._activeResizeNode && StickyApp._resizeData) {

                    const node = StickyApp._activeResizeNode;
                    const data = StickyApp._resizeData;

                    const dx = e.clientX - data.startX;

                    const multi = StickyApp.getMultiSelectedNodes();

                    const targets =
                        multi.length > 1 && multi.includes(node)
                            ? multi
                            : [node];

                    targets.forEach(n => {

                        const hasImage = n.querySelector("img") !== null;

                        const minWidth = hasImage ? 120 : 50;
                        const maxWidth = 1200;

                        if (data.direction === "right") {

                            let newWidth = data.startWidth + dx;

                            newWidth = Math.max(minWidth, newWidth);
                            newWidth = Math.min(maxWidth, newWidth);

                            n.style.width = newWidth + "px";
                        }

                        if (data.direction === "left") {

                            let newWidth = data.startWidth - dx;

                            newWidth = Math.max(minWidth, newWidth);
                            newWidth = Math.min(maxWidth, newWidth);

                            const widthDiff = data.startWidth - newWidth;

                            n.style.width = newWidth + "px";
                            n.style.left = (data.startLeft + widthDiff) + "px";
                        }
                    });

                    StickyApp.updateConnections();
                    return;
                }
                /* ===== DRAG ===== */

                if (!StickyApp._activeDragNode) return;

                const node = StickyApp._activeDragNode;

                const multi = StickyApp.getMultiSelectedNodes();

                if (multi.length > 1 && multi.includes(node)) {

                    const world = StickyApp.screenToWorld(e.clientX, e.clientY);

                    const dx = world.x - StickyApp._dragOffsetX - parseFloat(node.style.left);
                    const dy = world.y - StickyApp._dragOffsetY - parseFloat(node.style.top);

                    multi.forEach(n => {
                        const left = parseFloat(n.style.left);
                        const top = parseFloat(n.style.top);
                        n.style.left = (left + dx) + "px";
                        n.style.top = (top + dy) + "px";
                    });

                } else {

                    const world = StickyApp.screenToWorld(e.clientX, e.clientY);

                    node.style.left =
                        (world.x - StickyApp._dragOffsetX) + "px";

                    node.style.top =
                        (world.y - StickyApp._dragOffsetY) + "px";
                }

                /* Delete dropzone */
                const deleteDropzoneNode =
                    document.getElementById("deleteDropzoneNode");

                if (deleteDropzoneNode) {

                    const rect =
                        deleteDropzoneNode.getBoundingClientRect();

                    const isOver =
                        e.clientX >= rect.left &&
                        e.clientX <= rect.right &&
                        e.clientY >= rect.top &&
                        e.clientY <= rect.bottom;

                    deleteDropzoneNode.classList.toggle("active", isOver);
                    StickyApp.setDeleteIcon("deleteDropzoneNode", isOver);
                }

                /* Note dropzone */
                /* ===== NOTE DROPZONE VISIBILITY ===== */

                const noteDropzone =
                    document.getElementById("noteDropzone");

                if (noteDropzone) {

                    const isRelation = node.classList.contains("relation-node");
                    const rawText = StickyApp.getNodePureText(node)
                        .replace(/\u200B/g, "")   // rimuove zero-width space
                        .trim();

                    const isEmpty = rawText.length === 0;

                    // 🔴 Se relation o vuoto → NASCONDI completamente note dropzone
                    if (isRelation || isEmpty) {

                        noteDropzone.style.display = "none";

                    } else {

                        noteDropzone.style.display = "flex"; // o "" se preferisci

                        const rect = noteDropzone.getBoundingClientRect();

                        const isOver =
                            e.clientX >= rect.left &&
                            e.clientX <= rect.right &&
                            e.clientY >= rect.top &&
                            e.clientY <= rect.bottom;

                        noteDropzone.classList.toggle("active", isOver);

                        const icon = noteDropzone.querySelector("img");
                        if (icon) {
                            icon.src = isOver
                                ? "img/mapEditor/noteIconB.png"
                                : "img/mapEditor/noteIcon.png";
                        }
                    }
                }

                StickyApp.updateConnections();
            });

            window.addEventListener("mouseup", (e) => {

                /* ===== RESIZE STOP ===== */
                StickyApp._activeResizeNode = null;
                StickyApp._resizeData = null;

                const node = StickyApp._activeDragNode;
                if (!node) return;

                const deleteDropzoneNode =
                    document.getElementById("deleteDropzoneNode");

                const noteDropzone =
                    document.getElementById("noteDropzone");

                const deleteRect =
                    deleteDropzoneNode?.getBoundingClientRect();

                const noteRect =
                    noteDropzone?.getBoundingClientRect();

                const isOverDelete =
                    deleteRect &&
                    e.clientX >= deleteRect.left &&
                    e.clientX <= deleteRect.right &&
                    e.clientY >= deleteRect.top &&
                    e.clientY <= deleteRect.bottom;

                const isOverNote =
                    noteRect &&
                    e.clientX >= noteRect.left &&
                    e.clientX <= noteRect.right &&
                    e.clientY >= noteRect.top &&
                    e.clientY <= noteRect.bottom;

                /* =========================
                   DELETE DROPZONE
                ========================= */

                if (isOverDelete) {

                    const multi = StickyApp.getMultiSelectedNodes();

                    // 🔥 CASO MULTI-SELEZIONE
                    if (multi.length > 1 && multi.includes(node)) {

                        multi.forEach(n => {
                            StickyApp.removeConnectionsOfNode(n);
                            n.remove();
                        });

                        StickyApp.clearNodeSelection();
                    }
                    // 🔵 CASO NORMALE
                    else {

                        StickyApp.removeConnectionsOfNode(node);
                        node.remove();
                    }

                    deleteDropzoneNode?.classList.remove("active");
                    StickyApp.setDeleteIcon("deleteDropzoneNode", false);

                    StickyApp._activeDragNode = null;
                    StickyApp.saveProject();

                    if (typeof hideDeleteToolbar === "function") {
                        hideDeleteToolbar();
                    }

                    return;
                }
                /* =========================
                   NOTE DROPZONE
                ========================= */

                if (isOverNote) {

                    // 🚫 NON permettere relation node
                    if (node.classList.contains("relation-node")) {
                        StickyApp._activeDragNode = null;
                        return;
                    }

                    const text = StickyApp.getNodePureText(node);

                    // 🚫 NON permettere nodi vuoti
                    if (!text) {
                        StickyApp._activeDragNode = null;
                        return;
                    }

                    // 🔥 Rimuovi prima le connessioni
                    StickyApp.removeConnectionsOfNode(node);

                    let targetSticky =
                        document.querySelector('.sticky-note[data-type="list"]');

                    if (!targetSticky) {

                        const center = StickyApp.screenToWorld(
                            window.innerWidth / 2,
                            window.innerHeight / 2
                        );

                        targetSticky = StickyApp.createListNote(
                            center.x - 120,
                            center.y - 120
                        );
                    }

                    StickyApp.addNodeToSticky(targetSticky, node);

                    noteDropzone?.classList.remove("active");

                    StickyApp._activeDragNode = null;
                    StickyApp.saveProject();

                    if (typeof hideDeleteToolbar === "function") {
                        hideDeleteToolbar();
                    }

                    return; // 🔥 STOP QUI
                }

                /* =========================
                   NORMAL DRAG END
                ========================= */

                deleteDropzoneNode?.classList.remove("active");
                StickyApp.setDeleteIcon("deleteDropzoneNode", false);

                noteDropzone?.classList.remove("active");

                const icon = noteDropzone?.querySelector("img");
                if (icon) {
                    icon.src = "img/mapEditor/noteIcon.png";
                }

                StickyApp._activeDragNode = null;
                StickyApp.saveProject();

                if (typeof hideDeleteToolbar === "function") {
                    hideDeleteToolbar();
                }
            });

            /*

            window.addEventListener("mouseup", (e) => {


                StickyApp._activeResizeNode = null;
                StickyApp._resizeData = null;

           

                const node = StickyApp._activeDragNode;

                if (node) {

                    const deleteDropzoneNode =
                        document.getElementById("deleteDropzoneNode");

                    const rect =
                        deleteDropzoneNode?.getBoundingClientRect();

                    const isOverDelete =
                        rect &&
                        e.clientX >= rect.left &&
                        e.clientX <= rect.right &&
                        e.clientY >= rect.top &&
                        e.clientY <= rect.bottom;

                    if (isOverDelete) {

                        StickyApp.removeConnectionsOfNode(node);
                        node.remove();
                    }

                    deleteDropzoneNode?.classList.remove("active");
                    StickyApp.setDeleteIcon("deleteDropzoneNode", false);

                    const noteDropzone = document.getElementById("noteDropzone");

                    noteDropzone?.classList.remove("active");

                    const icon = noteDropzone?.querySelector("img");
                    if (icon) {
                        icon.src = "img/mapEditor/noteIcon.png";
                    }


                    const noteRect =
                        noteDropzone?.getBoundingClientRect();

                    const isOverNote =
                        noteRect &&
                        e.clientX >= noteRect.left &&
                        e.clientX <= noteRect.right &&
                        e.clientY >= noteRect.top &&
                        e.clientY <= noteRect.bottom;

                    if (isOverNote) {

                        const text = StickyApp.getNodePureText(node);
                        if (text) {

                            let targetSticky =
                                document.querySelector('.sticky-note[data-type="list"]');

                            if (!targetSticky) {

                                const center = StickyApp.screenToWorld(
                                    window.innerWidth / 2,
                                    window.innerHeight / 2
                                );

                                targetSticky = StickyApp.createListNote(
                                    center.x - 120,
                                    center.y - 120
                                );
                            }

                            StickyApp.addNodeToSticky(targetSticky, node);
                        }

                        noteDropzone?.classList.remove("active");

                        StickyApp._activeDragNode = null;

                        if (typeof hideDeleteToolbar === "function") {
                            hideDeleteToolbar();
                        }

                        return; // 🔥 importantissimo
                    }

                    StickyApp.saveProject();
                }

                StickyApp._activeDragNode = null;

                if (typeof hideDeleteToolbar === "function") {
                    hideDeleteToolbar();
                }
            });
            */
        }
    },

    addNodeToSticky(sticky, node) {

        const text = this.getNodePureText(node);
        if (!text) return;

        let contentDiv;

        if (sticky.dataset.type === "list") {
            contentDiv = sticky.querySelector(".sticky-note__content");
        } else {

            const textarea = sticky.querySelector("textarea");
            const existingText = textarea ? textarea.value.trim() : "";

            if (textarea) textarea.remove();

            sticky.dataset.type = "list";

            contentDiv = document.createElement("div");
            contentDiv.className = "sticky-note__content";
            sticky.appendChild(contentDiv);

            if (existingText) {
                const firstSpan = document.createElement("span");
                firstSpan.className = "sticky-word";
                firstSpan.textContent = existingText;
                this.attachStickyWordEvents(firstSpan);
                contentDiv.appendChild(firstSpan);
            }
        }

        const newSpan = document.createElement("span");
        newSpan.className = "sticky-word";
        newSpan.textContent = text;

        this.attachStickyWordEvents(newSpan);
        contentDiv.appendChild(newSpan);

        node.remove();
        this.saveProject();
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

        if (this.state.isSelecting && this.state.selectionBox) {

            const startX = this.state.selectionStart.x;
            const startY = this.state.selectionStart.y;

            const currentX = e.clientX;
            const currentY = e.clientY;

            const x = Math.min(startX, currentX);
            const y = Math.min(startY, currentY);
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);

            const rect = this.canvas.getBoundingClientRect();

            this.state.selectionBox.style.left = (x - rect.left) + "px";
            this.state.selectionBox.style.top = (y - rect.top) + "px";
            this.state.selectionBox.style.width = width + "px";
            this.state.selectionBox.style.height = height + "px";

            this.selectNodesInBox(
                x - rect.left,
                y - rect.top,
                width,
                height
            );

            return;
        }

        if (this.isMapEditor && this.state.isPanning) {

            const dx = e.clientX - this.state.panStart.x;
            const dy = e.clientY - this.state.panStart.y;

            this.state.panStart = {
                x: e.clientX,
                y: e.clientY
            };

            // 🔥 Sposta tutti i nodi
            const nodes = this.canvas.querySelectorAll(".map-node");

            nodes.forEach(node => {
                const left = parseFloat(node.style.left);
                const top = parseFloat(node.style.top);

                node.style.left = (left + dx) + "px";
                node.style.top = (top + dy) + "px";
            });

            // 🔥 Sposta anche le sticky
            const notes = this.canvas.querySelectorAll(".sticky-note");

            notes.forEach(note => {
                const left = parseFloat(note.style.left);
                const top = parseFloat(note.style.top);

                note.style.left = (left + dx) + "px";
                note.style.top = (top + dy) + "px";
            });

            this.updateConnections();

            return;
        }

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
                    this.setDeleteIcon("deleteDropzone", true);
                } else {
                    deleteDropzone.classList.remove("active");
                    this.setDeleteIcon("deleteDropzone", false);
                }
            }

        }
    },

    onMouseUp() {

        if (this.state.isSelecting) {

            this.state.isSelecting = false;

            if (this.state.selectionBox) {
                this.state.selectionBox.remove();
                this.state.selectionBox = null;
            }

            return;
        }

        if (this.isMapEditor && this.state.isPanning) {
            this.state.isPanning = false;
            return;
        }
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

        if (!this.isMapEditor) return;

        // 🖱 DESTRO = PAN
        if (e.button === 2) {

            this.state.isPanning = true;
            this.state.panStart = {
                x: e.clientX,
                y: e.clientY
            };

            return;
        }

        // 🖱 SINISTRO = selezione multipla
        if (e.button === 0) {

            if (
                e.target.closest(".map-node") ||
                e.target.closest(".sticky-note") ||
                e.target.closest(".sticky-app__toolbar")
            ) return;

            this.startSelectionBox(e);
        }
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

            const originNote = draggedEl.closest(".sticky-note");
            const targetNote = span.closest(".sticky-note");

            if (originNote === targetNote) return;

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

    selectNode(node) {

        const multi = this.getMultiSelectedNodes();

        // 🔥 CASO 1: Sto cliccando un nodo già dentro la multi-selezione
        if (multi.length > 1 && multi.includes(node)) {
            return; // NON fare nulla → mantieni multi
        }

        // 🔥 CASO 2: Clicco nodo fuori dalla multi → pulisci multi
        if (multi.length > 0 && !multi.includes(node)) {
            this.clearNodeSelection();
        }

        // 🔵 comportamento normale
        if (this.selectedNode && this.selectedNode !== node) {
            this.selectedNode.classList.remove("selected");
            this.selectedNode
                .querySelectorAll(".link-btn")
                .forEach(btn => btn.remove());
        }

        this.selectedNode = node;
        node.classList.add("selected");

        const insertImageBtn = document.getElementById("insertImage");
        const imageDivider = document.getElementById("imageDivider");

        if (node.classList.contains("relation-node")) {
            insertImageBtn?.classList.add("hidden-image-tool");
            imageDivider?.classList.add("hidden-image-tool");
        } else {
            insertImageBtn?.classList.remove("hidden-image-tool");
            imageDivider?.classList.remove("hidden-image-tool");
        }

        this.addLinkButton(node);
    },
    applyTextStyle(command) {

        const multi = this.getMultiSelectedNodes();

        if (multi.length > 1) {

            let tag;

            switch (command) {
                case "bold": tag = "strong"; break;
                case "italic": tag = "em"; break;
                case "underline": tag = "u"; break;
                case "strikeThrough": tag = "s"; break;
                default: return;
            }

            // 🔎 Controlla se TUTTI i nodi sono già completamente styled
            const allStyled = multi.every(node => {
                const content = node.querySelector(".map-node__content");
                return this.isEntireNodeStyled(content, tag);
            });

            multi.forEach(node => {

                const content = node.querySelector(".map-node__content");
                if (!content) return;

                if (allStyled) {
                    // 🔥 RIMUOVI stile
                    content.querySelectorAll(tag).forEach(el => this.unwrap(el));
                } else {
                    // 🔥 APPLICA stile
                    const wrapper = document.createElement(tag);
                    wrapper.innerHTML = content.innerHTML;
                    content.innerHTML = "";
                    content.appendChild(wrapper);
                }
            });

            requestAnimationFrame(() => {
                this.updateToolbarState();
            });

            this.saveProject();
            return;
        }

        if (!this.selectedNode) return;

        const content = this.selectedNode.querySelector(".map-node__content");
        if (!content) return;

        const selection = window.getSelection();
        const hasSelection =
            selection.rangeCount &&
            content.contains(selection.getRangeAt(0).commonAncestorContainer) &&
            !selection.isCollapsed;

        let tag;

        switch (command) {
            case "bold": tag = "strong"; break;
            case "italic": tag = "em"; break;
            case "underline": tag = "u"; break;
            case "strikeThrough": tag = "s"; break;
            default: return;
        }

        // 🔵 CASO 1 — C'è selezione → toggle sulla selezione
        if (hasSelection) {

            const range = selection.getRangeAt(0);

            const parentTag = this.getParentTag(range.startContainer, tag);

            if (parentTag) {
                // 🔥 Rimuovi stile
                this.unwrap(parentTag);
            } else {
                // 🔥 Applica stile
                const wrapper = document.createElement(tag);
                wrapper.appendChild(range.extractContents());
                range.insertNode(wrapper);
            }

            selection.removeAllRanges();
        }

        // 🟢 CASO 2 — Nessuna selezione → toggle su tutto il nodo
        else {

            const allStyled = this.isEntireNodeStyled(content, tag);

            if (allStyled) {
                content.querySelectorAll(tag).forEach(el => this.unwrap(el));
            } else {
                const wrapper = document.createElement(tag);
                wrapper.innerHTML = content.innerHTML;
                content.innerHTML = "";
                content.appendChild(wrapper);
            }
        }

        // Piccolo delay per far aggiornare il DOM
        requestAnimationFrame(() => {
            this.updateToolbarState();
        });
        this.saveProject();
    },

    updateToolbarState() {

        const multi = this.getMultiSelectedNodes();
        const insertImageBtn = document.getElementById("insertImage");
        const imageDivider = document.getElementById("imageDivider");

        const commands = [
            { tag: "strong", id: "bold" },
            { tag: "em", id: "italic" },
            { tag: "u", id: "underline" },
            { tag: "s", id: "stike" }
        ];

        /* =========================================================
           🔵 MULTI-SELEZIONE
        ========================================================= */

        if (multi.length > 1) {

            // 🔥 Nascondi immagine
            insertImageBtn?.classList.add("hidden-image-tool");
            imageDivider?.classList.add("hidden-image-tool");

            commands.forEach(c => {

                const btn = document.getElementById(c.id);
                if (!btn) return;

                // Attivo solo se TUTTI i nodi hanno quello stile
                const allStyled = multi.every(node => {
                    const content = node.querySelector(".map-node__content");
                    return this.isEntireNodeStyled(content, c.tag);
                });

                btn.classList.toggle("active", allStyled);
            });

            return; // 🔥 IMPORTANTISSIMO → esce qui
        }

        /* =========================================================
           🟢 SELEZIONE SINGOLA
        ========================================================= */

        /* =========================================================
           🟢 SELEZIONE SINGOLA
        ========================================================= */

        if (!this.selectedNode) {
            insertImageBtn?.classList.remove("hidden-image-tool");
            imageDivider?.classList.remove("hidden-image-tool");

            commands.forEach(c => {
                const btn = document.getElementById(c.id);
                if (btn) btn.classList.remove("active");
            });
            return;
        }

        // 🔥 Se è relation node → nascondi immagine
        if (this.selectedNode.classList.contains("relation-node")) {
            insertImageBtn?.classList.add("hidden-image-tool");
            imageDivider?.classList.add("hidden-image-tool");
        } else {
            insertImageBtn?.classList.remove("hidden-image-tool");
            imageDivider?.classList.remove("hidden-image-tool");
        }

        // Se non c'è nodo selezionato → spegni tutto
        if (!this.selectedNode) {
            commands.forEach(c => {
                const btn = document.getElementById(c.id);
                if (btn) btn.classList.remove("active");
            });
            return;
        }

        const content = this.selectedNode.querySelector(".map-node__content");
        if (!content) return;

        const selection = window.getSelection();

        commands.forEach(c => {

            const btn = document.getElementById(c.id);
            if (!btn) return;

            let active = false;

            const hasSelection =
                selection.rangeCount &&
                !selection.isCollapsed &&
                content.contains(selection.anchorNode);

            // 🔵 Se c'è selezione testo
            if (hasSelection) {

                let node = selection.anchorNode;

                while (node && node !== content) {
                    if (node.nodeName && node.nodeName.toLowerCase() === c.tag) {
                        active = true;
                        break;
                    }
                    node = node.parentNode;
                }
            }
            // 🟢 Nessuna selezione → controlla tutto il nodo
            else {
                active = this.isEntireNodeStyled(content, c.tag);
            }

            btn.classList.toggle("active", active);
        });
    },

    getParentTag(node, tag) {
        while (node && node !== this.selectedNode) {
            if (node.nodeName && node.nodeName.toLowerCase() === tag) {
                return node;
            }
            node = node.parentNode;
        }
        return null;
    },

    unwrap(element) {
        const parent = element.parentNode;
        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
    },

    isEntireNodeStyled(content, tag) {

        if (!content) return false;

        const walker = document.createTreeWalker(
            content,
            NodeFilter.SHOW_TEXT,
            null
        );

        let textNode;
        let hasText = false;

        while ((textNode = walker.nextNode())) {

            const cleanText = textNode.nodeValue
                .replace(/\u200B/g, "") // rimuove zero-width
                .trim();

            if (cleanText !== "") {

                hasText = true;

                let parent = textNode.parentNode;
                let styled = false;

                while (parent && parent !== content) {
                    if (parent.nodeName.toLowerCase() === tag) {
                        styled = true;
                        break;
                    }
                    parent = parent.parentNode;
                }

                if (!styled) return false;
            }
        }

        // 🔥 Se non c'è testo reale → NON è styled
        if (!hasText) return false;

        return true;
    },

    finalizeLink(targetNode) {

        if (!this.linkStartNode) return;

        const startIsRelation = this.linkStartNode.classList.contains("relation-node");
        const targetIsRelation = targetNode.classList.contains("relation-node");

        // 🚫 Non permettere relazione → relazione
        if (startIsRelation && targetIsRelation) {

            // Rimuovi linea temporanea
            if (this.tempLine) {
                this.tempLine.remove();
                this.tempLine = null;
            }

            this.linking = false;
            this.linkStartNode = null;
            return;
        }

        // 🔹 Se uno dei due è relazione → crea solo una linea
        if (startIsRelation || targetIsRelation) {
            this.createConnection(this.linkStartNode, targetNode);
        }
        else {
            // 🔥 Calcolo reale dei bordi come in updateConnections
            const rect = this.canvas.getBoundingClientRect();

            const r1 = this.linkStartNode.getBoundingClientRect();
            const r2 = targetNode.getBoundingClientRect();

            const c1x = r1.left + r1.width / 2 - rect.left;
            const c1y = r1.top + r1.height / 2 - rect.top;

            const c2x = r2.left + r2.width / 2 - rect.left;
            const c2y = r2.top + r2.height / 2 - rect.top;

            const dx = c2x - c1x;
            const dy = c2y - c1y;

            const length = Math.sqrt(dx * dx + dy * dy);
            if (length === 0) return;

            const ux = dx / length;
            const uy = dy / length;

            // Intersezione bordo nodo A
            const t1 = Math.min(
                Math.abs((r1.width / 2) / ux || Infinity),
                Math.abs((r1.height / 2) / uy || Infinity)
            );

            const startX = c1x + ux * t1;
            const startY = c1y + uy * t1;

            // Intersezione bordo nodo B
            const t2 = Math.min(
                Math.abs((r2.width / 2) / ux || Infinity),
                Math.abs((r2.height / 2) / uy || Infinity)
            );

            const endX = c2x - ux * t2;
            const endY = c2y - uy * t2;

            // 🔥 Punto medio REALE della linea
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            const relationNode = this.createMapNode(midX, midY, "", false);
            relationNode.classList.add("relation-node");

            // 🔥 Centro perfetto
            relationNode.style.left =
                (midX - relationNode.offsetWidth / 2) + "px";
            relationNode.style.top =
                (midY - relationNode.offsetHeight / 2) + "px";

            this.createConnection(this.linkStartNode, relationNode);
            this.createConnection(relationNode, targetNode);
        }

        if (this.tempLine) {
            this.tempLine.remove();
            this.tempLine = null;
        }

        this.linking = false;
        this.linkStartNode = null;
    },

    createConnection(fromNode, toNode) {

        const svg = this.getOrCreateSVG();

        const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );

        line.setAttribute("stroke", "#4a90e2");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("marker-end", "url(#arrow)");

        svg.appendChild(line);

        this.connections.push({
            line: line,
            fromNode: fromNode,
            toNode: toNode
        });
        this.updateConnections();
    },

    startLinking(node) {
        console.log("START LINKING");

        // 🔥 Se esiste già una linea temporanea, rimuovila
        if (this.tempLine) {
            this.tempLine.remove();
            this.tempLine = null;
        }

        this.linking = true;
        this.linkStartNode = node;

        const svg = this.getOrCreateSVG();
        const rect = this.canvas.getBoundingClientRect();
        const r = node.getBoundingClientRect();

        const startX = r.left + r.width / 2 - rect.left;
        const startY = r.top + r.height / 2 - rect.top;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        line.setAttribute("x1", startX);
        line.setAttribute("y1", startY);
        line.setAttribute("x2", startX);
        line.setAttribute("y2", startY);

        line.setAttribute("stroke", "#4a90e2");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("marker-end", "url(#arrow)");

        svg.appendChild(line);

        this.tempLine = line;
    },

    getOrCreateSVG() {

        let svg = document.getElementById("connectionLayer");

        if (!svg) {

            svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.id = "connectionLayer";

            svg.style.position = "absolute";
            svg.style.top = "0";
            svg.style.left = "0";
            svg.style.width = "100%";
            svg.style.height = "100%";
            svg.style.pointerEvents = "none";
            svg.style.zIndex = "5";

            svg.innerHTML = `
            <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10"
                    refX="10" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="#4a90e2"/>
                </marker>
            </defs>
        `;

            this.canvas.appendChild(svg);
        }

        return svg;
    },

    cancelLinking() {

        if (!this.linking || !this.linkStartNode) return;

        if (this.tempLine) {
            this.tempLine.remove();
            this.tempLine = null;
        }

        const startNode = this.linkStartNode;

        const world = this.screenToWorld(
            this.lastMousePosition.x,
            this.lastMousePosition.y
        );

        const endNode = this.createMapNode(
            world.x,
            world.y,
            ""
        );

        const content = endNode.querySelector(".map-node__content");

        if (content) {
            content.setAttribute("contenteditable", "true");
            content.focus();
        }

        const startIsRelation = startNode.classList.contains("relation-node");

        // 🔥 SE parte da un relation node → crea solo una linea
        if (startIsRelation) {

            this.createConnection(startNode, endNode);

        } else {

            // 🔥 Nodo normale → crea relation node nel mezzo
            const rect = this.canvas.getBoundingClientRect();
            const r1 = startNode.getBoundingClientRect();
            const r2 = endNode.getBoundingClientRect();

            const midX = (
                (r1.left + r1.width / 2 - rect.left) +
                (r2.left + r2.width / 2 - rect.left)
            ) / 2;

            const midY = (
                (r1.top + r1.height / 2 - rect.top) +
                (r2.top + r2.height / 2 - rect.top)
            ) / 2;

            const relationNode = this.createMapNode(midX, midY, "", false);
            relationNode.classList.add("relation-node");

            this.createConnection(startNode, relationNode);
            this.createConnection(relationNode, endNode);
        }

        this.linking = false;
        this.linkStartNode = null;
    },

    updateConnections() {

        const rect = this.canvas.getBoundingClientRect();

        this.connections.forEach(conn => {

            const r1 = conn.fromNode.getBoundingClientRect();
            const r2 = conn.toNode.getBoundingClientRect();

            const c1x = r1.left + r1.width / 2 - rect.left;
            const c1y = r1.top + r1.height / 2 - rect.top;

            const c2x = r2.left + r2.width / 2 - rect.left;
            const c2y = r2.top + r2.height / 2 - rect.top;

            const dx = c2x - c1x;
            const dy = c2y - c1y;

            const length = Math.sqrt(dx * dx + dy * dy);

            if (length === 0) return;

            const ux = dx / length;
            const uy = dy / length;

            // 🔥 Intersezione con rettangolo origine
            const t1 = Math.min(
                Math.abs((r1.width / 2) / ux || Infinity),
                Math.abs((r1.height / 2) / uy || Infinity)
            );

            const startX = c1x + ux * t1;
            const startY = c1y + uy * t1;

            // 🔥 Intersezione con rettangolo destinazione
            const t2 = Math.min(
                Math.abs((r2.width / 2) / ux || Infinity),
                Math.abs((r2.height / 2) / uy || Infinity)
            );

            const endX = c2x - ux * t2;
            const endY = c2y - uy * t2;

            conn.line.setAttribute("x1", startX);
            conn.line.setAttribute("y1", startY);
            conn.line.setAttribute("x2", endX);
            conn.line.setAttribute("y2", endY);
        });
    },

    removeConnectionsOfNode(node) {
        const relationsToCheck = new Set();

        this.connections = this.connections.filter(conn => {

            if (conn.fromNode === node || conn.toNode === node) {

                // Se coinvolge una relation-node, salvala per controllo
                if (conn.fromNode.classList.contains("relation-node")) {
                    relationsToCheck.add(conn.fromNode);
                }

                if (conn.toNode.classList.contains("relation-node")) {
                    relationsToCheck.add(conn.toNode);
                }

                if (conn.line?.parentNode) {
                    conn.line.remove();
                }

                return false;
            }

            return true;
        });

        relationsToCheck.forEach(relationNode => {

            const incomingPrimary = this.connections.some(conn =>
                conn.toNode === relationNode &&
                !conn.fromNode.classList.contains("relation-node")
            );

            const outgoing = this.connections.some(conn =>
                conn.fromNode === relationNode
            );

            if (!incomingPrimary || !outgoing) {
                this.connections = this.connections.filter(conn => {

                    if (
                        conn.fromNode === relationNode ||
                        conn.toNode === relationNode
                    ) {

                        if (conn.line?.parentNode) {
                            conn.line.remove();
                        }

                        return false;
                    }

                    return true;
                });

                relationNode.remove();
            }
        });
    },

    addLinkButton(node) {

        node.querySelectorAll(".link-btn").forEach(b => b.remove());

        const btn = document.createElement("div");
        btn.className = "link-btn";
        btn.textContent = "+";

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            console.log("CLICK LINK BUTTON"); // 🔥 DEBUG
            this.startLinking(node);
        });

        node.appendChild(btn);
    },

    getNodePureText(node) {

        const clone = node.cloneNode(true);

        // Rimuovi elementi UI
        clone.querySelectorAll(".link-btn").forEach(el => el.remove());
        clone.querySelectorAll(".resize-handle").forEach(el => el.remove());

        return clone.textContent.trim();
    },

    projectKey: "cmapProject",

    saveProject() {

        const project = {
            textNotes: [],
            mapNodes: [],
            connections: [],
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

                const clone = node.cloneNode(true);
                clone.querySelectorAll(".link-btn").forEach(b => b.remove());
                clone.querySelectorAll(".resize-handle").forEach(r => r.remove());

                project.mapNodes.push({
                    id: node.dataset.id,
                    text: node.querySelector(".map-node__content").innerHTML,
                    left: node.style.left,
                    top: node.style.top,
                    width: node.style.width || "",
                    height: node.style.height || "",
                    isRelation: node.classList.contains("relation-node")
                });
            });

        } else {
            const oldRaw = localStorage.getItem(this.projectKey);
            const oldProject = oldRaw ? JSON.parse(oldRaw) : null;
            project.mapNodes = oldProject?.mapNodes || [];
        }

        if (this.isMapEditor) {
            this.connections.forEach(conn => {
                project.connections.push({
                    from: conn.fromNode.dataset.id,
                    to: conn.toNode.dataset.id
                });
            });

        } else {
            // Se NON sono nel map editor, mantieni le vecchie connessioni
            const oldRaw = localStorage.getItem(this.projectKey);
            const oldProject = oldRaw ? JSON.parse(oldRaw) : null;
            project.connections = oldProject?.connections || [];
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

        this.connections = [];

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
                const node = this.createMapNode(
                    parseFloat(data.left),
                    parseFloat(data.top),
                    "",
                    true
                );

                node.dataset.id = data.id;

                if (data.width) node.style.width = data.width;
                if (data.height) node.style.height = data.height;

                node.querySelector(".map-node__content").innerHTML = data.text;

                if (data.isRelation) {
                    node.classList.add("relation-node");
                }
            });

            if (Array.isArray(project.connections)) {

                project.connections.forEach(connData => {

                    const fromNode = this.canvas.querySelector(
                        `[data-id="${connData.from}"]`
                    );

                    const toNode = this.canvas.querySelector(
                        `[data-id="${connData.to}"]`
                    );

                    if (fromNode && toNode) {
                        this.createConnection(fromNode, toNode);
                    }
                });

                this.updateConnections();
            }
        }
    },

    setDeleteIcon(dropzoneId, isActive) {

        const dropzone = document.getElementById(dropzoneId);
        if (!dropzone) return;

        const icon = dropzone.querySelector("img");
        if (!icon) return;

        icon.src = isActive
            ? "img/deleteIconR.png"
            : "img/deleteIcon.png";
    }
};

/* =========================
   AUTO INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {
    StickyApp.init();
});