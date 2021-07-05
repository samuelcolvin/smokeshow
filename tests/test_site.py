import re
from datetime import datetime, timedelta, timezone
from time import sleep

from pytest_cloudflare_worker import TestClient
from pytest_toolbox.comparison import AnyInt, CloseToNow, RegexStr


def test_create_get(client: TestClient):
    r = client.delete('/testing/storage/')
    assert r.status_code == 200, r.text

    r = client.post('/create/', headers={'authorisation': 'YWJjZAy'})
    assert r.status_code == 200, r.text
    obj = r.json()
    # debug(obj)
    assert obj['message'] == 'New site created successfully'
    assert obj['url'].startswith('https://example.com/')
    assert obj['site_creation'] == RegexStr(r'20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z')
    site_creation = datetime.fromisoformat(obj['site_creation'][:-1]).replace(tzinfo=timezone.utc)
    assert site_creation == CloseToNow()
    site_expiration = datetime.fromisoformat(obj['site_expiration'][:-1]).replace(tzinfo=timezone.utc)
    assert site_expiration - site_creation == timedelta(seconds=90)
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

    expiration = int(round(site_expiration.replace(tzinfo=timezone.utc).timestamp()))
    r = client.get('/testing/storage/', params={'prefix': f'site:{pk}'})
    assert r.status_code == 200, r.text
    # debug(r.json())
    # debug(client.inspect_log_wait(wait_time=3))
    assert r.json() == {
        f'site:{pk}:/': {
            'value': '1',
            'metadata': {
                'size': 23,
                'content_type': 'text/html',
                'hash': 'H4OFKgUZxqnmcsGSJH4+soIyellWXc1Kq5t/fzbuHhQ=',
            },
            'expiration': expiration,
        },
        f'site:{pk}:/.smokeshow.json': {
            'value': RegexStr('{.+}'),
            'metadata': {'content_type': 'application/json', 'size': AnyInt()},
            'expiration': expiration,
        },
        f'site:{pk}:/foobar.html': {
            'value': '1',
            'metadata': {'size': 24, 'content_type': 'foo/bar', 'hash': 'jqfqkZwCywQ/gc9JZlkCIj3pbO7fBy9TTpSVYDCWfio='},
            'expiration': expiration,
        },
    }
    r = client.get('/testing/storage/', params={'prefix': 'file:'})
    assert r.status_code == 200, r.text
    obj = r.json()
    assert obj['file:H4OFKgUZxqnmcsGSJH4+soIyellWXc1Kq5t/fzbuHhQ='] == {
        'value': '<h1>this is a test</h1>',
        'metadata': {'path': '/', 'public_key': pk},
        'expiration': expiration,
    }
    assert obj['file:jqfqkZwCywQ/gc9JZlkCIj3pbO7fBy9TTpSVYDCWfio='] == {
        'value': '<h1>this is my page</h1>',
        'metadata': {'path': '/foobar.html', 'public_key': pk},
        'expiration': expiration,
    }


def test_404(client: TestClient):
    r = client.delete('/testing/storage/')
    assert r.status_code == 200, r.text

    r = client.post('/create/', headers={'authorisation': 'YWJjZAy'})
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


def test_duplicate_file(client: TestClient):
    r = client.delete('/testing/storage/')
    assert r.status_code == 200, r.text

    r = client.post('/create/', headers={'authorisation': 'YWJjZAy'})
    assert r.status_code == 200, r.text
    obj = r.json()
    pk1 = re.sub(r'^https://example\.com/', '', obj['url']).strip('/')
    key1 = obj['secret_key']
    site_expiration = datetime.fromisoformat(obj['site_expiration'][:-1]).replace(tzinfo=timezone.utc)
    expiration1 = int(round(site_expiration.timestamp()))

    content = 'this is a test file'
    r = client.post(
        f'/{pk1}/snap.file',
        data=content,
        headers={'authorisation': key1, 'content-type': 'text/html'},
    )
    assert r.status_code == 200, r.text

    # make sure expiration2 > expiration1
    sleep(1)

    r = client.post('/create/', headers={'authorisation': 'YWJjZAy'})
    assert r.status_code == 200, r.text
    obj = r.json()
    pk2 = re.sub(r'^https://example\.com/', '', obj['url']).strip('/')
    key2 = obj['secret_key']
    site_expiration = datetime.fromisoformat(obj['site_expiration'][:-1]).replace(tzinfo=timezone.utc)
    expiration2 = int(round(site_expiration.timestamp()))

    assert expiration2 > expiration1

    r = client.post(
        f'/{pk2}/different.file',
        data=content,
        headers={'authorisation': key2, 'content-type': 'foo/bar'},
    )
    assert r.status_code == 200, r.text

    r = client.get(f'/{pk1}/snap.file')
    assert r.status_code == 200, r.text
    assert r.text == content
    assert r.headers['content-type'] == 'text/html'

    r = client.get(f'/{pk2}/different.file')
    assert r.status_code == 200, r.text
    assert r.text == content
    assert r.headers['content-type'] == 'foo/bar'

    r = client.get('/testing/storage/', params={'prefix': f'site:{pk1}'})
    assert r.status_code == 200, r.text
    assert r.json() == {
        f'site:{pk1}:/.smokeshow.json': {
            'value': RegexStr(fr'\{{\n  "url": "https://example.com/{pk1}/",\n.*'),
            'metadata': {'content_type': 'application/json', 'size': AnyInt()},
            'expiration': expiration1,
        },
        f'site:{pk1}:/snap.file': {
            'value': '1',
            'metadata': {
                'size': 19,
                'content_type': 'text/html',
                'hash': 'WIFwflSwES+QG8g6H/usrI+rdOpGpvcGo+/F99TBxiU=',
            },
            'expiration': expiration1,
        },
    }

    r = client.get('/testing/storage/', params={'prefix': f'site:{pk2}'})
    assert r.status_code == 200, r.text
    assert r.json() == {
        f'site:{pk2}:/.smokeshow.json': {
            'value': RegexStr(fr'\{{\n  "url": "https://example.com/{pk2}/",\n.*'),
            'metadata': {'content_type': 'application/json', 'size': AnyInt()},
            'expiration': expiration2,
        },
        f'site:{pk2}:/different.file': {
            'value': '1',
            'metadata': {'size': 19, 'content_type': 'foo/bar', 'hash': 'WIFwflSwES+QG8g6H/usrI+rdOpGpvcGo+/F99TBxiU='},
            'expiration': expiration2,
        },
    }

    r = client.get('/testing/storage/', params={'prefix': 'file:WIFwflSwES'})
    assert r.status_code == 200, r.text
    assert r.json() == {
        'file:WIFwflSwES+QG8g6H/usrI+rdOpGpvcGo+/F99TBxiU=': {
            'value': 'this is a test file',
            'metadata': {'path': '/different.file', 'public_key': pk2},
            'expiration': expiration2,
        }
    }


def test_site_not_found(client: TestClient):
    r = client.get('/0123456789abcdefghij/')
    assert r.status_code == 404, r.text
    assert r.text == '404: Site "0123456789abcdefghij" not found'
    assert r.headers['content-type'] == 'text/plain;charset=UTF-8'
