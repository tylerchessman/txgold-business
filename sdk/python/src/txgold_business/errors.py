"""The API's error responses."""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Optional


class TxGoldApiError(Exception):
    """An error response from the API (application/problem+json).

    ``code`` is the stable, documented value to branch on; see
    https://docs.txgold.money/errors/{code}.
    """

    def __init__(self, status: int, problem: Mapping[str, Any]) -> None:
        def text(name: str) -> Optional[str]:
            value = problem.get(name)
            return value if isinstance(value, str) else None

        self.status: int = status
        self.code: str = text("code") or f"http_{status}"
        self.title: str = text("title") or f"HTTP {status}"
        self.detail: Optional[str] = text("detail")
        self.request_id: Optional[str] = text("requestId")
        self.type: Optional[str] = text("type")
        errors = problem.get("errors")
        #: Field-level problems for invalid_request: field name to messages.
        self.errors: Optional[Dict[str, List[str]]] = errors if isinstance(errors, dict) else None
        message = f"{self.title} ({self.code})"
        super().__init__(f"{message}: {self.detail}" if self.detail else message)
