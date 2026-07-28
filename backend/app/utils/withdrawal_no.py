from datetime import datetime, timezone
from secrets import token_hex


def new_withdrawal_no() -> str:
    return f"WD{datetime.now(timezone.utc):%Y%m%d%H%M%S}{token_hex(3).upper()}"
