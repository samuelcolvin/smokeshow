from pytest_cloudflare_worker import TestClient


def test_index(client: TestClient):
    r = client.get('/')
    assert r.status_code == 200, r.text

    assert r.text.startswith('<!DOCTYPE html>\n')
    assert '<title>smokeshow</title>' in r.text
    assert '<p>Deploy ephemeral websites via HTTP or <a href="#cli-usage">a CLI</a>.</p>' in r.text

    assert r.headers['content-type'] == 'text/html'


def test_favicon(client: TestClient):
    r = client.get('/favicon.ico')
    assert r.status_code == 200, r.text
    assert r.headers['content-type'] == 'image/vnd.microsoft.icon'
