import sys

import pytest
from pytest_toolbox.comparison import RegexStr
from typer.testing import CliRunner

from smokeshow.main import cli

runner = CliRunner()


def test_help():
    result = runner.invoke(cli, ['--help'])
    assert result.exit_code == 0
    assert result.stdout == RegexStr(r'.*smokeshow CLI v\d\.[\d.]+, see https://smokeshow\.helpmanual\.io for.*')


def test_generate_key(mocker):
    mocker.patch('smokeshow.main.KEY_HASH_THRESHOLD', 2 ** 237)

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
