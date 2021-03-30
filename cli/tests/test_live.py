import sys
from pathlib import Path

import pytest
from pytest_toolbox.comparison import AnyInt, CloseToNow, RegexStr

from smokeshow import upload

try:
    from pytest_cloudflare_worker import TestClient
except ImportError:
    TestClient = None

skip = TestClient is None or '--cf-auth-client' not in sys.argv
pytestmark = pytest.mark.skipif(skip, reason='pytest-cloudflare-worker not installed')


def test_create_site(client: TestClient, tmp_path: Path, await_, mocker):
    def mock_apost(*args, **kwargs):
        # switch "content" for "data" to convert from httpx to requests
        if 'content' in kwargs:
            kwargs['data'] = kwargs.pop('content')
        return client.post(*args, **kwargs)

    mocker.patch('smokeshow.main.AsyncClient.post', side_effect=mock_apost)

    f = tmp_path / 'index.html'
    f.write_text('<h1>testing index</h1>')
    url = await_(upload(tmp_path, auth_key='YWJjZA', root_url='https://example.com'))
    # debug(url)
    assert url.startswith('https://example.com')
    assert url.endswith('/')
    r = client.get(url)
    assert r.status_code == 200, r.text
    assert r.text == '<h1>testing index</h1>'

    r = client.get(url + '.smokeshow.json')
    assert r.status_code == 200, r.text
    assert r.json() == {
        'url': url,
        'site_creation': CloseToNow(),
        'site_expiration': RegexStr('20..-..-..T.*'),
        'files': [
            '/index.html',
        ],
        'total_site_size': AnyInt(),
    }
