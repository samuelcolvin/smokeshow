import asyncio
import os
import re
import sys
from mimetypes import guess_type
from pathlib import Path
from typing import Optional, Union

from httpx import AsyncClient

__all__ = 'cli', 'upload'


def cli():
    error = _cli()
    if error:
        print(error, file=sys.stderr)
        sys.exit(1)


def _cli() -> Optional[str]:
    root_url = os.getenv('SMOKESHOW_ROOT_URL', 'https://smokeshow.helpmanual.io')
    if root_url.endswith('/'):
        return '"SMOKESHOW_ROOT_URL" environment variable should not end with a slash'

    try:
        auth_key = os.environ['SMOKESHOW_AUTH_KEY']
    except KeyError:
        return '"SMOKESHOW_AUTH_KEY" environment variable not set'

    if len(sys.argv) != 2:
        return 'Usage: smokeshow directory-to-upload/'
    path = sys.argv[1]

    try:
        asyncio.run(upload(path, root_url, auth_key))
    except ValueError as e:
        return str(e)


async def upload(path: str, root_url: str, auth_key: str) -> str:
    root_path = Path(path).resolve()
    if not root_path.is_dir() and not root_path.is_file():
        raise ValueError(f'Error, {root_path} is not a directory or file')

    async with AsyncClient(timeout=30) as client:
        r = await client.post(root_url + '/create/', headers={'Authorisation': auth_key})
        if r.status_code != 200:
            raise ValueError(f'Error creating ephemeral site {r.status_code}, response:\n{r.text}')

        obj = r.json()
        upload_root = obj['url']
        assert upload_root.endswith('/'), upload_root
        # upload_root = upload_root.replace('https://smokeshow.helpmanual.io', 'http://localhost:8787')
        secret_key = obj['secret_key']

        async def upload_file(file_path: Path, rel_path: Union[Path, str]):
            url_path = str(rel_path)
            headers = {'Authorisation': secret_key}
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
