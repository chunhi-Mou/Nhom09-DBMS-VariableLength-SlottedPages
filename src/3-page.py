import struct
from dataclasses import dataclass

@dataclass
class Slot:
    offset: int
    length: int

    @property
    def is_empty(self) -> bool:
        return self.offset == 0xFFFF

@dataclass
class BlockHeader:
    num_entries: int
    free_space_ptr: int

    @property
    def header_size(self) -> int:
        return 4 + self.num_entries * 4

class SlottedPage:
    def __init__(self, page_size: int = 4096):
        self.page_size = page_size
        self.data = bytearray(page_size)
        self._write_header(BlockHeader(0, page_size))

    def _read_header(self) -> BlockHeader:
        num_entries, free_space_ptr = struct.unpack_from(">HH", self.data, 0)
        return BlockHeader(num_entries, free_space_ptr)

    def _write_header(self, header: BlockHeader):
        struct.pack_into(">HH", self.data, 0, header.num_entries, header.free_space_ptr)

    def _read_slot(self, slot_id: int) -> Slot:
        offset_pos = 4 + slot_id * 4
        offset, length = struct.unpack_from(">HH", self.data, offset_pos)
        return Slot(offset, length)

    def _write_slot(self, slot_id: int, slot: Slot):
        offset_pos = 4 + slot_id * 4
        offset = 0xFFFF if slot.is_empty else slot.offset
        struct.pack_into(">HH", self.data, offset_pos, offset, slot.length)

    def free_space(self) -> int:
        header = self._read_header()
        return header.free_space_ptr - header.header_size

    def _find_reusable_slot(self, num_entries: int) -> int:
        for i in range(num_entries):
            if self._read_slot(i).is_empty:
                return i
        return -1

    def insert(self, record: bytes) -> int:
        record_len = len(record)
        header = self._read_header()

        reuse_id = self._find_reusable_slot(header.num_entries)

        req_space = record_len if reuse_id != -1 else record_len + 4
        if self.free_space() < req_space:
            return -1

        new_offset = header.free_space_ptr - record_len
        self.data[new_offset : header.free_space_ptr] = record
        
        target_id = reuse_id if reuse_id != -1 else header.num_entries
        self._write_slot(target_id, Slot(new_offset, record_len))
        
        if reuse_id == -1:
            header.num_entries += 1
            
        header.free_space_ptr = new_offset
        self._write_header(header)
        return target_id

    def delete(self, slot_id: int):
        header = self._read_header()
        if 0 <= slot_id < header.num_entries:
            slot = self._read_slot(slot_id)
            if not slot.is_empty:
                self._write_slot(slot_id, Slot(0xFFFF, 0))

    def get(self, slot_id: int) -> bytes:
        header = self._read_header()
        if slot_id < 0 or slot_id >= header.num_entries:
            return None
            
        slot = self._read_slot(slot_id)
        if slot.is_empty:
            return None
            
        return self.data[slot.offset : slot.offset + slot.length]

    def compact(self) -> dict:
        moved_records = {}
        header = self._read_header()
        
        active_slots = []
        for i in range(header.num_entries):
            slot = self._read_slot(i)
            if not slot.is_empty:
                active_slots.append((i, slot))
                
        active_slots.sort(key=lambda item: item[1].offset, reverse=True)
        
        new_free = self.page_size
        
        for slot_id, slot in active_slots:
            new_offset = new_free - slot.length
            if new_offset != slot.offset:
                record_data = self.data[slot.offset : slot.offset + slot.length]
                self.data[new_offset : new_offset + slot.length] = record_data
                
                self._write_slot(slot_id, Slot(new_offset, slot.length))
                moved_records[slot_id] = (slot.offset, new_offset)
                
            new_free = new_offset
            
        header.free_space_ptr = new_free
        self._write_header(header)
        return moved_records
        
