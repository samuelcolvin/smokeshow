import asyncio
import base64
import hashlib
import os
import re
import sys
from mimetypes import guess_type
from pathlib import Path
from typing import Optional, Union, cast

from httpx import AsyncClient, AsyncHTTPTransport, HTTPError
from typer import Argument, Exit, Option, Typer

from .version import __version__

__all__ = 'cli', 'upload'

USER_AGENT = f'smokeshow-cli-v{__version__}'
KEY_HASH_THRESHOLD_POW = 234
KEY_HASH_THRESHOLD = 2**KEY_HASH_THRESHOLD_POW
ROOT_URL = 'https://smokeshow.helpmanual.io'
DEFAULT_TIMEOUT = 30  # seconds
UPLOAD_FILE_TIMEOUT = 300  # seconds
REQUEST_RETRIES = 3

cli = Typer(
    name='smokeshow', help=f'Smokeshow CLI v{__version__}, see https://smokeshow.helpmanual.io for more information.'
)


def version_callback(value: bool) -> None:
    if value:
        print(f'Smokeshow v{__version__}')
        raise Exit()


@cli.callback()
def _cli_callback(
    _version: bool = Option(None, '--version', callback=version_callback, is_eager=True),
) -> None:
    pass


@cli.command(help='Generate a new upload key')
def generate_key() -> str:
    print(
        'Searching for a key with valid hash '
        f'(the numeric representation of its sha-256 hash needs to be less than 2^{KEY_HASH_THRESHOLD_POW}). '
        'Hold tight, this might take a minute...'
    )
    attempts = 0
    while True:
        attempts += 1
        seed = os.urandom(50)
        h = int.from_bytes(hashlib.sha256(seed).digest(), 'big')
        if attempts % 100_000 == 0:
            print('.', end='', flush=True)
        if h < KEY_HASH_THRESHOLD:
            key = base64.b64encode(seed).decode().rstrip('=')
            print(f"\nSuccess! Key found after {attempts:,} attempts:\n\n    SMOKESHOW_AUTH_KEY='{key}'\n")
            return key


@cli.command(name='upload', help='Upload one or more files to create a new site')
def cli_upload(
    path: Path = Argument(..., exists=True, dir_okay=True, file_okay=True, readable=True, resolve_path=True),
    auth_key: Optional[str] = Option(None, envvar='SMOKESHOW_AUTH_KEY'),
    root_url: str = Option(ROOT_URL, envvar='SMOKESHOW_ROOT_URL'),
    github_status_description: Optional[str] = Option(None, envvar='SMOKESHOW_GITHUB_STATUS_DESCRIPTION'),
    github_coverage_threshold: Optional[float] = Option(None, envvar='SMOKESHOW_GITHUB_COVERAGE_THRESHOLD'),
) -> None:
    try:
        asyncio.run(
            upload(
                path,
                auth_key=auth_key,
                github_status_description=github_status_description,
                github_coverage_threshold=github_coverage_threshold,
                root_url=root_url,
            )
        )
    except ValueError as e:
        print(e, file=sys.stderr)
        raise Exit(1)


async def upload(
    root_path: Path,
    *,
    auth_key: Optional[str] = None,
    github_status_description: Optional[str] = None,
    github_coverage_threshold: Optional[float] = None,
    root_url: str = ROOT_URL,
) -> str:
    if auth_key is None:
        print('No auth key provided, generating one now...')
        auth_key_use = generate_key()
    else:
        auth_key_use = auth_key

    if not root_path.exists():
        raise ValueError(f'root path "{root_path}" does not exist')

    transport = AsyncHTTPTransport(retries=REQUEST_RETRIES)
    async with AsyncClient(timeout=DEFAULT_TIMEOUT, transport=transport) as client:
        try:
            r = await client.post(
                root_url + '/create/', headers={'Authorisation': auth_key_use, 'User-Agent': USER_AGENT}
            )
        except HTTPError as err:
            raise ValueError(f'Error creating ephemeral site {err}')
        if r.status_code != 200:
            raise ValueError(f'Error creating ephemeral site {r.status_code}, response:\n{r.text}')

        obj = r.json()
        secret_key: str = obj['secret_key']
        upload_root: str = obj['url']
        assert upload_root.endswith('/'), upload_root

        # useful when uploading to a dev endpoint where the worker returns the production host in request.url
        if not upload_root.startswith(root_url):
            upload_root = re.sub('^https?://[^/]+', root_url, upload_root)

        if root_path.is_dir():
            tasks: list[asyncio.Task[int]] = []
            for p in root_path.glob('**/*'):
                if not p.is_file():
                    continue
                task = asyncio.create_task(_upload_file(client, secret_key, upload_root, p, p.relative_to(root_path)))
                tasks.append(task)

            print(f'Site created with root {upload_root}\nuploading {len(tasks)} files...')
            # if an error occurs other tasks will still be executed which does not make much sense here so better
            # cancel them explicitly
            try:
                results = await asyncio.gather(*tasks)
            except ValueError:
                await _handle_tasks(tasks)
                raise
            total_size = max(results)
        else:
            # root_path is a file
            print(f'Site created with root {upload_root}\nuploading 1 file...')
            total_size = await _upload_file(client, secret_key, upload_root, root_path, root_path.name)

        print(f'upload complete ✓ site size {fmt_size(total_size)}')
        print('go to', upload_root)
        if github_status_description is not None:
            state, description = get_github_status_info(root_path, github_status_description, github_coverage_threshold)
            await set_github_commit_status(client, upload_root, state, description)

    return upload_root


async def _handle_tasks(tasks: list[asyncio.Task[int]]) -> None:
    """cancel all tasks and ignore all exceptions along the way"""
    for task in tasks:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        except Exception:
            pass


async def _upload_file(
    client: AsyncClient, secret_key: str, upload_root: str, file_path: Path, rel_path: Union[Path, str]
) -> int:
    """
    Raises:
        ValueError:
            - If the connecting to the host fails or the post request fails in any other way.
            - If the post request yields any other response code than 200
    """
    url_path = str(rel_path)
    headers = {'Authorisation': secret_key, 'User-Agent': USER_AGENT}
    ct = get_content_type(url_path)
    if ct:
        headers['Content-Type'] = ct
    try:
        r2 = await client.post(
            upload_root + url_path, content=file_path.read_bytes(), headers=headers, timeout=UPLOAD_FILE_TIMEOUT
        )
    except HTTPError:
        print(f'    ERROR! Error uploading file {file_path}')
        raise ValueError(f'Uploading {url_path} failed due to a network error')

    if r2.status_code == 200:
        upload_info = r2.json()
        print(f'    {url_path} ct={ct} size={fmt_size(upload_info["size"])}')
        return cast(int, upload_info['total_site_size'])
    else:
        print(f'    ERROR! {url_path} status={r2.status_code} response={r2.text}')
        raise ValueError(f'invalid response from "{url_path}" status={r2.status_code} response={r2.text}')


def get_content_type(url: str) -> Optional[str]:
    if re.search(r'\.(js|css)\.map$', url):
        return 'application/json'
    else:
        return guess_type(url)[0]


KB = 1024
MB = KB**2


def fmt_size(num: int) -> str:
    if num < KB:
        return f'{num:0.0f}B'
    elif num < MB:
        return f'{num / KB:0.1f}KB'
    else:
        return f'{num / MB:0.1f}MB'


GITHUB_API_ROOT = 'https://api.github.com'
COVERAGE_REGEXES = (
    # for coverage
    re.compile(r'<span\s+class="pc_cov">\s*([\d.]+)%\s*</span>'),
    # for diff-cover
    re.compile(r'<li><b>Coverage</b>: *([\d.]+)%</li>'),
)


def get_github_status_info(path: Path, description: str, coverage_threshold: Optional[float]) -> tuple[str, str]:
    state = 'success'
    if '{coverage-percentage}' not in description.lower() and coverage_threshold is None:
        return state, description

    cov_sub = '{COVERAGE NOT FOUND}'
    index_path = path / 'index.html'
    if index_path.is_file():
        for regex in COVERAGE_REGEXES:
            m = regex.search(index_path.read_text())
            if m:
                coverage = float(m.group(1))
                if coverage_threshold is not None and coverage < coverage_threshold:
                    state = 'failure'
                    cov_sub = f'{coverage:0.2f}% < {coverage_threshold:0.2f}%'
                else:
                    cov_sub = f'{coverage:0.2f}%'
                break

    description = re.sub('{coverage-percentage}', cov_sub, description, flags=re.I)
    return state, description


async def set_github_commit_status(client: AsyncClient, target_url: str, state: str, description: str) -> None:
    github_repo = os.environ['GITHUB_REPOSITORY']
    github_sha = os.environ.get('SMOKESHOW_GITHUB_PR_HEAD_SHA') or os.environ['GITHUB_SHA']
    url = f'{GITHUB_API_ROOT}/repos/{github_repo}/statuses/{github_sha}'
    print(f'setting status on github.com/{github_repo}#{github_sha:.7}, {state}: "{description}"')

    github_token = os.environ['SMOKESHOW_GITHUB_TOKEN']
    context = 'smokeshow'
    github_context = os.environ.get('SMOKESHOW_GITHUB_CONTEXT')
    if github_context:
        context += f' / {github_context}'
    r = await client.post(
        url,
        headers={'authorization': f'Bearer {github_token}', 'accept': 'application/vnd.github.v3+json'},
        json={
            'state': state,
            'target_url': target_url,
            'description': description,
            'context': context,
        },
    )
    if r.status_code != 201:
        raise ValueError(f'invalid response from "{url}" status={r.status_code} response={r.text}')
