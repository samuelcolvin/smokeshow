import re

from pytest_cloudflare_worker import TestClient
from pytest_toolbox.comparison import AnyInt, CloseToNow, RegexStr


def test_create_site(client: TestClient):
    r = client.delete('/testing/storage/')
    assert r.status_code == 200, r.text

    r = client.post('/create/', headers={'authorisation': 'YWJjZA'})
    assert r.status_code == 200, r.text
    obj = r.json()
    # debug(obj)
    assert obj['message'] == 'New site created successfully'
    assert obj['url'].startswith('https://example.com/')
    pk = re.sub(r'^https://example\.com/', '', obj['url']).strip('/')

    r = client.post(
        f'/{pk}/',
        data='<h1>this is a test</h1>',
        headers={'authorisation': obj['secret_key'], 'content-type': 'text/html'},
    )
    assert r.status_code == 200, r.text
    assert r.json() == {
        'path': '/',
        'content_type': 'text/html',
        'size': 23,
        'total_site_size': 23,
    }

    r = client.get(f'/{pk}/')
    assert r.status_code == 200, r.text
    assert r.text == '<h1>this is a test</h1>'
    assert r.headers['content-type'] == 'text/html'

    r = client.get(f'/{pk}/.smokeshow.json')
    assert r.status_code == 200, r.text
    assert r.headers['content-type'] == 'application/json'
    assert r.json() == {
        'url': f'https://example.com/{pk}/',
        'site_creation': CloseToNow(delta=10),
        'site_expiration': RegexStr(r'20\d\d-\d\d-\d\dT.+'),
        'files': ['/'],
        'total_site_size': 175,
    }

    r = client.get('/testing/storage/')
    assert r.status_code == 200, r.text
    # debug(r.json())
    assert r.json() == [
        {
            'name': 'hmac_secret_key',
        },
        {
            'name': f'site:{pk}:/',
            'expiration': AnyInt(),
            'metadata': {
                'content_type': 'text/html',
                'size': 23,
            },
        },
        {
            'name': f'site:{pk}:/.smokeshow.json',
            'expiration': AnyInt(),
            'metadata': {
                'content_type': 'application/json',
                'size': AnyInt(),
            },
        },
    ]
