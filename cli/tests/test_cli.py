from typer.testing import CliRunner

from smokeshow import main

runner = CliRunner()


def test_help():
    result = runner.invoke(main.cli, ['--help'])
    assert result.exit_code == 0
    debug(result.stdout)
    assert 'smokeshow CLI, see https://smokeshow.helpmanual.io for more information.\n' in result.stdout


def test_generate_key(mocker):
    pass
