from pytest_cloudflare_worker import TestClient


def test_create_site(client: TestClient):
    r = client.post('/create/', headers={'authorisation': 'YWJjZA'})
    assert r.status_code == 200, r.text
    debug(r.json())
