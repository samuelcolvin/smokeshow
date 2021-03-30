import re

from pytest_cloudflare_worker import TestClient
from pytest_toolbox.comparison import AnyInt, CloseToNow, RegexStr


def test_create_get(client: TestClient):
    r = client.delete('/testing/storage/')
    assert r.status_code == 200, r.text

    r = client.post('/create/', headers={'authorisation': 'YWJjZAx'})
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
    assert r.json() == {'path': '/', 'content_type': 'text/html', 'size': 23, 'total_site_size': 23}

    r = client.get(f'/{pk}/')
    assert r.status_code == 200, r.text
    assert r.text == '<h1>this is a test</h1>'
    assert r.headers['content-type'] == 'text/html'

    r = client.get(f'/{pk}/.smokeshow.json')
    assert r.status_code == 200, r.text
    assert r.json() == {
        'url': f'https://example.com/{pk}/',
        'site_creation': CloseToNow(delta=10),
        'site_expiration': RegexStr(r'20\d\d-\d\d-\d\dT.+'),
        'files': ['/'],
        'total_site_size': 175,
    }
    assert r.headers['content-type'] == 'application/json'

    r = client.post(
        f'/{pk}/foobar.html',
        data='<h1>this is my page</h1>',
        headers={'authorisation': obj['secret_key'], 'content-type': 'foo/bar'},
    )
    assert r.status_code == 200, r.text
    assert r.json() == {'path': '/foobar.html', 'content_type': 'foo/bar', 'size': 24, 'total_site_size': 47}

    r = client.get(f'/{pk}/foobar/')
    assert r.status_code == 200, r.text
    assert r.text == '<h1>this is my page</h1>'
    assert r.headers['content-type'] == 'foo/bar'

    r = client.get('/testing/storage/')
    assert r.status_code == 200, r.text
    # debug(r.json())
    # debug(client.inspect_log_wait(wait_time=3))
    assert r.json() == [
        {
            'name': 'file:H4OFKgUZxqnmcsGSJH4+soIyellWXc1Kq5t/fzbuHhQ=',
            'expiration': AnyInt(),
        },
        {
            'name': 'file:jqfqkZwCywQ/gc9JZlkCIj3pbO7fBy9TTpSVYDCWfio=',
            'expiration': AnyInt(),
        },
        {
            'name': 'hmac_secret_key',
        },
        {
            'name': f'site:{pk}:/',
            'expiration': AnyInt(),
            'metadata': {
                'size': 23,
                'content_type': 'text/html',
                'hash': 'H4OFKgUZxqnmcsGSJH4+soIyellWXc1Kq5t/fzbuHhQ=',
            },
        },
        {
            'name': f'site:{pk}:/.smokeshow.json',
            'expiration': AnyInt(),
            'metadata': {'content_type': 'application/json', 'size': 152},
        },
        {
            'name': f'site:{pk}:/foobar.html',
            'expiration': AnyInt(),
            'metadata': {'size': 24, 'content_type': 'foo/bar', 'hash': 'jqfqkZwCywQ/gc9JZlkCIj3pbO7fBy9TTpSVYDCWfio='},
        },
    ]


def test_404(client: TestClient):
    r = client.delete('/testing/storage/')
    assert r.status_code == 200, r.text

    r = client.post('/create/', headers={'authorisation': 'YWJjZAx'})
    assert r.status_code == 200, r.text
    obj = r.json()
    # debug(obj)
    assert obj['message'] == 'New site created successfully'
    assert obj['url'].startswith('https://example.com/')
    pk = re.sub(r'^https://example\.com/', '', obj['url']).strip('/')

    r = client.get(f'/{pk}/missing.html')
    assert r.status_code == 404, r.text
    assert r.text == f'404: File "/missing.html" not found in site "{pk}"'
    assert r.headers['content-type'].startswith('text/plain')

    r = client.post(
        f'/{pk}/404.html',
        data='<h1>Page not found :-(</h1>',
        headers={'authorisation': obj['secret_key'], 'content-type': 'text/html'},
    )
    assert r.status_code == 200, r.text
    assert r.json() == {'path': '/404.html', 'content_type': 'text/html', 'size': 27, 'total_site_size': 27}

    r = client.get(f'/{pk}/missing.html')
    assert r.status_code == 404, r.text
    assert r.text == '<h1>Page not found :-(</h1>'
    assert r.headers['content-type'] == 'text/html'
