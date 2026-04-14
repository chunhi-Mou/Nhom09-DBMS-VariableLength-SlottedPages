(function () {
    const PAGE_WIDTH = 1040;
    const PAGE_MARGIN = 72;
    const STRIP_Y = 126;
    const STRIP_H = 86;
    const TOP_GUIDE_Y = 38;
    const BOTTOM_GUIDE_Y = 344;
    const OLD_TAG_Y = 66;
    const HEADER_W = 88;
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
        const ptrWidth = Math.max(22, Math.min(30, 180 / ptrCount));
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

    function drawGuide(svg, x, label, options = {}) {
        const labelX = x + (options.dx || 0);
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
            x: labelX,
            y: options.y || TOP_GUIDE_Y,
            fill: "#365167",
            "font-size": "17",
            "font-weight": "700",
            "text-anchor": options.anchor || "middle",
        });
        text.textContent = label;
        svg.appendChild(text);
    }

    function drawPtrArrow(svg, ptrCenterX, cellCenterX, color, depth, animate = true) {
        const midY = BOTTOM_GUIDE_Y + depth * 18;
        svg.appendChild(createSvg("path", {
            d: `M ${ptrCenterX} ${STRIP_Y + STRIP_H + 2} L ${ptrCenterX} ${midY} L ${cellCenterX} ${midY} L ${cellCenterX} ${STRIP_Y + STRIP_H + 8}`,
            fill: "none",
            stroke: color,
            "stroke-width": "2.2",
            "stroke-dasharray": "8 7",
            "marker-end": "url(#arrowHead)",
            "class": animate ? "anim-draw" : "ptr-flow",
            "style": `animation-delay: ${depth * 40 + 200}ms;`
        }));
    }

    function drawMovedMarker(svg, layout, move, index) {
        const color = colorFor(move.slot_id);
        const fromX = layout.mapByte(move.from + move.length / 2);
        const toX = layout.mapByte(move.to + move.length / 2);
        const turnY = OLD_TAG_Y + 50 + index * 12;

        svg.appendChild(createSvg("path", {
            d: `M ${fromX} ${STRIP_Y - 8} L ${fromX} ${turnY} L ${toX} ${turnY} L ${toX} ${STRIP_Y - 8}`,
            fill: "none",
            stroke: color,
            "stroke-width": "1.9",
            "stroke-dasharray": "8 6",
            "class": "compaction-trace",
            "style": `animation-delay: ${index * 180 + 120}ms;`
        }));
    }

    function addAnimate(node, attrs) {
        const animation = createSvg("animate", attrs);
        node.appendChild(animation);
        return animation;
    }

    function addAnimateTransform(node, attrs) {
        const animation = createSvg("animateTransform", {
            attributeName: "transform",
            fill: "freeze",
            ...attrs,
        });
        node.appendChild(animation);
        return animation;
    }

    function playKeyframes(node, keyframes, options) {
        if (!node || typeof node.animate !== "function") {
            return;
        }
        node.animate(keyframes, {
            duration: 640,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "both",
            ...options,
        });
    }

    function animateLiveFigure(svg, state) {
        if (!state.live) {
            return;
        }

        const layout = buildLayout(state.page);
        const movedRecords = Array.isArray(state.moved_records) ? state.moved_records : [];
        const movedIndex = new Map(movedRecords.map((move, index) => [move.slot_id, index]));
        const hasInsert = state.insert_sources && Object.keys(state.insert_sources).length > 0;
        const compactThenInsert = movedRecords.length > 0 && hasInsert;
        const compactStepDelay = 210;
        const compactDuration = 540;
        const compactTotalDuration = Math.max(0, (movedRecords.length - 1) * 80) + compactDuration;
        const insertDelay = compactThenInsert
            ? movedRecords.length * compactStepDelay + compactDuration + 120
            : 0;

        if (state.compact_animation) {
            const freeRect = svg.querySelector('[data-free-space="true"]');
            const freeLabel = svg.querySelector('[data-free-label="true"]');
            if (freeRect) {
                const previousEnd = typeof state.previous_free_end === "number"
                    ? state.previous_free_end
                    : state.page.free_end;
                const fromEndX = layout.mapByte(previousEnd);
                const toEndX = layout.mapByte(state.page.free_end);
                const fromWidth = Math.max(0, fromEndX - layout.rightStartX);
                const toWidth = Math.max(0, toEndX - layout.rightStartX);

                freeRect.setAttribute("width", String(fromWidth));
                addAnimate(freeRect, {
                    attributeName: "width",
                    from: String(fromWidth),
                    to: String(toWidth),
                    dur: `${compactTotalDuration}ms`,
                    fill: "freeze",
                    calcMode: "spline",
                    keySplines: "0.22 1 0.36 1",
                    keyTimes: "0;1",
                });
            }

            if (freeLabel) {
                addAnimate(freeLabel, {
                    attributeName: "opacity",
                    from: "0",
                    to: "1",
                    begin: `${compactTotalDuration}ms`,
                    dur: "260ms",
                    fill: "freeze",
                });
            }
        }

        svg.querySelectorAll(".live-cell-group").forEach((group) => {
            const slotId = Number(group.dataset.slotId);
            const oldCell = state.previous_cells && state.previous_cells[slotId];
            const insertSource = state.insert_sources && state.insert_sources[slotId];
            const rect = group.querySelector("rect");
            if (!rect) {
                return;
            }

            const x = Number(rect.getAttribute("x"));
            const width = Number(rect.getAttribute("width"));
            if (insertSource) {
                const fromX = layout.mapByte(insertSource.offset);
                const dx = fromX - x;
                if (compactThenInsert) {
                    playKeyframes(group, [
                        {
                            transform: `translateX(${dx}px)`,
                            opacity: 0,
                        },
                        {
                            transform: `translateX(${dx}px)`,
                            opacity: 0,
                            offset: 0.42,
                        },
                        {
                            transform: "translateX(0)",
                            opacity: 1,
                        },
                    ], {
                        duration: 620,
                        delay: insertDelay,
                    });
                } else {
                    playKeyframes(group, [
                        {
                            transform: `translateX(${dx}px)`,
                        },
                        {
                            transform: "translateX(0)",
                        },
                    ], {
                        duration: 460,
                        delay: insertDelay,
                    });
                }
                return;
            }

            if (oldCell && oldCell.offset !== undefined && oldCell.offset !== state.page.slots[slotId]?.offset) {
                const oldX = layout.mapByte(oldCell.offset);
                const dx = oldX - x;
                const order = movedIndex.has(slotId) ? movedIndex.get(slotId) : 0;
                playKeyframes(group, [
                    {
                        transform: `translateX(${dx}px)`,
                    },
                    {
                        transform: "translateX(0)",
                    },
                ], {
                    duration: compactDuration,
                    delay: compactThenInsert ? order * compactStepDelay : order * 80,
                });
            }
        });
    }

    function drawFigure(svg, state) {
        const page = state.page;
        svg.innerHTML = "";
        svg.setAttribute("viewBox", "0 0 1240 430");

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
            "class": state.live ? "" : "anim-fade"
        }));

        svg.appendChild(createSvg("rect", {
            x: layout.headerX,
            y: STRIP_Y,
            width: HEADER_W,
            height: STRIP_H,
            fill: "url(#headerPattern)",
            stroke: "#ac7a21",
            "stroke-width": "2",
            "class": state.live ? "interactive-element" : "anim-slide-down interactive-element",
            "style": "animation-delay: 0ms;"
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
            const isChanged = state.changed_slots && state.changed_slots.includes(slot.id);
            svg.appendChild(createSvg("rect", {
                x,
                y: STRIP_Y,
                width: layout.ptrWidth,
                height: STRIP_H,
                fill: isEmpty ? "#f7f1f1" : "url(#ptrPattern)",
                stroke: isEmpty ? "#bd8b8b" : "#5d88bf",
                "stroke-width": "1.8",
                "class": state.live
                    ? `interactive-element ${isChanged ? "live-pulse" : ""}`
                    : "anim-slide-down interactive-element",
                "data-slot-id": String(slot.id),
                "data-slot-rect": "true",
                "style": `animation-delay: ${(slot.id + 1) * 35}ms;`
            }));

            const ptrText = createSvg("text", {
                x: x + layout.ptrWidth / 2,
                y: STRIP_Y + 46,
                fill: isEmpty ? "#9d6a6a" : "#466685",
                "font-size": page.slots.length > 4 ? "12" : "13",
                "font-weight": "700",
                "text-anchor": "middle",
            });
            ptrText.textContent = slot.ptr;
            svg.appendChild(ptrText);
        });

        const freeStartX = layout.rightStartX;
        const freeEndX = layout.mapByte(page.free_end);
        const freeWidth = Math.max(0, freeEndX - freeStartX);
        const previousEndX = typeof state.previous_free_end === "number"
            ? layout.mapByte(state.previous_free_end)
            : freeEndX;
        const initialFreeWidth = state.compact_animation
            ? Math.max(0, previousEndX - freeStartX)
            : freeWidth;
        if (freeWidth > 0) {
            svg.appendChild(createSvg("rect", {
                x: freeStartX,
                y: STRIP_Y,
                width: initialFreeWidth,
                height: STRIP_H,
                fill: "url(#freePattern)",
                stroke: "#7ea03a",
                "stroke-width": "2",
                "class": state.live ? "interactive-element free-flow" : "anim-fade interactive-element",
                "data-free-space": "true",
                "style": "animation-delay: 150ms;"
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
                "data-free-label": "true",
                "opacity": state.compact_animation ? "0" : "1",
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
                "class": state.live ? "interactive-element live-pulse" : "anim-fade interactive-element",
                "style": "animation-delay: 200ms;"
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

        state.deleted_ghosts.forEach((ghost) => {
            const x = layout.mapByte(ghost.offset);
            const width = layout.mapByte(ghost.offset + ghost.length) - x;
            const group = createSvg("g", {
                "class": "delete-ghost",
            });
            group.appendChild(createSvg("rect", {
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
            text.textContent = "vùng xóa";
            group.appendChild(text);
            svg.appendChild(group);
        });

        activeSlots(page).forEach((slot) => {
            const color = colorFor(slot.id);
            const x = layout.mapByte(slot.offset);
            const width = layout.mapByte(slot.offset + slot.length) - x;
            const isChanged = state.changed_slots && state.changed_slots.includes(slot.id);
            const group = createSvg("g", {
                "class": state.live
                    ? `live-cell-group ${isChanged ? "live-cell-new" : ""}`
                    : "anim-pop interactive-element",
                "data-slot-id": String(slot.id),
            });
            const oldCell = state.previous_cells && state.previous_cells[slot.id];
            const insertSource = state.insert_sources && state.insert_sources[slot.id];
            let translateFrom = null;
            if (oldCell && oldCell.offset !== slot.offset) {
                const oldX = layout.mapByte(oldCell.offset);
                translateFrom = oldX - x;
            } else if (insertSource) {
                const sourceX = layout.mapByte(insertSource.offset);
                translateFrom = sourceX - x;
            }

            const cellRect = createSvg("rect", {
                x,
                y: STRIP_Y,
                width,
                height: STRIP_H,
                rx: 8,
                fill: `${color}20`,
                stroke: color,
                "stroke-width": "2.3",
                "style": `animation-delay: ${(slot.id + 2) * 50}ms;`
            });
            group.appendChild(cellRect);

            const title = createSvg("text", {
                x: x + width / 2,
                y: STRIP_Y + 34,
                fill: color,
                "font-size": width > 84 ? "18" : width > 56 ? "16" : "13",
                "font-weight": "700",
                "text-anchor": "middle",
            });
            title.textContent = slot.cell;
            group.appendChild(title);

            const sub = createSvg("text", {
                x: x + width / 2,
                y: STRIP_Y + 56,
                fill: "#405663",
                "font-size": width > 84 ? "13" : "11",
                "text-anchor": "middle",
            });
            sub.textContent = slot.label;
            group.appendChild(sub);

            const size = createSvg("text", {
                x: x + width / 2,
                y: STRIP_Y + 74,
                fill: "#5c7080",
                "font-size": width > 84 ? "12" : "10",
                "font-weight": "700",
                "text-anchor": "middle",
            });
            size.textContent = `${slot.length}B`;
            group.appendChild(size);
            if (translateFrom !== null) {
                addAnimateTransform(group, {
                    type: "translate",
                    from: `${translateFrom} 0`,
                    to: "0 0",
                    dur: "960ms",
                    calcMode: "spline",
                    keySplines: "0.16 1 0.3 1",
                });
            }
            svg.appendChild(group);
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
        const headerCenterX = layout.headerX + HEADER_W / 2;
        if (freeStartX > headerCenterX) {
            svg.appendChild(createSvg("line", {
                x1: headerCenterX,
                y1: TOP_GUIDE_Y + 10,
                x2: freeStartX,
                y2: TOP_GUIDE_Y + 10,
                stroke: "#667985",
                "stroke-width": "1.8",
                "stroke-dasharray": "8 7",
            }));
            svg.appendChild(createSvg("line", {
                x1: headerCenterX,
                y1: TOP_GUIDE_Y + 10,
                x2: headerCenterX,
                y2: STRIP_Y,
                stroke: "#667985",
                "stroke-width": "1.8",
                "stroke-dasharray": "8 7",
            }));
        }
        const guideLabelsClose = Math.abs(freeEndX - freeStartX) < 150;
        drawGuide(svg, freeStartX, "free start", {
            dx: guideLabelsClose ? -10 : 0,
            anchor: guideLabelsClose ? "end" : "middle",
        });
        drawGuide(svg, freeEndX, "free end", {
            dx: guideLabelsClose ? 10 : 0,
            anchor: guideLabelsClose ? "start" : "middle",
            y: guideLabelsClose ? TOP_GUIDE_Y + 22 : TOP_GUIDE_Y,
        });

        activeSlots(page).forEach((slot, index) => {
            const ptrCenterX = layout.ptrCenter(slot.id);
            const cellCenterX = layout.mapByte(slot.offset + slot.length / 2);
            drawPtrArrow(svg, ptrCenterX, cellCenterX, colorFor(slot.id), index, !state.live);
        });

    }

    function createFocusCard(item, type, index) {
        const card = document.createElement("div");
        card.className = `focus-card ${type}`;
        card.style.animationDelay = `${index * 40}ms`;
        card.style.setProperty("--stagger", `${80 + index * 45}ms`);

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

    function renderError(message, title = "Không tải được dữ liệu") {
        const root = document.getElementById("app");
        root.innerHTML = `
            <main class="page-shell page-shell-error">
                <section class="canvas-card">
                    <h1>${title}</h1>
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

    let byteLength;
    let ptrName;
    let cellName;
    let shorten;
    let formatMs;
    let makeLiveState;

    let createLivePage;
    let liveHeaderSize;
    let liveFreeSpace;
    let liveReusableSlot;
    let liveActiveSlots;
    let maxInlineRecordSize;
    let liveInsert;
    let liveDelete;
    let liveCompact;
    let liveReset;

    function connectSeparatedLogic() {
        const recordApi = window.PageRecord || {};
        const coreApi = window.PageCore || {};

        const requiredRecordFns = ["byteLength", "ptrName", "cellName", "shorten", "formatMs", "makeLiveState"];
        const requiredCoreFns = ["createLivePage", "liveHeaderSize", "liveFreeSpace", "liveReusableSlot", "liveActiveSlots", "maxInlineRecordSize", "liveInsert", "liveDelete", "liveCompact", "liveReset"];

        const missingRecord = requiredRecordFns.filter((name) => typeof recordApi[name] !== "function");
        const missingCore = requiredCoreFns.filter((name) => typeof coreApi[name] !== "function");
        if (missingRecord.length || missingCore.length) {
            console.error("Missing logic API", {
                missingRecord,
                missingCore,
            });
            return false;
        }

        // Bind hàm từ logic.
        byteLength = recordApi.byteLength;
        ptrName = recordApi.ptrName;
        cellName = recordApi.cellName;
        shorten = recordApi.shorten;
        formatMs = recordApi.formatMs;
        makeLiveState = recordApi.makeLiveState;

        createLivePage = coreApi.createLivePage;
        liveHeaderSize = coreApi.liveHeaderSize;
        liveFreeSpace = coreApi.liveFreeSpace;
        liveReusableSlot = coreApi.liveReusableSlot;
        liveActiveSlots = coreApi.liveActiveSlots;
        maxInlineRecordSize = coreApi.maxInlineRecordSize;
        liveInsert = coreApi.liveInsert;
        liveDelete = coreApi.liveDelete;
        liveCompact = coreApi.liveCompact;
        liveReset = coreApi.liveReset;

        return true;
    }

    const logicReady = connectSeparatedLogic();

    function renderLiveDemo() {
        if (!logicReady) {
            renderError("Thiếu logic module. Kiểm tra file models.js / record.js / page.js / data.js trong index.html.", "Thiếu logic");
            return;
        }
        const root = document.getElementById("app");
        root.innerHTML = `
            <main class="page-shell live-shell">
                <section class="hero live-hero">
                    <div class="hero-copy">
                        <h1>Slotted Page</h1>
                        <p>Thêm record, xóa slot, dọn trang và quan sát record đổi vị trí.</p>
                    </div>
                </section>
                <section class="view-tabs" role="tablist" aria-label="Góc nhìn dữ liệu">
                    <button class="view-tab active" id="tabMemory" role="tab" aria-selected="true">Bộ nhớ page</button>
                    <button class="view-tab" id="tabUser" role="tab" aria-selected="false">Góc nhìn user</button>
                </section>
                <section class="tab-panel active" id="panelMemory" role="tabpanel" aria-labelledby="tabMemory">
                    <div class="page-chain" id="pageChain"></div>
                    <section class="stage live-stage">
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
                            <div class="quick-sample-bar">
                                <button class="control-btn sample-btn student" id="importPatchBtn">Import Patch</button>
                            </div>
                        </div>
                        <aside class="detail-card">
                            <section class="detail-group sidebar-controls">
                                <div class="metric-label">Điều khiển</div>
                                <div class="live-controls">
                                    <div class="button-grid memory-actions">
                                        <button class="control-btn primary" id="scenarioBtn">Start</button>
                                        <button class="control-btn" id="compactBtn">Compact</button>
                                        <button class="control-btn danger" id="resetBtn">Reset</button>
                                    </div>
                                </div>
                                <div class="live-controls">
                                    <label class="field-label" for="deleteSelect">Slot để delete</label>
                                    <select id="deleteSelect" class="live-select"></select>
                                    <button class="control-btn danger" id="deleteBtn">Delete slot</button>
                                    <label class="field-label" for="pageSelect">Page đang xem</label>
                                    <select id="pageSelect" class="live-select"></select>
                                </div>
                                <div class="metric-strip metric-strip-sidebar" id="metricStrip"></div>
                            </section>
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
                </section>
                <section class="tab-panel" id="panelUser" role="tabpanel" aria-labelledby="tabUser" hidden>
                    <section class="user-view-card">
                        <div class="state-head user-head">
                            <div>
                                <h2 class="state-title">Góc nhìn user data</h2>
                            </div>
                        </div>
                        <div class="user-sheet-grid" id="userSheetGrid"></div>
                    </section>
                </section>
                <div class="toast-stack" id="toastStack" aria-live="polite" aria-atomic="false"></div>
            </main>
        `;

        const pages = [createLivePage(1)];
        let lastEvent = {
            title: "Page rỗng",
            note: "Bắt đầu với một page trống.",
            operation: "Init page",
            complexity: "O(1)",
            moved: [],
        };
        let scenarioTimer = null;
        let pageIndex = 0;
        let previousCells = {};
        let compactGhosts = [];
        let activeTab = "memory";
        let activeEntityTab = "students";

        const deleteSelect = document.getElementById("deleteSelect");
        const pageSelect = document.getElementById("pageSelect");
        const deleteBtn = document.getElementById("deleteBtn");
        const compactBtn = document.getElementById("compactBtn");
        const resetBtn = document.getElementById("resetBtn");
        const scenarioBtn = document.getElementById("scenarioBtn");
        const metricStrip = document.getElementById("metricStrip");
        const toastStack = document.getElementById("toastStack");
        const tabMemory = document.getElementById("tabMemory");
        const tabUser = document.getElementById("tabUser");
        const panelMemory = document.getElementById("panelMemory");
        const panelUser = document.getElementById("panelUser");
        const userSheetGrid = document.getElementById("userSheetGrid");
        const pageChain = document.getElementById("pageChain");
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
        const importPatchBtn = document.getElementById("importPatchBtn");
        const liveDataApi = window.LiveData || {};
        if (typeof liveDataApi.createInitialUserTables !== "function"
            || !Array.isArray(liveDataApi.TABLE_ORDER)
            || typeof liveDataApi.rowToSeed !== "function"
            || typeof liveDataApi.importPatchSeeds !== "function") {
            renderError("Thiếu LiveData API. Kiểm tra data.js trong index.html.", "Thiếu dữ liệu logic");
            return;
        }
        const userTables = liveDataApi.createInitialUserTables();
        const TABLE_ORDER = liveDataApi.TABLE_ORDER;

        function currentPage() {
            return pages[pageIndex];
        }

        function rememberCells(page) {
            return Object.fromEntries(
                liveActiveSlots(page).map((slot) => [slot.id, {
                    offset: slot.offset,
                    length: slot.length,
                }])
            );
        }

        function insertWithPageHandling(seed) {
            const length = byteLength(seed.data);
            const sizeCheckPage = pages[0] || currentPage();
            if (length > maxInlineRecordSize(sizeCheckPage)) {
                return {
                    ok: false,
                    title: "Record quá lớn",
                    note: `Record này ${length}B, lớn hơn sức chứa an toàn của một page ${sizeCheckPage.pageSize}B. Ngoài thực tế, phần dữ liệu lớn thường được tách sang page phụ.`,
                    operation: "Record quá lớn",
                    complexity: "O(1)",
                    moved: [],
                };
            }

            for (let index = 0; index < pages.length; index++) {
                const page = pages[index];
                // Gọi logic insert.
                let event = liveInsert(page, seed);
                if (event.ok) {
                    pageIndex = index;
                    return {
                        ...event,
                        title: `Ghi vào page ${page.id}`,
                        note: `${seed.label} được ghi vào page ${page.id}.`,
                    };
                }

                if (page.gaps.length || liveActiveSlots(page).length) {
                    // Gọi logic compact.
                    const compactEvent = liveCompact(page);
                    const moved = compactEvent.moved;
                    event = liveInsert(page, seed);
                    if (event.ok) {
                        pageIndex = index;
                        return {
                            ...event,
                            title: `Dọn page ${page.id} rồi thêm ${seed.label}`,
                            note: `Page ${page.id} có khoảng trống rải rác, nên compact trước rồi insert vào phần trống liền nhau.`,
                            operation: "Compact + insert",
                            moved,
                        };
                    }
                }
            }

            const basePage = pages[pages.length - 1] || sizeCheckPage;
            const newPage = createLivePage(pages.length + 1, basePage.pageSize);
            pages.push(newPage);
            pageIndex = pages.length - 1;
            const event = liveInsert(newPage, seed);
            return {
                ...event,
                title: `Cấp page ${newPage.id}`,
                note: `Các page hiện có đều không đủ chỗ cho ${seed.label}. Hệ quản trị cấp page mới và ghi record vào đó.`,
                operation: "Allocate page + insert",
                moved: [],
                page_changed: true,
            };
        }

        function timed(action) {
            const start = performance.now();
            const event = action();
            event.timing_ms = performance.now() - start;
            return event;
        }

        function showToast(event) {
            if (!toastStack) {
                return;
            }
            const toast = document.createElement("div");
            const kind = event.ok === false ? "fail" : "ok";
            toast.className = `toast ${kind}`;
            toast.innerHTML = `
                <strong>${event.operation}</strong>
                <span>${shorten(event.note || "", 88)}</span>
            `;
            toastStack.prepend(toast);
            while (toastStack.children.length > 4) {
                toastStack.lastElementChild.remove();
            }

            let hideTimer = null;
            let removeTimer = null;
            const scheduleHide = (delay = 2200) => {
                clearTimeout(hideTimer);
                clearTimeout(removeTimer);
                hideTimer = setTimeout(() => {
                    toast.classList.add("hide");
                    removeTimer = setTimeout(() => toast.remove(), 220);
                }, delay);
            };

            scheduleHide();
            toast.addEventListener("mouseenter", () => {
                clearTimeout(hideTimer);
                clearTimeout(removeTimer);
                toast.classList.remove("hide");
            });
            toast.addEventListener("mouseleave", () => {
                scheduleHide(900);
            });

            /* Legacy one-shot timers are intentionally removed to prevent stuck toasts after hover. */
        }

        function pushEvent(event) {
            lastEvent = event;
            compactGhosts = [];
            if (event.page_changed) {
                previousCells = {};
            }
            showToast(event);
            render();
        }

        function renderMetrics(state) {
            const activeCount = state.page.slots.filter((slot) => slot.status === "active").length;
            const emptyCount = state.page.slots.filter((slot) => slot.status === "empty").length;
            const gapBytes = state.page.gaps.reduce((total, gap) => total + gap.length, 0);
            metricStrip.innerHTML = `
                <div class="metric-pill" style="--stagger: 40ms"><strong>Page ${state.page.page_id}/${state.page_count}</strong><span>đang xem</span></div>
                <div class="metric-pill" style="--stagger: 80ms"><strong>${state.page.header_size}B</strong><span>header + slot</span></div>
                <div class="metric-pill" style="--stagger: 120ms"><strong>${state.page.free_bytes}B</strong><span>free liền nhau</span></div>
                <div class="metric-pill" style="--stagger: 160ms"><strong>${gapBytes}B</strong><span>vùng đã xóa</span></div>
                <div class="metric-pill" style="--stagger: 200ms"><strong>${activeCount}/${state.page.slots.length}</strong><span>active slots</span></div>
                <div class="metric-pill" style="--stagger: 240ms"><strong>${emptyCount}</strong><span>slot dùng lại</span></div>
            `;
        }

        function renderDeleteOptions() {
            const page = currentPage();
            deleteSelect.innerHTML = "";
            if (!page.slots.length) {
                const option = document.createElement("option");
                option.value = "0";
                option.textContent = "Chưa có slot";
                deleteSelect.appendChild(option);
                deleteBtn.disabled = true;
                return;
            }
            page.slots.forEach((slot) => {
                const option = document.createElement("option");
                option.value = String(slot.id);
                option.textContent = slot.status === "active"
                    ? `${ptrName(slot.id)} · ${slot.label} · ${slot.length}B`
                    : `${ptrName(slot.id)} · empty`;
                deleteSelect.appendChild(option);
            });
            deleteBtn.disabled = !page.slots.some((slot) => slot.status === "active");
        }

        function renderPageOptions() {
            pageSelect.innerHTML = "";
            pages.forEach((page, index) => {
                const option = document.createElement("option");
                option.value = String(index);
                option.textContent = `Page ${page.id}`;
                pageSelect.appendChild(option);
            });
            pageSelect.value = String(pageIndex);
        }

        function renderPageChain() {
            const pageNodes = pages.map((page, index) => `
                <button class="page-node ${index === pageIndex ? "active" : ""}" data-page-index="${index}" style="--stagger: ${60 + index * 50}ms">
                    <span>Page ${page.id}</span>
                    <small>${liveFreeSpace(page)}B free</small>
                    <i style="--free-ratio: ${Math.max(0.04, liveFreeSpace(page) / page.pageSize)}"></i>
                </button>
            `);
            pageChain.innerHTML = `
                <div class="directory-node">
                    <strong>Page directory</strong>
                    <span>free-space map</span>
                </div>
                <span class="directory-link">trỏ tới</span>
                <div class="page-chain-pages">
                    ${pageNodes.join('<span class="page-link"><b>next</b> →</span>')}
                </div>
            `;
            pageChain.querySelectorAll(".page-node").forEach((button) => {
                button.addEventListener("click", () => {
                    previousCells = {};
                    pageIndex = Number(button.dataset.pageIndex);
                    pushEvent({
                        ok: true,
                        title: `Page ${currentPage().id}`,
                        note: "Đang xem page được chọn.",
                        operation: "Switch page",
                        complexity: "O(1)",
                        timing_ms: 0,
                        moved: [],
                    });
                });
            });
        }

        function makeEmptyRow(tableKey) {
            const table = userTables[tableKey];
            const id = table.nextId;
            table.nextId += 1;
            return {
                __stt: id,
                __tag: `${table.prefix}#${id}`,
                ...Object.fromEntries(table.columns.map((column) => [column, ""])),
            };
        }

        function fillAutoRow(tableKey, row) {
            if (tableKey === "students") {
                row.student_id = String(2000 + row.__stt);
                row.full_name = `Student ${row.__stt}`;
                row.class_name = `CNTT${(row.__stt % 9) + 1}`;
                row.email = `student${row.__stt}@mail.com`;
                row.phone = `09${String(10000000 + row.__stt).slice(-8)}`;
                return;
            }
            if (tableKey === "courses") {
                row.course_id = String(300 + row.__stt);
                row.course_name = `Course_${row.__stt}`;
                row.credits = String((row.__stt % 4) + 2);
                row.dept_name = `Dept_${(row.__stt % 6) + 1}`;
                return;
            }
            row.student_id = String(2000 + row.__stt);
            row.course_id = String(300 + row.__stt);
            row.semester = `202${row.__stt % 5}-2`;
            row.score = (6 + (row.__stt % 30) / 10).toFixed(1);
        }

        function autoAddUserRow(tableKey) {
            const row = makeEmptyRow(tableKey);
            fillAutoRow(tableKey, row);
            userTables[tableKey].rows.push(row);
            previousCells = rememberCells(currentPage());
            const event = timed(() => insertWithPageHandling(rowToSeed(tableKey, row)));
            if (!event.ok) {
                userTables[tableKey].rows.pop();
                userTables[tableKey].nextId = Math.max(1, userTables[tableKey].nextId - 1);
                return {
                    ...event,
                    operation: "Thêm data mẫu",
                };
            }

            if (Array.isArray(event.changed_slots) && event.changed_slots.length) {
                const slotId = event.changed_slots[0];
                const page = currentPage();
                row.__slot_ref = `Page ${page.id} · ${ptrName(slotId)} · ${byteLength(rowToSeed(tableKey, row).data)}B`;
            }

            return {
                ...event,
                operation: "Thêm data mẫu",
                note: `Đã thêm ${row.__tag}.`,
            };
        }

        function importPatch(batchSize = 36) {
            stopScenario();
            importPatchBtn.disabled = true;
            importPatchBtn.textContent = "Importing...";

            const start = performance.now();
            const targetBatch = Math.max(1, Number(batchSize) || 1000);

            liveDataApi.importPatchSeeds(targetBatch)
                .then((seeds) => {
                    let imported = 0;

                    seeds.forEach((seed) => {
                        const table = userTables[seed.tableKey];
                        if (!table) {
                            return;
                        }

                        const row = makeEmptyRow(seed.tableKey);
                        row.__tag = seed.label || row.__tag;

                        const values = String(seed.data || "").split(",");
                        table.columns.forEach((column, colIndex) => {
                            row[column] = (values[colIndex] || "").trim();
                        });
                        table.rows.push(row);
                        imported += 1;
                    });

                    rebuildMemoryFromTables("Import Patch", `Đã import ${imported} dòng từ dữ liệu init.`);
                    pushEvent({
                        ...lastEvent,
                        operation: "Import Patch",
                        note: `Đã import ${imported} dòng từ Data (batch).`,
                        timing_ms: performance.now() - start,
                    });
                })
                .catch((error) => {
                    pushEvent({
                        ok: false,
                        title: "Import Patch thất bại",
                        note: `Không đọc được dữ liệu init: ${error.message}`,
                        operation: "Import Patch",
                        complexity: "O(1)",
                        timing_ms: performance.now() - start,
                        moved: [],
                    });
                })
                .finally(() => {
                    importPatchBtn.disabled = false;
                    importPatchBtn.textContent = "Import Patch";
                });
        }

        function removeUserRowByTag(tag) {
            for (const tableKey of TABLE_ORDER) {
                const table = userTables[tableKey];
                const index = table.rows.findIndex((row) => row.__tag === tag);
                if (index !== -1) {
                    table.rows.splice(index, 1);
                    return true;
                }
            }
            return false;
        }

        function clearUserTables() {
            TABLE_ORDER.forEach((tableKey) => {
                userTables[tableKey].rows = [];
                userTables[tableKey].nextId = 1;
            });
        }

        function rowToSeed(tableKey, row) {
            // Gọi logic LiveData.
            return liveDataApi.rowToSeed(tableKey, row);
        }

        function rebuildMemoryFromTables(operation, note) {
            previousCells = {};
            pages.splice(0, pages.length, createLivePage(1));
            pageIndex = 0;

            TABLE_ORDER.forEach((tableKey) => {
                userTables[tableKey].rows.forEach((row) => {
                    row.__slot_ref = "chưa ghi page";
                });
            });

            TABLE_ORDER.forEach((tableKey) => {
                userTables[tableKey].rows.forEach((row) => {
                    const seed = rowToSeed(tableKey, row);
                    if (!seed) {
                        return;
                    }
                    const event = insertWithPageHandling(seed);
                    if (event.ok && Array.isArray(event.changed_slots) && event.changed_slots.length) {
                        const slotId = event.changed_slots[0];
                        const page = currentPage();
                        row.__slot_ref = `Page ${page.id} · ${ptrName(slotId)} · ${byteLength(seed.data)}B`;
                    }
                });
            });

            if (pages.length) {
                pageIndex = pages.length - 1;
            }

            lastEvent = {
                ok: true,
                title: "Đồng bộ từ bảng user",
                note,
                operation,
                complexity: "O(N)",
                timing_ms: 0,
                moved: [],
            };
        }

        function renderUserView() {
            const tabs = TABLE_ORDER.map((tableKey) => {
                const table = userTables[tableKey];
                return `<button class="entity-tab ${activeEntityTab === tableKey ? "active" : ""}" data-action="switch-entity" data-table="${tableKey}">${table.title}</button>`;
            }).join("");

            const tableKey = activeEntityTab;
            const table = userTables[tableKey];
            const header = table.columns.map((column) => `<th>${column}</th>`).join("");
            const rows = table.rows.map((row, rowIndex) => {
                const cells = table.columns.map((column) => `
                    <td>
                        <textarea
                            class="sheet-input"
                            data-table="${tableKey}"
                            data-row="${rowIndex}"
                            data-column="${column}"
                            rows="2"
                        >${String(row[column] ?? "")}</textarea>
                    </td>
                `).join("");
                return `
                    <tr>
                        <td class="stt-cell">${row.__stt || ""}</td>
                        <td class="tag-cell">${row.__tag || ""}</td>
                        ${cells}
                        <td class="actions-cell">
                            <button class="sheet-icon danger" data-action="delete-row" data-table="${tableKey}" data-row="${rowIndex}">xóa</button>
                        </td>
                    </tr>
                `;
            }).join("");
            const body = rows || `<tr><td class="empty-sheet" colspan="${table.columns.length + 3}">Chưa có dòng nào.</td></tr>`;
            const formFields = table.columns.map((column) => `
                <label class="sheet-form-field">
                    <span>${column}</span>
                    <input class="sheet-form-input" data-table="${tableKey}" data-form-column="${column}" placeholder="Nhập ${column}">
                </label>
            `).join("");

            userSheetGrid.innerHTML = `
                <div class="entity-tabs">${tabs}</div>
                <article class="user-sheet ${table.accent}">
                    <header class="sheet-head">
                        <div>
                            <h3>${table.title}</h3>
                            <p>Bắt buộc nhập đủ ${table.columns.length} trường khi thêm mới</p>
                        </div>
                    </header>
                    <div class="sheet-form">
                        ${formFields}
                        <button class="control-btn primary sheet-add" data-action="add-row" data-table="${tableKey}">+ Thêm dòng đầy đủ</button>
                        <button class="control-btn sheet-add-sample" data-action="add-sample" data-table="${tableKey}">Thêm data mẫu</button>
                    </div>
                    <div class="sheet-wrap">
                        <table class="sheet-table">
                            <thead>
                                <tr>
                                    <th>stt</th>
                                    <th>ma</th>
                                    ${header}
                                    <th>...</th>
                                </tr>
                            </thead>
                            <tbody>${body}</tbody>
                        </table>
                    </div>
                </article>
            `;
        }

        function setActiveTab(tabName) {
            activeTab = tabName;
            const memoryActive = tabName === "memory";
            tabMemory.classList.toggle("active", memoryActive);
            tabUser.classList.toggle("active", !memoryActive);
            tabMemory.setAttribute("aria-selected", String(memoryActive));
            tabUser.setAttribute("aria-selected", String(!memoryActive));
            panelMemory.classList.toggle("active", memoryActive);
            panelUser.classList.toggle("active", !memoryActive);
            panelMemory.hidden = !memoryActive;
            panelUser.hidden = memoryActive;
        }

        function stopScenario() {
            if (!scenarioTimer) {
                scenarioBtn.textContent = "Start";
                return;
            }
            clearInterval(scenarioTimer);
            scenarioTimer = null;
            scenarioBtn.textContent = "Start";
        }

        function autoDeleteFirstActive() {
            for (let pIndex = 0; pIndex < pages.length; pIndex += 1) {
                const page = pages[pIndex];
                const firstActive = page.slots.find((slot) => slot.status === "active");
                if (!firstActive) {
                    continue;
                }
                pageIndex = pIndex;
                previousCells = rememberCells(page);
                const event = timed(() => liveDelete(page, firstActive.id));
                if (event.ok) {
                    removeUserRowByTag(firstActive.label);
                }
                return {
                    ...event,
                    operation: "Auto-play: delete",
                };
            }
            return {
                ok: false,
                title: "Không có slot active",
                note: "Kịch bản không tìm thấy record để xóa.",
                operation: "Auto-play: delete",
                complexity: "O(P*S)",
                moved: [],
            };
        }

        function autoCompactCurrentPage() {
            const page = currentPage();
            previousCells = rememberCells(page);
            compactGhosts = page.gaps.map((gap) => ({
                offset: gap.start,
                length: gap.length,
            }));
            return timed(() => {
                const event = liveCompact(page);
                event.deleted_ghosts = compactGhosts;
                event.operation = "Auto-play: compact";
                return event;
            });
        }

        function runAutoScenario() {
            const steps = [
                () => autoAddUserRow("students"),
                () => autoAddUserRow("courses"),
                () => autoAddUserRow("enrollments"),
                () => autoAddUserRow("students"),
                () => autoDeleteFirstActive(),
                () => autoCompactCurrentPage(),
                () => autoAddUserRow("courses"),
                () => autoAddUserRow("enrollments"),
            ];

            let stepIndex = 0;
            scenarioBtn.textContent = "Stop";
            pushEvent({
                ok: true,
                title: "Bắt đầu auto-play",
                note: "Đang chạy kịch bản mẫu insert/delete/compact.",
                operation: "Auto-play",
                complexity: "O(K)",
                timing_ms: 0,
                moved: [],
            });

            const runStep = () => {
                if (stepIndex >= steps.length) {
                    stopScenario();
                    pushEvent({
                        ok: true,
                        title: "Auto-play hoàn tất",
                        note: "Kịch bản đã chạy xong.",
                        operation: "Auto-play",
                        complexity: "O(K)",
                        timing_ms: 0,
                        moved: [],
                    });
                    return;
                }
                const event = steps[stepIndex]();
                stepIndex += 1;
                pushEvent(event);
            };

            runStep();
            scenarioTimer = setInterval(runStep, 1200);
        }

        function render() {
            const page = currentPage();
            // Build state từ logic record.
            const state = makeLiveState(page, lastEvent, {
                previousCells,
                pageCount: pages.length,
                pageIndex,
            });
            stateTitle.textContent = state.title;
            stateNote.textContent = state.note;
            operationLabel.textContent = state.operation;
            timingLabel.textContent = state.timing_text;
            complexityLabel.textContent = state.complexity;
            slotGroupTitle.textContent = state.slot_panel_title;
            moveGroupTitle.textContent = state.move_panel_title;
            renderFocusList(slotList, state.stable_slots, "stable");
            if (state.moved_records.length) {
                moveGroup.hidden = false;
                renderFocusList(moveList, state.moved_records, "move");
            } else {
                moveGroup.hidden = true;
                moveList.innerHTML = "";
            }
            renderMetrics(state);
            renderDeleteOptions();
            renderPageOptions();
            renderPageChain();
            renderUserView();
            drawFigure(svg, state);
            animateLiveFigure(svg, state);
            previousCells = rememberCells(page);
        }

        tabMemory.addEventListener("click", () => setActiveTab("memory"));
        tabUser.addEventListener("click", () => setActiveTab("user"));
        panelUser.addEventListener("click", (event) => {
            const target = event.target.closest("button[data-action]");
            if (!target) {
                return;
            }
            const action = target.dataset.action;
            const tableKey = target.dataset.table;
            if (action === "switch-entity" && tableKey && userTables[tableKey]) {
                activeEntityTab = tableKey;
                renderUserView();
                return;
            }
            if (!tableKey || !userTables[tableKey]) {
                return;
            }
            if (action === "add-row") {
                const formInputs = panelUser.querySelectorAll(`input[data-table="${tableKey}"][data-form-column]`);
                const draft = {};
                let hasEmpty = false;
                formInputs.forEach((input) => {
                    const column = input.dataset.formColumn;
                    const value = input.value.trim();
                    if (column) {
                        draft[column] = value;
                    }
                    if (!value.length) {
                        hasEmpty = true;
                    }
                });
                if (hasEmpty) {
                    showToast({
                        ok: false,
                        operation: `${userTables[tableKey].title}: thiếu dữ liệu`,
                        note: "Cần nhập đầy đủ tất cả trường trước khi thêm.",
                    });
                    return;
                }
                const row = makeEmptyRow(tableKey);
                Object.assign(row, draft);
                userTables[tableKey].rows.push(row);
                previousCells = rememberCells(currentPage());
                const event = timed(() => insertWithPageHandling(rowToSeed(tableKey, row)));
                if (!event.ok) {
                    userTables[tableKey].rows.pop();
                    userTables[tableKey].nextId = Math.max(1, userTables[tableKey].nextId - 1);
                    pushEvent({
                        ...event,
                        operation: "Thêm dữ liệu",
                    });
                    return;
                }
                if (Array.isArray(event.changed_slots) && event.changed_slots.length) {
                    const slotId = event.changed_slots[0];
                    const page = currentPage();
                    row.__slot_ref = `Page ${page.id} · ${ptrName(slotId)} · ${byteLength(rowToSeed(tableKey, row).data)}B`;
                }
                pushEvent({
                    ...event,
                    operation: "Thêm dữ liệu",
                    note: `Đã thêm ${row.__tag}.`,
                });
            }
            if (action === "add-sample") {
                const event = autoAddUserRow(tableKey);
                pushEvent(event);
            }
            if (action === "delete-row") {
                const rowIndex = Number(target.dataset.row);
                const row = userTables[tableKey].rows[rowIndex];
                if (!row) {
                    return;
                }
                const tag = row.__tag;
                let deleted = false;
                let deleteEvent = {
                    ok: false,
                    title: "Không tìm thấy dữ liệu",
                    note: "Không tìm thấy record tương ứng trong bộ nhớ.",
                    operation: "Xóa dữ liệu",
                    complexity: "O(N)",
                    moved: [],
                };
                pages.forEach((page, idx) => {
                    page.slots.forEach((slot) => {
                        if (deleted || slot.status !== "active" || slot.label !== tag) {
                            return;
                        }
                        pageIndex = idx;
                        previousCells = rememberCells(page);
                        deleteEvent = timed(() => liveDelete(page, slot.id));
                        deleted = deleteEvent.ok;
                    });
                });
                if (deleted) {
                    userTables[tableKey].rows.splice(rowIndex, 1);
                    pushEvent({
                        ...deleteEvent,
                        operation: "Xóa dữ liệu",
                        note: `Đã xóa ${tag}.`,
                    });
                } else {
                    pushEvent(deleteEvent);
                }
            }
        });
        panelUser.addEventListener("change", (event) => {
            const input = event.target.closest("textarea.sheet-input");
            if (!input) {
                return;
            }
            const tableKey = input.dataset.table;
            const rowIndex = Number(input.dataset.row);
            const column = input.dataset.column;
            const table = userTables[tableKey];
            if (!table || !table.rows[rowIndex] || !column) {
                return;
            }
            table.rows[rowIndex][column] = input.value;
            rebuildMemoryFromTables("Cập nhật dữ liệu", `Đã cập nhật dữ liệu bảng ${table.title}.`);
            render();
        });

        importPatchBtn.addEventListener("click", () => {
            importPatch(1000);
        });

        deleteBtn.addEventListener("click", () => {
            const page = currentPage();
            const slotId = Number(deleteSelect.value);
            const slot = page.slots[slotId];
            const removedTag = slot && slot.status === "active" ? slot.label : null;

            previousCells = rememberCells(page);
            // Gọi logic delete.
            const event = timed(() => liveDelete(page, slotId));
            if (event.ok && removedTag) {
                removeUserRowByTag(removedTag);
            }
            pushEvent(event);
        });
        compactBtn.addEventListener("click", () => {
            const page = currentPage();
            previousCells = rememberCells(page);
            compactGhosts = page.gaps.map((gap) => ({
                offset: gap.start,
                length: gap.length,
            }));
            pushEvent(timed(() => {
                // Gọi logic compact.
                const event = liveCompact(page);
                event.deleted_ghosts = compactGhosts;
                return event;
            }));
        });
        resetBtn.addEventListener("click", () => {
            previousCells = {};
            pages.splice(0, pages.length, createLivePage(1));
            pageIndex = 0;
            clearUserTables();
            pushEvent(timed(() => {
                // Gọi logic reset.
                const event = liveReset(currentPage());
                event.note = "Đã đưa dữ liệu user về trống.";
                return event;
            }));
        });
        pageSelect.addEventListener("change", () => {
            previousCells = {};
            pageIndex = Number(pageSelect.value);
            pushEvent({
                ok: true,
                title: `Page ${currentPage().id}`,
                note: "Đang xem page được chọn.",
                operation: "Switch page",
                complexity: "O(1)",
                timing_ms: 0,
                moved: [],
            });
        });
        scenarioBtn.addEventListener("click", () => {
            if (scenarioTimer) {
                stopScenario();
                return;
            }
            runAutoScenario();
        });

        rebuildMemoryFromTables("Sẵn sàng", "Dữ liệu user đã được nạp.");
        setActiveTab(activeTab);
        stopScenario();
        render();
    }

    window.PageVisualView = {
        renderDemo,
        renderError,
        renderLiveDemo,
    };
})();
