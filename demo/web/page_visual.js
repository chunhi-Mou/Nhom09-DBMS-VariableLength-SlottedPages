(function () {
    const PAGE_WIDTH = 1040;
    const PAGE_MARGIN = 72;
    const STRIP_Y = 126;
    const STRIP_H = 86;
    const TOP_GUIDE_Y = 38;
    const BOTTOM_GUIDE_Y = 318;
    const OLD_TAG_Y = 66;
    const HEADER_W = 124;
    const COLORS = ["#4d9bdf", "#71b74d", "#e39a43", "#d86f6f", "#8a78db"];

    function createSvg(tag, attrs) {
        const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
        return node;
    }

    function activeSlots(page) {
        return page.slots.filter((slot) => slot.status === "active");
    }

    function colorFor(slotId) {
        return COLORS[slotId % COLORS.length];
    }

    function buildLayout(page) {
        const ptrCount = Math.max(page.slots.length, 1);
        const ptrWidth = Math.max(76, Math.min(88, 360 / ptrCount));
        const headerX = PAGE_MARGIN;
        const ptrStartX = headerX + HEADER_W;
        const rightStartX = ptrStartX + ptrWidth * page.slots.length;
        const rightEndX = PAGE_MARGIN + PAGE_WIDTH;
        const spanBytes = Math.max(1, page.page_size - page.header_size);
        const rightScale = (rightEndX - rightStartX) / spanBytes;

        return {
            headerX,
            ptrStartX,
            ptrWidth,
            rightStartX,
            rightEndX,
            mapByte(value) {
                return rightStartX + (value - page.header_size) * rightScale;
            },
            ptrCenter(slotId) {
                return ptrStartX + slotId * ptrWidth + ptrWidth / 2;
            },
        };
    }

    function drawGuide(svg, x, label) {
        svg.appendChild(createSvg("line", {
            x1: x,
            y1: TOP_GUIDE_Y + 10,
            x2: x,
            y2: STRIP_Y - 8,
            stroke: "#667985",
            "stroke-width": "1.8",
            "stroke-dasharray": "8 7",
            "marker-end": "url(#arrowHead)",
        }));

        const text = createSvg("text", {
            x,
            y: TOP_GUIDE_Y,
            fill: "#365167",
            "font-size": "17",
            "font-weight": "700",
            "text-anchor": "middle",
        });
        text.textContent = label;
        svg.appendChild(text);
    }

    function drawPtrArrow(svg, ptrCenterX, cellCenterX, color, depth) {
        const midY = BOTTOM_GUIDE_Y + depth * 18;
        svg.appendChild(createSvg("path", {
            d: `M ${ptrCenterX} ${STRIP_Y + STRIP_H + 2} L ${ptrCenterX} ${midY} L ${cellCenterX} ${midY} L ${cellCenterX} ${STRIP_Y + STRIP_H + 8}`,
            fill: "none",
            stroke: color,
            "stroke-width": "2.2",
            "stroke-dasharray": "8 7",
            "marker-end": "url(#arrowHead)",
        }));
    }

    function drawMovedMarker(svg, layout, move, index) {
        const color = colorFor(move.slot_id);
        const fromX = layout.mapByte(move.from + move.length / 2);
        const toX = layout.mapByte(move.to + move.length / 2);
        const turnY = OLD_TAG_Y + 44 + index * 4;
        const tagWidth = Math.max(86, Math.min(118, move.length + 42));
        const tagX = fromX - tagWidth / 2;

        svg.appendChild(createSvg("rect", {
            x: tagX,
            y: OLD_TAG_Y,
            width: tagWidth,
            height: 28,
            rx: 8,
            fill: "rgba(255, 255, 255, 0.95)",
            stroke: "#8ea0ab",
            "stroke-width": "1.5",
            "stroke-dasharray": "6 5",
        }));

        const label = createSvg("text", {
            x: fromX,
            y: OLD_TAG_Y + 18,
            fill: "#647784",
            "font-size": "12",
            "font-weight": "700",
            "text-anchor": "middle",
        });
        label.textContent = `${move.cell} cũ`;
        svg.appendChild(label);

        svg.appendChild(createSvg("path", {
            d: `M ${fromX} ${OLD_TAG_Y + 28} L ${fromX} ${turnY} L ${toX} ${turnY} L ${toX} ${STRIP_Y - 6}`,
            fill: "none",
            stroke: color,
            "stroke-width": "2.1",
            "stroke-dasharray": "8 6",
            "marker-end": "url(#arrowHead)",
        }));
    }

    function drawFigure(svg, state) {
        const page = state.page;
        svg.innerHTML = "";
        svg.setAttribute("viewBox", "0 0 1240 392");

        const defs = createSvg("defs", {});
        defs.innerHTML = `
            <pattern id="headerPattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="12" height="12" fill="#ffd79a"></rect>
                <line x1="0" y1="0" x2="0" y2="12" stroke="#f3b85e" stroke-width="4"></line>
            </pattern>
            <pattern id="ptrPattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="12" height="12" fill="#edf6ff"></rect>
                <line x1="0" y1="0" x2="0" y2="12" stroke="#91bff0" stroke-width="4"></line>
            </pattern>
            <pattern id="freePattern" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="14" height="14" fill="#eef8da"></rect>
                <line x1="0" y1="0" x2="0" y2="14" stroke="#b4cf73" stroke-width="4"></line>
            </pattern>
            <pattern id="gapPattern" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="14" height="14" fill="#f5e8e8"></rect>
                <line x1="0" y1="0" x2="0" y2="14" stroke="#c97c7c" stroke-width="4"></line>
            </pattern>
            <marker id="arrowHead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#5d7280"></path>
            </marker>
        `;
        svg.appendChild(defs);

        const layout = buildLayout(page);

        svg.appendChild(createSvg("rect", {
            x: PAGE_MARGIN,
            y: STRIP_Y,
            width: PAGE_WIDTH,
            height: STRIP_H,
            rx: 24,
            fill: "#ffffff",
            stroke: "#8ca3b2",
            "stroke-width": "2",
        }));

        svg.appendChild(createSvg("rect", {
            x: layout.headerX,
            y: STRIP_Y,
            width: HEADER_W,
            height: STRIP_H,
            fill: "url(#headerPattern)",
            stroke: "#ac7a21",
            "stroke-width": "2",
        }));

        const headerText = createSvg("text", {
            x: layout.headerX + HEADER_W / 2,
            y: STRIP_Y + 50,
            fill: "#7b5310",
            "font-size": "20",
            "font-weight": "700",
            "text-anchor": "middle",
        });
        headerText.textContent = "header";
        svg.appendChild(headerText);

        page.slots.forEach((slot) => {
            const x = layout.ptrStartX + slot.id * layout.ptrWidth;
            const isEmpty = slot.status === "empty";
            svg.appendChild(createSvg("rect", {
                x,
                y: STRIP_Y,
                width: layout.ptrWidth,
                height: STRIP_H,
                fill: isEmpty ? "#f7f1f1" : "url(#ptrPattern)",
                stroke: isEmpty ? "#bd8b8b" : "#5d88bf",
                "stroke-width": "1.8",
            }));

            const ptrText = createSvg("text", {
                x: x + layout.ptrWidth / 2,
                y: STRIP_Y + 46,
                fill: isEmpty ? "#9d6a6a" : "#466685",
                "font-size": page.slots.length > 4 ? "14" : "16",
                "font-weight": "700",
                "text-anchor": "middle",
            });
            ptrText.textContent = slot.ptr;
            svg.appendChild(ptrText);
        });

        const freeStartX = layout.rightStartX;
        const freeEndX = layout.mapByte(page.free_end);
        const freeWidth = Math.max(0, freeEndX - freeStartX);
        if (freeWidth > 0) {
            svg.appendChild(createSvg("rect", {
                x: freeStartX,
                y: STRIP_Y,
                width: freeWidth,
                height: STRIP_H,
                fill: "url(#freePattern)",
                stroke: "#7ea03a",
                "stroke-width": "2",
            }));
        }

        if (freeWidth > 52) {
            const freeText = createSvg("text", {
                x: freeStartX + freeWidth / 2,
                y: STRIP_Y + 42,
                fill: "#53712f",
                "font-size": "18",
                "font-weight": "700",
                "text-anchor": "middle",
            });
            const freeLine1 = createSvg("tspan", {
                x: freeStartX + freeWidth / 2,
                dy: 0,
            });
            freeLine1.textContent = "free space";
            freeText.appendChild(freeLine1);
            const freeLine2 = createSvg("tspan", {
                x: freeStartX + freeWidth / 2,
                dy: 20,
            });
            freeLine2.textContent = `${page.free_bytes}B`;
            freeText.appendChild(freeLine2);
            svg.appendChild(freeText);
        }

        page.gaps.forEach((gap) => {
            const x = layout.mapByte(gap.start);
            const width = layout.mapByte(gap.start + gap.length) - x;
            svg.appendChild(createSvg("rect", {
                x,
                y: STRIP_Y,
                width,
                height: STRIP_H,
                rx: 8,
                fill: "url(#gapPattern)",
                stroke: "#b06565",
                "stroke-width": "2",
            }));

            const text = createSvg("text", {
                x: x + width / 2,
                y: STRIP_Y + 44,
                fill: "#8f5555",
                "font-size": width > 50 ? "16" : "14",
                "font-weight": "700",
                "text-anchor": "middle",
            });
            String(gap.label).split("\n").forEach((lineText, lineIndex) => {
                const line = createSvg("tspan", {
                    x: x + width / 2,
                    dy: lineIndex === 0 ? 0 : 18,
                });
                line.textContent = lineText;
                text.appendChild(line);
            });
            svg.appendChild(text);
        });

        activeSlots(page).forEach((slot) => {
            const color = colorFor(slot.id);
            const x = layout.mapByte(slot.offset);
            const width = layout.mapByte(slot.offset + slot.length) - x;

            svg.appendChild(createSvg("rect", {
                x,
                y: STRIP_Y,
                width,
                height: STRIP_H,
                rx: 8,
                fill: `${color}20`,
                stroke: color,
                "stroke-width": "2.3",
            }));

            const title = createSvg("text", {
                x: x + width / 2,
                y: STRIP_Y + 34,
                fill: color,
                "font-size": width > 84 ? "18" : width > 56 ? "16" : "13",
                "font-weight": "700",
                "text-anchor": "middle",
            });
            title.textContent = slot.cell;
            svg.appendChild(title);

            const sub = createSvg("text", {
                x: x + width / 2,
                y: STRIP_Y + 56,
                fill: "#405663",
                "font-size": width > 84 ? "13" : "11",
                "text-anchor": "middle",
            });
            sub.textContent = slot.label;
            svg.appendChild(sub);

            const size = createSvg("text", {
                x: x + width / 2,
                y: STRIP_Y + 74,
                fill: "#5c7080",
                "font-size": width > 84 ? "12" : "10",
                "font-weight": "700",
                "text-anchor": "middle",
            });
            size.textContent = `${slot.length}B`;
            svg.appendChild(size);
        });

        svg.appendChild(createSvg("line", {
            x1: freeStartX,
            y1: TOP_GUIDE_Y + 10,
            x2: freeEndX,
            y2: TOP_GUIDE_Y + 10,
            stroke: "#667985",
            "stroke-width": "1.8",
            "stroke-dasharray": "8 7",
        }));
        drawGuide(svg, freeStartX, "free start");
        drawGuide(svg, freeEndX, "free end");

        activeSlots(page).forEach((slot, index) => {
            const ptrCenterX = layout.ptrCenter(slot.id);
            const cellCenterX = layout.mapByte(slot.offset + slot.length / 2);
            drawPtrArrow(svg, ptrCenterX, cellCenterX, colorFor(slot.id), index);
        });

        state.moved_records.forEach((move, index) => {
            drawMovedMarker(svg, layout, move, index);
        });
    }

    function createFocusCard(item, type, index) {
        const card = document.createElement("div");
        card.className = `focus-card ${type}`;
        card.style.animationDelay = `${index * 40}ms`;

        if (type === "move") {
            card.innerHTML = `
                <div class="focus-line">
                    <strong>${item.cell} bị dời</strong>
                    <span class="focus-chip danger">dời</span>
                </div>
                <div class="focus-copy">cell dữ liệu của ${item.label}</div>
                <div class="focus-meta">${item.from} -> ${item.to}</div>
                <div class="focus-sub">${item.ptr} vẫn giữ nguyên trong header</div>
            `;
            return card;
        }

        if (item.status === "empty") {
            card.innerHTML = `
                <div class="focus-line">
                    <strong>${item.ptr} giữ nguyên</strong>
                    <span class="focus-chip">giữ</span>
                </div>
                <div class="focus-copy">slot rỗng trong header</div>
            `;
            return card;
        }

        card.innerHTML = `
            <div class="focus-line">
                <strong>${item.ptr} giữ nguyên</strong>
                <span class="focus-chip">giữ</span>
            </div>
            <div class="focus-copy">trong header, trỏ tới ${item.cell}</div>
            <div class="focus-meta">${item.label}</div>
        `;
        return card;
    }

    function renderFocusList(root, items, type) {
        root.innerHTML = "";
        items.forEach((item, index) => {
            root.appendChild(createFocusCard(item, type, index));
        });
    }

    function renderError(message) {
        const root = document.getElementById("app");
        root.innerHTML = `
            <main class="page-shell page-shell-error">
                <section class="canvas-card">
                    <h1>Không đọc được JSON</h1>
                    <p class="state-note">${message}</p>
                </section>
            </main>
        `;
    }

    function renderDemo(config) {
        const root = document.getElementById("app");
        root.innerHTML = `
            <main class="page-shell">
                <section class="hero">
                    <div class="hero-copy">
                        <h1>${config.title}</h1>
                        <p>${config.subtitle || ""}</p>
                    </div>
                </section>
                <div class="toolbar" id="stepButtons"></div>
                <div class="control-row">
                    <button class="control-btn" id="prevBtn">Bước trước</button>
                    <button class="control-btn" id="nextBtn">Bước sau</button>
                </div>
                <section class="stage">
                    <div class="canvas-card">
                        <div class="state-head">
                            <div>
                                <h2 class="state-title" id="stateTitle"></h2>
                                <p class="state-note" id="stateNote"></p>
                            </div>
                            <div class="state-badges">
                                <span class="badge" id="operationLabel"></span>
                                <span class="badge badge-time" id="timingLabel"></span>
                                <span class="badge badge-big-o" id="complexityLabel"></span>
                            </div>
                        </div>
                        <div class="figure-wrap">
                            <svg id="figure" aria-label="Mô phỏng slotted page"></svg>
                        </div>
                    </div>
                    <aside class="detail-card">
                        <section class="detail-group">
                            <div class="metric-label" id="slotGroupTitle"></div>
                            <div class="focus-list" id="slotList"></div>
                        </section>
                        <section class="detail-group" id="moveGroup">
                            <div class="metric-label" id="moveGroupTitle"></div>
                            <div class="focus-list" id="moveList"></div>
                        </section>
                    </aside>
                </section>
            </main>
        `;

        const buttons = document.getElementById("stepButtons");
        const svg = document.getElementById("figure");
        const stateTitle = document.getElementById("stateTitle");
        const stateNote = document.getElementById("stateNote");
        const operationLabel = document.getElementById("operationLabel");
        const timingLabel = document.getElementById("timingLabel");
        const complexityLabel = document.getElementById("complexityLabel");
        const slotGroupTitle = document.getElementById("slotGroupTitle");
        const moveGroupTitle = document.getElementById("moveGroupTitle");
        const slotList = document.getElementById("slotList");
        const moveList = document.getElementById("moveList");
        const moveGroup = document.getElementById("moveGroup");
        const prevBtn = document.getElementById("prevBtn");
        const nextBtn = document.getElementById("nextBtn");

        let stateIndex = 0;

        config.states.forEach((state, index) => {
            const button = document.createElement("button");
            button.className = "step-btn";
            button.textContent = `${index + 1}. ${state.short}`;
            button.addEventListener("click", () => {
                stateIndex = index;
                render();
            });
            buttons.appendChild(button);
        });

        function render() {
            const state = config.states[stateIndex];
            stateTitle.textContent = state.title;
            stateNote.textContent = state.note;
            operationLabel.textContent = state.operation;
            timingLabel.textContent = state.timing_text;
            complexityLabel.textContent = state.complexity;
            slotGroupTitle.textContent = state.slot_panel_title || "Slot đang có";
            moveGroupTitle.textContent = state.move_panel_title || "Record dời";

            renderFocusList(slotList, state.stable_slots || [], "stable");
            if (state.moved_records && state.moved_records.length) {
                moveGroup.hidden = false;
                renderFocusList(moveList, state.moved_records, "move");
            } else {
                moveGroup.hidden = true;
                moveList.innerHTML = "";
            }

            drawFigure(svg, state);
            [...buttons.children].forEach((button, index) => {
                button.classList.toggle("active", index === stateIndex);
            });
            prevBtn.disabled = stateIndex === 0;
            nextBtn.disabled = stateIndex === config.states.length - 1;
        }

        prevBtn.addEventListener("click", () => {
            stateIndex = Math.max(0, stateIndex - 1);
            render();
        });

        nextBtn.addEventListener("click", () => {
            stateIndex = Math.min(config.states.length - 1, stateIndex + 1);
            render();
        });

        render();
    }

    async function bootPageDemo(jsonPath) {
        try {
            const response = await fetch(jsonPath, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const config = await response.json();
            renderDemo(config);
        } catch (error) {
            renderError("Hãy mở thư mục này bằng server tĩnh để HTML đọc được file JSON.");
            console.error(error);
        }
    }

    window.renderPageDemo = renderDemo;
    window.bootPageDemo = bootPageDemo;
})();
