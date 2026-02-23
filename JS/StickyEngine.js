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
    linking: false,
    connections: [],
    linkStartNode: null,
    linkStartSide: null,
    tempLine: null,


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
        if (!this.selectedNode) return;

        this.selectedNode.classList.remove("selected");
        this.selectedNode.querySelectorAll(".link-btn").forEach(b => b.remove());
        this.selectedNode = null;
    },

    init() {
        this.isMapEditor = window.location.pathname.toLowerCase().includes("mapeditor");

        this.canvas = document.getElementById("canvas");
        this.btnAdd = document.getElementById("btn-add");

        this.btnNode = document.getElementById("btnNode");

        document.addEventListener("mousedown", (e) => {
            if (!e.target.closest(".map-node")) {
                this.deselectNode();
            }
        });
        window.addEventListener("mousemove", (e) => {

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
                    lastNode.setAttribute("contenteditable", "true");
                    lastNode.focus();
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

        const resizeLeft = document.createElement("div");
        resizeLeft.className = "resize-handle left";

        const resizeRight = document.createElement("div");
        resizeRight.className = "resize-handle right";



        node.textContent = text || "\u200B";

        node.appendChild(resizeLeft);
        node.appendChild(resizeRight);
        node.setAttribute("contenteditable", "false");

        if (!text) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    node.setAttribute("contenteditable", "true");
                    node.focus();
                });
            });
        }
        node.addEventListener("dblclick", (e) => {
            e.stopPropagation();

            node.setAttribute("contenteditable", "true");
            node.focus();

        });

        node.addEventListener("blur", () => {
            node.setAttribute("contenteditable", "false");
            StickyApp.saveProject();

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

    makeNodeDraggable(node) {

        let offsetX = 0;
        let offsetY = 0;
        let dragging = false;


        const leftHandle = node.querySelector(".resize-handle.left");
        const rightHandle = node.querySelector(".resize-handle.right");

        let resizing = false;
        let direction = null;
        let startX = 0;
        let startWidth = 0;
        let startLeft = 0;

        node.addEventListener("mousedown", (e) => {

            if (e.target.closest(".resize-handle")) return;
            if (e.target.closest(".link-btn")) return;
            if (node.getAttribute("contenteditable") === "true") return;

            if (StickyApp.linking && StickyApp.linkStartNode !== node) {
                StickyApp.finalizeLink(node);
                return;
            }

            StickyApp.selectNode(node);
            e.stopPropagation(); // 🔥 fondamentale
        });

        const startResize = (e, dir) => {
            e.stopPropagation();
            e.preventDefault();
            dragging = false;   // 🔥 blocca il drag
            resizing = true;
            direction = dir;
            startX = e.clientX;
            startWidth = node.offsetWidth;
            startLeft = parseFloat(node.style.left);
        };

        leftHandle?.addEventListener("mousedown", (e) => startResize(e, "left"));
        rightHandle?.addEventListener("mousedown", (e) => startResize(e, "right"));

        window.addEventListener("mousemove", (e) => {

            if (!resizing) return;

            const dx = e.clientX - startX;

            if (direction === "right") {
                const newWidth = startWidth + dx;
                if (newWidth > 80) {
                    node.style.width = newWidth + "px";
                }
            }

            if (direction === "left") {
                const newWidth = startWidth - dx;
                if (newWidth > 80) {
                    node.style.width = newWidth + "px";
                    node.style.left = (startLeft + dx) + "px";
                }
            }
        });

        window.addEventListener("mouseup", () => {
            resizing = false;
            direction = null;
        });

        node.addEventListener("mousedown", (e) => {

            // 🔥 Se sto ridimensionando NON deve partire il drag
            if (
                e.target.closest(".resize-handle") ||
                e.target.closest(".link-btn")
            ) return;

            if (node.getAttribute("contenteditable") === "true") return;

            dragging = true;

            if (typeof showDeleteToolbar === "function") {
                showDeleteToolbar(true);
            }

            const rect = node.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            node.style.zIndex = ++StickyApp.state.zIndexCounter;
        });

        window.addEventListener("mousemove", (e) => {

            if (!dragging || resizing) return;

            const deleteDropzoneNode = document.getElementById("deleteDropzoneNode");

            if (deleteDropzoneNode) {

                const rect = deleteDropzoneNode.getBoundingClientRect();

                const isOver =
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom;

                const icon = deleteDropzoneNode.querySelector("img");

                if (isOver) {
                    deleteDropzoneNode.classList.add("active");
                    StickyApp.setDeleteIcon("deleteDropzoneNode", true);
                } else {
                    deleteDropzoneNode.classList.remove("active");
                    StickyApp.setDeleteIcon("deleteDropzoneNode", false);
                }
            }

            // 🔵 NOTE DROPZONE ACTIVE
            const noteDropzone = document.getElementById("noteDropzone");

            if (noteDropzone) {

                const rect = noteDropzone.getBoundingClientRect();

                const isOverNote =
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom;

                const icon = noteDropzone.querySelector("img");

                if (isOverNote) {
                    noteDropzone.classList.add("active");
                    if (icon) icon.src = "img/mapEditor/noteIconB.png";
                } else {
                    noteDropzone.classList.remove("active");
                    if (icon) icon.src = "img/mapEditor/noteIcon.png";
                }
            }

            const world = StickyApp.screenToWorld(e.clientX, e.clientY);

            node.style.left = (world.x - offsetX) + "px";
            node.style.top = (world.y - offsetY) + "px";

            if (StickyApp.connections.length) {
                StickyApp.updateConnections();
            }
            // 🔥 Controllo se è sopra una sticky
            const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
            const sticky = elementBelow?.closest(".sticky-note");

            if (sticky) {
                sticky.classList.add("drop-active");
            }

        });

        window.addEventListener("mouseup", (e) => {

            if (!dragging || resizing) return;

            dragging = false;

            const deleteDropzoneNode = document.getElementById("deleteDropzoneNode");
            deleteDropzoneNode?.classList.remove("active");
            StickyApp.setDeleteIcon("deleteDropzoneNode", false);

            const noteDropzone = document.getElementById("noteDropzone");


            noteDropzone?.classList.remove("active");

            const noteIcon = noteDropzone?.querySelector("img");
            if (noteIcon) noteIcon.src = "img/mapEditor/noteIcon.png";

            const rect = deleteDropzoneNode?.getBoundingClientRect();
            const isOverDelete = rect &&
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;

            if (isOverDelete) {
                node.remove();
                StickyApp.saveProject();
                hideDeleteToolbar();
                return;
            }



            const noteRect = noteDropzone?.getBoundingClientRect();
            const isOverNote = noteRect &&
                e.clientX >= noteRect.left &&
                e.clientX <= noteRect.right &&
                e.clientY >= noteRect.top &&
                e.clientY <= noteRect.bottom;

            if (isOverNote) {

                const text = this.getNodePureText(node);
                if (!text) {
                    hideDeleteToolbar();
                    return;
                }

                // 🔍 Cerco una sticky lista esistente
                let targetSticky = document.querySelector('.sticky-note[data-type="list"]');

                // ➕ Se non esiste, la creo al centro
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

                // ➕ Aggiungo il nodo alla sticky
                StickyApp.addNodeToSticky(targetSticky, node);

                StickyApp.saveProject();
                hideDeleteToolbar();

                return;
            }

            // 🔹 Controllo sticky
            node.style.pointerEvents = "none";
            const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
            const sticky = elementBelow?.closest(".sticky-note");
            node.style.pointerEvents = "auto";

            if (sticky) {
                StickyApp.addNodeToSticky(sticky, node);
                hideDeleteToolbar();
                return;
            }

            StickyApp.saveProject();
            hideDeleteToolbar();
        });
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

        // 🔥 Se c'è già un nodo selezionato e non è lo stesso
        if (this.selectedNode && this.selectedNode !== node) {

            this.selectedNode.classList.remove("selected");

            // 🔥 Rimuovi il bottone +
            this.selectedNode
                .querySelectorAll(".link-btn")
                .forEach(btn => btn.remove());
        }

        this.selectedNode = node;
        node.classList.add("selected");

        this.addLinkButton(node);
    },

    finalizeLink(targetNode) {

        if (!this.linkStartNode) return;

        const startIsRelation = this.linkStartNode.classList.contains("relation-node");
        const targetIsRelation = targetNode.classList.contains("relation-node");

        // 🚫 Non permettere relazione → relazione
        if (startIsRelation && targetIsRelation) {
            this.cancelLinking();
            return;
        }

        // 🔹 Se uno dei due è relazione → crea solo una linea
        if (startIsRelation || targetIsRelation) {
            this.createConnection(this.linkStartNode, targetNode);
        }
        else {
            // 🔹 Nodo normale → nodo normale
            const rect = this.canvas.getBoundingClientRect();
            const r1 = this.linkStartNode.getBoundingClientRect();
            const r2 = targetNode.getBoundingClientRect();

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

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("stroke", "#4a90e2");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("marker-end", "url(#arrow)");

        svg.appendChild(line);

        this.connections.push({
            line,
            fromNode,
            toNode
        });

        this.updateConnections();
    },

    startLinking(node) {
        console.log("START LINKING");

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

        if (this.tempLine) {
            this.tempLine.remove();
        }

        this.tempLine = null;
        this.linking = false;
        this.linkStartNode = null;
        this.linkStartSide = null;
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

                // 🔥 Cloniamo il nodo per rimuovere il bottone +
                const clone = node.cloneNode(true);
                clone.querySelectorAll(".link-btn").forEach(b => b.remove());
                clone.querySelectorAll(".resize-handle").forEach(r => r.remove());

                project.mapNodes.push({
                    text: clone.textContent.trim(),
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