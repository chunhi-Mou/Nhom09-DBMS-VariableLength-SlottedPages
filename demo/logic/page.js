(function () {
    const EMPTY_OFFSET = 0xffff;

    class Slot {
        constructor(offset, length) {
            this.offset = offset;
            this.length = length;
        }

        get isEmpty() {
            return this.offset === EMPTY_OFFSET;
        }
    }

    class BlockHeader {
        constructor(numEntries, freeSpacePtr) {
            this.numEntries = numEntries;
            this.freeSpacePtr = freeSpacePtr;
        }

        get headerSize() {
            return 4 + this.numEntries * 4;
        }
    }

    class SlottedPage {
        constructor(pageSize = 4096) {
            this.pageSize = pageSize;
            this.data = new Uint8Array(pageSize);
            this.view = new DataView(this.data.buffer);
            this._writeHeader(new BlockHeader(0, pageSize));
        }

        _readHeader() {
            const numEntries = this.view.getUint16(0, false);
            const freeSpacePtr = this.view.getUint16(2, false);
            return new BlockHeader(numEntries, freeSpacePtr);
        }

        _writeHeader(header) {
            this.view.setUint16(0, header.numEntries, false);
            this.view.setUint16(2, header.freeSpacePtr, false);
        }

        _readSlot(slotId) {
            const pos = 4 + slotId * 4;
            const offset = this.view.getUint16(pos, false);
            const length = this.view.getUint16(pos + 2, false);
            return new Slot(offset, length);
        }

        _writeSlot(slotId, slot) {
            const pos = 4 + slotId * 4;
            this.view.setUint16(pos, slot.isEmpty ? EMPTY_OFFSET : slot.offset, false);
            this.view.setUint16(pos + 2, slot.length, false);
        }

        freeSpace() {
            const header = this._readHeader();
            return header.freeSpacePtr - header.headerSize;
        }

        _freeSpaceWithHeader(header) {
            return header.freeSpacePtr - header.headerSize;
        }

        _fragmentedFreeSpace(numEntries) {
            let total = 0;
            for (let i = 0; i < numEntries; i += 1) {
                const slot = this._readSlot(i);
                if (slot.isEmpty && slot.length > 0) {
                    total += slot.length;
                }
            }
            return total;
        }

        _findReusableSlot(numEntries) {
            for (let i = 0; i < numEntries; i += 1) {
                if (this._readSlot(i).isEmpty) {
                    return i;
                }
            }
            return -1;
        }

        insert(recordBytes) {
            const recordLen = recordBytes.length;
            let header = this._readHeader();

            // B1 tìm slot rỗng để tái sử dụng, nếu không có thì cần thêm 4B cho slot mới
            const reuseId = this._findReusableSlot(header.numEntries);
            const reqSpace = reuseId !== -1 ? recordLen : recordLen + 4;
            const oldFreeEnd = header.freeSpacePtr;
            let contiguousFree = this._freeSpaceWithHeader(header);
            let compacted = false;

            if (contiguousFree < reqSpace) {
                // B2 nếu chỉ thiếu do phân mảnh thì compact một lần để gom free liền khối
                const totalFree = contiguousFree + this._fragmentedFreeSpace(header.numEntries);
                if (totalFree < reqSpace) {
                    return {
                        ok: false,
                        reuseId,
                        oldFreeEnd,
                        contiguousFree,
                        totalFree,
                        compacted,
                    };
                }

                this.compact();
                compacted = true;
                header = this._readHeader();
                contiguousFree = this._freeSpaceWithHeader(header);
                if (contiguousFree < reqSpace) {
                    return {
                        ok: false,
                        reuseId,
                        oldFreeEnd,
                        contiguousFree,
                        totalFree: contiguousFree,
                        compacted,
                    };
                }
            }

            const newOffset = header.freeSpacePtr - recordLen;
            this.data.set(recordBytes, newOffset);

            // B3 nếu tái sử dụng thì giữ nguyên slot id, nếu không thì nối thêm slot mới
            const slotId = reuseId !== -1 ? reuseId : header.numEntries;
            this._writeSlot(slotId, new Slot(newOffset, recordLen));

            if (reuseId === -1) {
                header.numEntries += 1;
            }
            header.freeSpacePtr = newOffset;
            this._writeHeader(header);

            return {
                ok: true,
                slotId,
                reuseId,
                oldFreeEnd,
                offset: newOffset,
                length: recordLen,
                compacted,
            };
        }

        delete(slotId) {
            const header = this._readHeader();
            if (slotId < 0 || slotId >= header.numEntries) {
                return false;
            }
            const slot = this._readSlot(slotId);
            if (slot.isEmpty) {
                return false;
            }

            // Đánh dấu xóa logic nhưng giữ length cũ để compact thu hồi phần phân mảnh
            this._writeSlot(slotId, new Slot(EMPTY_OFFSET, slot.length));

            // Chỉ co slot directory ở đuôi để không làm đổi RID của slot ở giữa
            while (header.numEntries > 0) {
                const tailId = header.numEntries - 1;
                if (!this._readSlot(tailId).isEmpty) {
                    break;
                }
                header.numEntries -= 1;
            }
            this._writeHeader(header);
            return true;
        }

        get(slotId) {
            const header = this._readHeader();
            if (slotId < 0 || slotId >= header.numEntries) {
                return null;
            }
            const slot = this._readSlot(slotId);
            if (slot.isEmpty) {
                return null;
            }
            return this.data.slice(slot.offset, slot.offset + slot.length);
        }

        compact() {
            const moved = {};
            const header = this._readHeader();
            const activeSlots = [];

            for (let i = 0; i < header.numEntries; i += 1) {
                const slot = this._readSlot(i);
                if (!slot.isEmpty) {
                    activeSlots.push([i, slot]);
                }
            }

            // Dồn payload về cuối page, slot id giữ nguyên và chỉ cập nhật offset
            activeSlots.sort((a, b) => b[1].offset - a[1].offset);
            let newFree = this.pageSize;

            activeSlots.forEach(([slotId, slot]) => {
                const newOffset = newFree - slot.length;
                if (newOffset !== slot.offset) {
                    const recordData = this.data.slice(slot.offset, slot.offset + slot.length);
                    this.data.set(recordData, newOffset);
                    this._writeSlot(slotId, new Slot(newOffset, slot.length));
                    moved[slotId] = [slot.offset, newOffset];
                }
                newFree = newOffset;
            });

            header.freeSpacePtr = newFree;
            this._writeHeader(header);
            return moved;
        }

        snapshot() {
            const header = this._readHeader();
            const slots = [];
            for (let i = 0; i < header.numEntries; i += 1) {
                slots.push(this._readSlot(i));
            }
            return {
                numEntries: header.numEntries,
                freeSpacePtr: header.freeSpacePtr,
                headerSize: header.headerSize,
                slots,
            };
        }
    }

    function ensureStore(page) {
        if (!page.__store) {
            page.__store = new SlottedPage(page.pageSize);
        }
        if (!page.__metaBySlot) {
            page.__metaBySlot = {};
        }
        return page.__store;
    }

    function refreshSlotsFromStore(page) {
        const store = ensureStore(page);
        const snapshot = store.snapshot();
        page.freeEnd = snapshot.freeSpacePtr;

        page.slots = snapshot.slots.map((slot, slotId) => {
            const meta = page.__metaBySlot[slotId] || {};
            if (slot.isEmpty) {
                return {
                    id: slotId,
                    status: "empty",
                    oldLabel: meta.label || "",
                };
            }

            return {
                id: slotId,
                status: "active",
                offset: slot.offset,
                length: slot.length,
                label: meta.label || `slot-${slotId}`,
                data: meta.data || "",
            };
        });
    }

    function createLivePage(pageId = 1, pageSize = 256) {
        const page = {
            id: pageId,
            pageSize,
            freeEnd: pageSize,
            slots: [],
            gaps: [],
            __store: new SlottedPage(pageSize),
            __metaBySlot: {},
        };
        refreshSlotsFromStore(page);
        return page;
    }

    function liveHeaderSize(page) {
        return ensureStore(page).snapshot().headerSize;
    }

    function liveFreeSpace(page) {
        return ensureStore(page).freeSpace();
    }

    function liveReusableSlot(page) {
        const snapshot = ensureStore(page).snapshot();
        for (let i = 0; i < snapshot.slots.length; i += 1) {
            if (snapshot.slots[i].isEmpty) {
                return i;
            }
        }
        return -1;
    }

    function liveActiveSlots(page) {
        return page.slots.filter((slot) => slot.status === "active");
    }

    function maxInlineRecordSize(page) {
        return page.pageSize - 8;
    }

    function liveInsert(page, seed) {
        const { ptrName } = window.PageRecord;
        const store = ensureStore(page);
        const text = String(seed.data || "");
        const recordBytes = new TextEncoder().encode(text);

        const result = store.insert(recordBytes);
        if (!result.ok) {
            return {
                ok: false,
                title: "Page hiện tại không đủ chỗ",
                note: `${seed.label} cần thêm chỗ. Liền nhau: ${result.contiguousFree || 0}B, tổng khả dụng: ${result.totalFree || 0}B.`,
                operation: `Insert ${seed.label} thất bại`,
                complexity: "O(N) scan slot",
                moved: [],
            };
        }

        const slotId = result.slotId;
        const reused = result.reuseId !== -1;

        page.__metaBySlot[slotId] = {
            label: seed.label,
            data: text,
        };
        refreshSlotsFromStore(page);

        return {
            ok: true,
            title: reused ? `Tái sử dụng ptr${slotId + 1}` : `Thêm ${seed.label}`,
            note: reused
                ? `${ptrName(slotId)} được dùng lại cho ${seed.label}. Slot id giữ nguyên, dữ liệu mới nằm ở cuối vùng trống.`
                : `${ptrName(slotId)} mới trỏ tới ${seed.label}.`,
            operation: result.compacted ? "Compact + insert" : (reused ? `Reuse slot ${slotId}` : `Insert slot ${slotId}`),
            complexity: "O(N) scan slot",
            changed_slots: [slotId],
            insert_sources: {
                [slotId]: {
                    offset: result.oldFreeEnd,
                    length: recordBytes.length,
                },
            },
            moved: [],
        };
    }

    function liveDelete(page, slotId) {
        const { ptrName } = window.PageRecord;
        const store = ensureStore(page);
        const slot = page.slots[slotId];

        if (!slot || slot.status === "empty") {
            return {
                ok: false,
                title: "Không có record",
                note: `Slot ${slotId} rỗng, bỏ qua delete.`,
                operation: "Delete bỏ qua",
                complexity: "O(1)",
                moved: [],
            };
        }

        page.gaps.push({
            start: slot.offset,
            length: slot.length,
            label: "vùng\nxóa",
            data: slot.data,
            recordLabel: slot.label,
        });

        store.delete(slotId);
        refreshSlotsFromStore(page);

        return {
            ok: true,
            title: `Xóa ${slot.label}`,
            note: `${ptrName(slotId)} vẫn còn, nhưng đã rỗng.`,
            operation: `Delete slot ${slotId}`,
            complexity: "O(1)",
            changed_slots: [slotId],
            deleted_ghosts: [{
                slot_id: slotId,
                offset: slot.offset,
                length: slot.length,
                label: slot.label,
            }],
            moved: [],
        };
    }

    function liveGet(page, slotId) {
        const store = ensureStore(page);
        const raw = store.get(slotId);
        if (!raw) {
            return null;
        }
        return new TextDecoder().decode(raw);
    }

    function liveCompact(page) {
        const { ptrName, cellName } = window.PageRecord;
        const store = ensureStore(page);
        const movedMap = store.compact();
        const moved = [];

        Object.keys(movedMap).forEach((rawSlotId) => {
            const slotId = Number(rawSlotId);
            const [from, to] = movedMap[rawSlotId];
            const slot = page.slots[slotId];
            moved.push({
                slot_id: slotId,
                ptr: ptrName(slotId),
                cell: cellName(slotId),
                label: slot ? slot.label : "",
                from,
                to,
                length: slot ? slot.length : Math.max(0, from - to),
            });
        });

        page.gaps = [];
        refreshSlotsFromStore(page);

        return {
            ok: true,
            title: moved.length ? "Compact page" : "Page đã gọn",
            note: moved.length
                ? "Record còn dùng trượt về cuối page, slot id không đổi."
                : "Không có khoảng trống cần dọn.",
            operation: "Compact page",
            complexity: "O(P) dồn record",
            changed_slots: moved.map((item) => item.slot_id),
            moved,
        };
    }

    function liveReset(page) {
        page.pageSize = 256;
        page.__store = new SlottedPage(page.pageSize);
        page.__metaBySlot = {};
        page.gaps = [];
        refreshSlotsFromStore(page);
        return {
            ok: true,
            title: "Page mới",
            note: "Đã về trạng thái ban đầu.",
            operation: "Reset page",
            complexity: "O(1)",
            moved: [],
        };
    }

    window.PageCore = {
        Slot,
        BlockHeader,
        SlottedPage,
        createLivePage,
        liveHeaderSize,
        liveFreeSpace,
        liveReusableSlot,
        liveActiveSlots,
        maxInlineRecordSize,
        liveInsert,
        liveDelete,
        liveGet,
        liveCompact,
        liveReset,
    };
})();
