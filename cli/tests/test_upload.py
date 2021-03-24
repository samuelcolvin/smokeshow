import re

import pytest

from smokeshow import upload
from smokeshow.main import fmt_size

from .conftest import DummyServer


def test_upload_file(tmp_path, dummy_server: DummyServer, await_):
    f = tmp_path / 'test.html'
    f.write_text('<h1>testing</h1>')
    url = await_(upload(f, auth_key='testing-auth-key', root_url=dummy_server.server_name))
    assert re.fullmatch(r'http://localhost:\d+/testing-site/', url)

    assert dummy_server.app['sites'] == ['testing-auth-key']
    assert dummy_server.app['files'] == {
        '/testing-site/test.html': {'body': b'<h1>testing</h1>', 'content-type': 'text/html'}
    }


def test_upload_dir(tmp_path, dummy_server: DummyServer, await_):
    (tmp_path / 'index.html').write_text('<h1>testing</h1>')
    (tmp_path / 'foo.js.map').write_text('{"x": 123}')
    (tmp_path / 'bar.unknown_extension').write_text('xxx')

    url = await_(upload(tmp_path, auth_key='testing-auth-key', root_url=dummy_server.server_name))
    assert re.fullmatch(r'http://localhost:\d+/testing-site/', url)

    assert dummy_server.app['sites'] == ['testing-auth-key']
    assert dummy_server.app['files'] == {
        '/testing-site/index.html': {
            'body': b'<h1>testing</h1>',
            'content-type': 'text/html',
        },
        '/testing-site/foo.js.map': {
            'body': b'{"x": 123}',
            'content-type': 'application/json',
        },
        '/testing-site/bar.unknown_extension': {
            'body': b'xxx',
            'content-type': None,
        },
    }


def test_upload_generate(mocker, tmp_path, dummy_server: DummyServer, await_):
    mocker_generate_key = mocker.patch('smokeshow.main.generate_key', return_value='mocked-generate-key')

    f = tmp_path / 'test.html'
    f.write_text('<h1>testing</h1>')
    url = await_(upload(f, root_url=dummy_server.server_name))
    assert re.fullmatch(r'http://localhost:\d+/testing-site/', url)

    assert dummy_server.app['sites'] == ['mocked-generate-key']
    assert dummy_server.app['files'] == {
        '/testing-site/test.html': {'body': b'<h1>testing</h1>', 'content-type': 'text/html'}
    }
    mocker_generate_key.assert_called_once()


@pytest.mark.parametrize(
    'number,pretty',
    [
        (123, '123B'),
        (4.2 * 1024, '4.2KB'),
        (4.2 * 1024 * 1024, '4.2MB'),
    ],
)
def test_statues(number, pretty):
    assert fmt_size(number) == pretty
