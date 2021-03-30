import pytest

from smokeshow.main import get_github_status_info, set_github_commit_status

from .conftest import DummyServer, SetEnv


def test_status_success(tmp_path):
    f = tmp_path / 'index.html'
    f.write_text('<h1>testing</h1>\n<span class="pc_cov">55.44%</span>')
    assert get_github_status_info(tmp_path, 'test {coverage-percentage}', 40) == ('success', 'test 55.44%')


@pytest.mark.parametrize(
    'coverage,description,threshold,output',
    [
        ('55.4', 'test {coverage-percentage}', 40, ('success', 'test 55.40%')),
        ('55.4', 'test {coverage-percentage}', None, ('success', 'test 55.40%')),
        ('55.4', 'test', None, ('success', 'test')),
        ('55', 'test {coverage-percentage}', 40, ('success', 'test 55.00%')),
        ('55.123456', 'test {coverage-percentage}', 40, ('success', 'test 55.12%')),
        ('55.129', 'test {coverage-percentage}', 40, ('success', 'test 55.13%')),
        ('55.4', 'test', 40, ('success', 'test')),
        ('55.4', '{COVERAGE-PERCENTAGE}', 60, ('failure', '55.40% < 60.00%')),
        ('55.4', '', 60, ('failure', '')),
        ('100', 'test {coverage-percentage}', 100, ('success', 'test 100.00%')),
        ('99.99', 'test {coverage-percentage}', 100, ('failure', 'test 99.99% < 100.00%')),
    ],
)
def test_statues(tmp_path, coverage, description, threshold, output):
    f = tmp_path / 'index.html'
    f.write_text(f'<h1>testing</h1>\n<span class="pc_cov">{coverage}%</span>')
    assert get_github_status_info(tmp_path, description, threshold) == output


def test_no_index(tmp_path):
    f = tmp_path / 'foobar.html'
    f.write_text('<h1>testing</h1>\n<span class="pc_cov">55.44%</span>')
    assert get_github_status_info(tmp_path, 'test {coverage-percentage}', 1) == ('success', 'test {COVERAGE NOT FOUND}')


def test_root_is_file(tmp_path):
    f = tmp_path / 'foobar.html'
    f.write_text('hello')
    assert get_github_status_info(f, 'test {coverage-percentage}', 50) == ('success', 'test {COVERAGE NOT FOUND}')


def test_coverage_not_found(tmp_path):
    f = tmp_path / 'index.html'
    f.write_text('<h1>testing</h1>')
    assert get_github_status_info(tmp_path, 'test {coverage-percentage}', 1) == ('success', 'test {COVERAGE NOT FOUND}')


def test_set_status(env: SetEnv, mocker, dummy_server: DummyServer, await_, async_client):
    mocker.patch('smokeshow.main.GITHUB_API_ROOT', dummy_server.server_name + '/github')

    env.set('GITHUB_REPOSITORY', 'samuelcolvin/foobar')
    env.set('SMOKESHOW_GITHUB_PR_HEAD_SHA', 'abc1234')
    env.set('SMOKESHOW_GITHUB_TOKEN', 'xxx')

    await_(set_github_commit_status(async_client, 'https://www.example.com/testing', 'success', 'testing'))

    assert dummy_server.app['statuses'] == {
        'repos/samuelcolvin/foobar/statuses/abc1234': {
            'state': 'success',
            'target_url': 'https://www.example.com/testing',
            'description': 'testing',
            'context': 'smokeshow',
        },
    }
