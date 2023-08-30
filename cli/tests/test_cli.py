import re
import sys

import httpx
import pytest
from dirty_equals import IsStr
from typer.testing import CliRunner

from smokeshow.main import cli

runner = CliRunner()


def test_help():
    result = runner.invoke(cli, ['--help'])
    assert result.exit_code == 0
    assert result.stdout == IsStr(
        regex=r'.*Smokeshow CLI v\d\.[\d.]+, see https://smokeshow\.helpmanual\.io for.*', regex_flags=re.S
    )


def test_version():
    result = runner.invoke(cli, ['--version'])
    assert result.exit_code == 0
    assert result.stdout == IsStr(regex=r'Smokeshow v\d\.[\d.]+\n')


def test_generate_key(mocker):
    mocker.patch('smokeshow.main.KEY_HASH_THRESHOLD', 2**237)

    result = runner.invoke(cli, ['generate-key'])
    assert result.exit_code == 0
    assert 'Success! Key found after' in result.stdout
    assert '    SMOKESHOW_AUTH_KEY=' in result.stdout


@pytest.mark.skipif(sys.version_info < (3, 8), reason="Mock doesn't work well with async code in 3.7")
def test_upload_success(tmp_path, mocker):
    mocker.patch('smokeshow.main.upload')
    f = tmp_path / 'test.html'
    f.write_text('<h1>testing</h1>')

    result = runner.invoke(cli, ['upload', str(tmp_path)])
    assert result.exit_code == 0, result.stdout
    assert result.stdout == ''


def test_upload_error(tmp_path, mocker):
    mocker_upload = mocker.patch('smokeshow.main.upload', side_effect=ValueError('intentional error testing upload'))
    f = tmp_path / 'test.html'
    f.write_text('<h1>testing</h1>')

    result = runner.invoke(cli, ['upload', str(tmp_path)])
    assert result.exit_code == 1, result.stdout
    assert result.stdout == 'intentional error testing upload\n'

    mocker_upload.assert_called_once()


def test_upload_http_error(tmp_path, mocker):
    mocker_upload = mocker.patch.object(
        httpx.AsyncClient, 'post', side_effect=httpx.HTTPError('testing file upload failure')
    )
    f = tmp_path / 'test.html'
    f.write_text('<h1>testing</h1>')
    (tmp_path / 'foo.js.map').write_text('{"x": 123}')

    result = runner.invoke(cli, ['upload', str(tmp_path), '--auth-key', 'testing-auth-key'], catch_exceptions=False)
    assert result.exit_code == 1, result.stdout
    assert result.stdout == 'Error creating ephemeral site testing file upload failure\n'
    mocker_upload.assert_called_once()
