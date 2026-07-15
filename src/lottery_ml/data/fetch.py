from __future__ import annotations

from typing import Protocol

import requests

YEAR_URL = "https://www.nfd.com.tw/lottery/power-38/{year}.htm"
USER_AGENT = "Lottery-ML-Portfolio/0.1 (+https://github.com/newesp/Lottery-ML-Portfolio)"


class ResponseLike(Protocol):
    @property
    def content(self) -> bytes: ...

    def raise_for_status(self) -> None: ...


class SessionLike(Protocol):
    def get(
        self,
        url: str,
        *,
        timeout: tuple[float, float],
        headers: dict[str, str],
    ) -> ResponseLike: ...


class FetchError(RuntimeError):
    """Raised when source transport fails."""


class RequestsSessionAdapter:
    def __init__(self) -> None:
        self._session = requests.Session()

    def get(
        self,
        url: str,
        *,
        timeout: tuple[float, float],
        headers: dict[str, str],
    ) -> ResponseLike:
        return self._session.get(url, timeout=timeout, headers=headers)


class NfdClient:
    def __init__(self, session: SessionLike | None = None) -> None:
        self._session = session if session is not None else RequestsSessionAdapter()

    def fetch_year(self, year: int) -> bytes:
        url = YEAR_URL.format(year=year)
        try:
            response = self._session.get(
                url,
                timeout=(5.0, 20.0),
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
        except requests.RequestException as error:
            raise FetchError(f"failed to fetch NFD year {year}: {error}") from error
        if not response.content:
            raise FetchError(f"NFD year {year} returned an empty response")
        return response.content
