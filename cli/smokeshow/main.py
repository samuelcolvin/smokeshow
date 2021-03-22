import asyncio
import base64
import hashlib
import os
import re
import sys
from mimetypes import guess_type
from pathlib import Path
from typing import Optional, Union

from httpx import AsyncClient
from typer import Argument, Exit, Option, Typer

from .version import VERSION

__all__ = 'cli', 'upload'

USER_AGENT = f'smokeshow-cli-v{VERSION}'
KEY_HASH_THRESHOLD = 2 ** 233
ROOT_URL = 'https://smokeshow.helpmanual.io'
cli = Typer()


@cli.command(help='Generate a new upload key')
def generate_key():
    print(
        'Searching for a key with valid hash '
        '(the numeric representation of its sha-256 hash needs to be less than 2^233). '
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
            break


@cli.command(help='Upload one or more files to great a new site')
def upload(
    path: Path = Argument(..., exists=True, dir_okay=True, file_okay=True, readable=True, resolve_path=True),
    auth_key: str = Option(..., envvar='SMOKESHOW_AUTH_KEY'),
    root_url: str = Option(ROOT_URL, envvar='SMOKESHOW_ROOT_URL'),
) -> Optional[str]:
    try:
        asyncio.run(async_upload(path, auth_key, root_url=root_url))
    except ValueError as e:
        print(e, file=sys.stderr)
        raise Exit(1)


async def async_upload(path: str, auth_key: str, *, root_url: str = ROOT_URL) -> str:
    root_path = Path(path).resolve()

    async with AsyncClient(timeout=30) as client:
        r = await client.post(root_url + '/create/', headers={'Authorisation': auth_key, 'User-Agent': USER_AGENT})
        if r.status_code != 200:
            raise ValueError(f'Error creating ephemeral site {r.status_code}, response:\n{r.text}')

        obj = r.json()
        secret_key: str = obj['secret_key']
        upload_root: str = obj['url']
        assert upload_root.endswith('/'), upload_root

        # useful when uploading to a dev endpoint where the worker returns the production host in request.url
        if not upload_root.startswith(root_url):
            upload_root = re.sub('https?://[^/]+', root_url)

        async def upload_file(file_path: Path, rel_path: Union[Path, str]):
            url_path = str(rel_path)
            headers = {'Authorisation': secret_key, 'User-Agent': USER_AGENT}
            ct = get_content_type(url_path)
            if ct:
                headers['Content-Type'] = ct
            r2 = await client.post(upload_root + url_path, data=file_path.read_bytes(), headers=headers)
            if r2.status_code == 200:
                upload_info = r2.json()
                print(f'    {url_path} ct={ct} size={fmt_size(upload_info["size"])}')
                return upload_info['total_site_size']
            else:
                print(f'    ERROR! {url_path} status={r2.status_code} response={r2.text}')
                raise ValueError(f'invalid response from "{url_path}" status={r2.status_code} response={r2.text}')

        if root_path.is_dir():
            coros = [upload_file(p, p.relative_to(root_path)) for p in root_path.glob('**/*') if p.is_file()]
            print(f'Site created with root {upload_root}, uploading {len(coros)} files...')
            total_size = max(await asyncio.gather(*coros))
        else:
            # root_path is a file
            print(f'Site created with root {upload_root}, uploading 1 file...')
            total_size = await upload_file(root_path, root_path.name)

        print(f'upload complete ✓ site size {fmt_size(total_size)}')
        print('go to', upload_root)

    return upload_root


def get_content_type(url: str) -> Optional[str]:
    if re.search(r'\.(js|css)\.map$', url):
        return 'application/json'
    else:
        return guess_type(url)[0]


KB = 1024
MB = KB ** 2


def fmt_size(num: int) -> str:
    if num < KB:
        return f'{num:0.0f}B'
    elif num < MB:
        return f'{num / KB:0.1f}KB'
    else:
        return f'{num / MB:0.1f}MB'
