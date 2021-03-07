#!/usr/bin/env python3.8

import asyncio
import os
import sys
from mimetypes import guess_type
from pathlib import Path
from typing import Optional

from httpx import AsyncClient


create_url = 'https://hightmp.samuelcolvin.workers.dev/create/'
auth_header = os.environ['HIGHTMP_AUTH']


async def main(path: str) -> Optional[str]:
    root_path = Path(path).resolve()
    if not root_path.is_dir():
        return f'Error, {root_path} is not a directory'

    async with AsyncClient(timeout=30) as client:
        r = await client.post(create_url, headers={'Authorisation': auth_header})
        if r.status_code != 200:
            return f'Error creating temporary site {r.status_code}, response:\n{r.text}'
        obj = r.json()
        upload_root = obj['url']
        assert upload_root.endswith('/'), upload_root
        secret_key = obj['secret_key']

        async def upload_file(file_path: Path):
            url_path = str(file_path.relative_to(root_path))
            headers = {'Authorisation': secret_key}
            ct = guess_type(url_path)[0]
            if ct:
                headers['Content-Type'] = ct
            r2 = await client.post(upload_root + url_path, data=file_path.read_bytes(), headers=headers)
            print(f'    {url_path} (ct: {ct})')
            r2.raise_for_status()

        coros = [upload_file(p) for p in root_path.glob('**/*') if p.is_file()]

        print(f'Site created with root {upload_root}, uploading {len(coros)} files...')
        await asyncio.gather(*coros)
        print(f'upload complete ✓')

    return None


if __name__ == '__main__':
    assert len(sys.argv) == 2
    error = asyncio.run(main(sys.argv[1]))
    if error:
        print(error, file=sys.stderr)
        sys.exit(1)
