import re
from typing import TYPE_CHECKING

from smokeshow import upload

if TYPE_CHECKING:
    from foxglove.test_server import DummyServer


def test_upload_file(tmp_path, dummy_server: 'DummyServer', await_):
    f = tmp_path / 'test.html'
    f.write_text('<h1>testing</h1>')
    url = await_(upload(f, 'testing-auth-key', root_url=dummy_server.server_name))
    assert re.fullmatch(r'http://localhost:\d+/testing-site/', url)

    assert dummy_server.app['sites'] == ['testing-auth-key']
    assert dummy_server.app['files'] == {'/testing-site/test.html': b'<h1>testing</h1>'}
