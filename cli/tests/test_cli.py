from typer.testing import CliRunner

from smokeshow.main import cli

runner = CliRunner()


def test_help():
    result = runner.invoke(cli, ['--help'])
    assert result.exit_code == 0
    assert 'smokeshow CLI, see https://smokeshow.helpmanual.io for more information.\n' in result.stdout


def test_generate_key(mocker):
    mocker.patch('smokeshow.main.KEY_HASH_THRESHOLD', 2 ** 237)

    result = runner.invoke(cli, ['generate-key'])
    assert result.exit_code == 0
    assert 'Success! Key found after' in result.stdout
    assert '    SMOKESHOW_AUTH_KEY=' in result.stdout
