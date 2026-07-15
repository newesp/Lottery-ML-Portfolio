import pytest
import requests

from lottery_ml.data.fetch import FetchError, NfdClient


class FakeResponse:
    content = b"history"

    def raise_for_status(self) -> None:
        return None


class FakeSession:
    def get(
        self,
        url: str,
        *,
        timeout: tuple[float, float],
        headers: dict[str, str],
    ) -> FakeResponse:
        assert url.endswith("/power-38/2026.htm")
        assert timeout == (5.0, 20.0)
        assert "Lottery-ML-Portfolio" in headers["User-Agent"]
        return FakeResponse()


def test_fetch_year_returns_source_bytes() -> None:
    client = NfdClient(session=FakeSession())

    assert client.fetch_year(2026) == b"history"


class FailingSession:
    def get(
        self,
        url: str,
        *,
        timeout: tuple[float, float],
        headers: dict[str, str],
    ) -> FakeResponse:
        raise requests.Timeout("slow")


def test_fetch_year_wraps_request_failure() -> None:
    client = NfdClient(session=FailingSession())

    with pytest.raises(FetchError, match="2026"):
        client.fetch_year(2026)


class EmptySession:
    def get(
        self,
        url: str,
        *,
        timeout: tuple[float, float],
        headers: dict[str, str],
    ) -> FakeResponse:
        response = FakeResponse()
        response.content = b""
        return response


def test_fetch_year_rejects_empty_response() -> None:
    client = NfdClient(session=EmptySession())

    with pytest.raises(FetchError, match="empty response"):
        client.fetch_year(2026)
