from datetime import datetime
from secrets import token_hex


def new_order_no() -> str:
    return f"JP{datetime.now():%Y%m%d}{token_hex(4).upper()}"
