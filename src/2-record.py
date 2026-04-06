# Chuyển dữ liệu sang bytes

def encode_record(fields: list) -> bytes:
    str_fields = []
    
    for field in fields:
        if field is not None:
            str_fields.append(str(field))
        else:
            str_fields.append("")
    return ",".join(str_fields).encode("utf-8")

def decode_record(raw: bytes) -> list:
    return raw.decode("utf-8").split(",")

