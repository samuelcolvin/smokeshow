import asyncio
import os
import re
import sys
from mimetypes import guess_type
from pathlib import Path
from typing import Optional

from httpx import AsyncClient

__all__ = 'cli', 'upload'


create_url = 'https://hightmp.samuelcolvin.workers.dev/create/'
# create_url = 'http://localhost:8787/create/'


def cli():
    if len(sys.argv) != 2:
        print('Usage: smokeshow directory-to-upload', file=sys.stderr)
        sys.exit(1)

    error = asyncio.run(upload(sys.argv[1], os.environ['HIGHTMP_AUTH']))
    if error:
        print(error, file=sys.stderr)
        sys.exit(1)


async def upload(path: str, auth_key: str) -> Optional[str]:
    root_path = Path(path).resolve()
    if not root_path.is_dir():
        return f'Error, {root_path} is not a directory'

    async with AsyncClient(timeout=30) as client:
        r = await client.post(create_url, headers={'Authorisation': auth_key})
        if r.status_code != 200:
            return f'Error creating temporary site {r.status_code}, response:\n{r.text}'
        obj = r.json()
        upload_root = obj['url']
        assert upload_root.endswith('/'), upload_root
        # upload_root = upload_root.replace('https://hightmp.samuelcolvin.workers.dev', 'http://localhost:8787')
        secret_key = obj['secret_key']

        async def upload_file(file_path: Path):
            url_path = str(file_path.relative_to(root_path))
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

        coros = [upload_file(p) for p in root_path.glob('**/*') if p.is_file()]

        print(f'Site created with root {upload_root}, uploading {len(coros)} files...')
        total_size = max(await asyncio.gather(*coros))
        print(f'upload complete ✓ site size {fmt_size(total_size)}')
        print('go to', upload_root)

    return None


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
