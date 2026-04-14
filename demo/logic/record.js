(function () {
    function encodeRecord(fields) {
        const normalized = (fields || []).map((field) => (field === null || field === undefined ? "" : String(field)));
        return new TextEncoder().encode(normalized.join(","));
    }

    function decodeRecord(raw) {
        if (!raw) {
            return [];
        }
        return new TextDecoder().decode(raw).split(",");
    }

    function byteLength(text) {
        return new TextEncoder().encode(text).length;
    }

    function ptrName(slotId) {
        return `ptr${slotId + 1}`;
    }

    function cellName(slotId) {
        return `cell${slotId + 1}`;
    }

    function shorten(text, limit = 54) {
        return text.length <= limit ? text : `${text.slice(0, limit - 3)}...`;
    }

    function formatMs(ms) {
        return `${ms.toFixed(3)} ms`;
    }

    function derivePreviousFreeEnd(previousCells, pageSize) {
        const cells = Object.values(previousCells || {});
        if (!cells.length) {
            return pageSize;
        }

        let minOffset = pageSize;
        cells.forEach((cell) => {
            if (typeof cell.offset === "number" && cell.offset < minOffset) {
                minOffset = cell.offset;
            }
        });
        return minOffset;
    }

    function makeLiveState(page, event, context = {}) {
        const { liveHeaderSize, liveFreeSpace } = window.PageCore;
        const insertSources = event.insert_sources || {};
        const movedRecords = event.moved || [];
        const hasInsertSources = Object.keys(insertSources).length > 0;
        const isCompactionEvent = /compact/i.test(String(event.operation || "")) && !hasInsertSources;
        const headerSize = liveHeaderSize(page);
        const previousFreeEnd = derivePreviousFreeEnd(context.previousCells, page.pageSize);
        const slots = page.slots.map((slot) => {
            const item = {
                id: slot.id,
                ptr: ptrName(slot.id),
                cell: cellName(slot.id),
                label: slot.label || slot.oldLabel || "",
                status: slot.status,
            };
            if (slot.status === "active") {
                item.offset = slot.offset;
                item.length = slot.length;
                item.data = shorten(slot.data);
            }
            return item;
        });

        const stableSlots = slots.map((slot) => {
            const item = {
                slot_id: slot.id,
                ptr: slot.ptr,
                slot_kept: true,
                status: slot.status,
            };
            if (slot.status === "active") {
                item.cell = slot.cell;
                item.label = slot.label;
                item.offset = slot.offset;
                item.length = slot.length;
            }
            return item;
        });

        return {
            short: "Live",
            live: true,
            title: event.title,
            note: event.note,
            operation: event.operation,
            timing_ms: event.timing_ms || 0,
            timing_text: formatMs(event.timing_ms || 0),
            complexity: event.complexity,
            slot_panel_title: "Ptr/slot trong header",
            move_panel_title: "Cell dữ liệu bị dời",
            previous_cells: context.previousCells || {},
            previous_free_end: previousFreeEnd,
            changed_slots: event.changed_slots || [],
            insert_sources: insertSources,
            deleted_ghosts: event.deleted_ghosts || [],
            compact_animation: isCompactionEvent && movedRecords.length > 0,
            event_kind: event.kind || "",
            page_count: context.pageCount || 1,
            page_index: context.pageIndex || 0,
            page: {
                page_size: page.pageSize,
                page_id: page.id,
                header_size: headerSize,
                free_start: headerSize,
                free_end: page.freeEnd,
                free_bytes: liveFreeSpace(page),
                slots,
                gaps: page.gaps.map((gap) => ({
                    start: gap.start,
                    length: gap.length,
                    label: gap.label,
                })),
            },
            stable_slots: stableSlots,
            moved_records: movedRecords,
        };
    }

    window.PageRecord = {
        encodeRecord,
        decodeRecord,
        byteLength,
        ptrName,
        cellName,
        shorten,
        formatMs,
        makeLiveState,
    };
})();
