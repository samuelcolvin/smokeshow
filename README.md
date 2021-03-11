# hightmp

**Work in progress!** Not yet ready for use.

Deploy temporary websites via HTTP.

If you need to do any of the following:
* preview a site before launch
* view the HTML version of coverage reports
* create a quick website to show someone something

_hightmp_ is here to help, it lets you use HTTP to upload files to create a static website.
30 days after that site is created, it vanishes.

A few advantages:
* It's free
* You don't need to sign up, just create a key using the script below
* It's super fast around the world, _hightmp_ uses CloudFlare's 280+ edge servers to store files meaning
  their next to your users

## Usage

**Notice**: Please see the warning about usage limits [below](#limits) before you automate usage of this service.

All you need to do is create an upload key where a numeric representation of its `sha-256`
hash is less than `2 ^ 233`. In other words; a simple proof of work.

You can create a key using the following python3.6+ script:

```python
import base64, hashlib, os

print('Searching for a key with valid hash. Hold tight, this might take a minute...')
threshold = 2 ** 233
attempts = 0
while True:
    attempts += 1
    seed = os.urandom(50)
    h = int.from_bytes(hashlib.sha256(seed).digest(), 'big')
    if attempts % 100_000 == 0:
        print('.', end='', flush=True)
    if h < threshold:
        key = base64.b64encode(seed).decode().rstrip('=')
        print(f'\nSuccess! Key found after {attempts:,} attempts:\n\n    {key}\n')
        break
```
(This script should take between a few seconds and a minute to generate a valid key)

Once you have your key, you can create a site using the following `curl` command:

```bash
curl -X POST \
  -H 'Authorisation:{generated-key}' \
  https://hightmp.samuelcolvin.workers.dev/create/
```
This should create a site and return a JSON object with details required
to upload files to the site.

You can then upload a file, again using `curl` 
(here `RESPONSE_JSON` refers to the response from the above requset):

```bash
curl -X POST \
   -H 'Authorisation:{RESPONSE_JSON.secret_key}' \
   -H 'Content-Type:text/html' \
  '{RESPONSE_JSON.url}path-to-upload.html' \
   --data-binary @file-to-upload.html
```

## Features

_hightmp_ doesn't have too many special features, most things are designed to be
boringly predictable, But a few things warrant explanation.

### Content Type

The `Content-Type` header in responses is not inferred by _hightmp_, instead it's taken from the same
header in the upload request.

### Path Matches

The following path equivalence is supported:
* `/path/to/file/` should return `/path/to/file/index.html` or `/path/to/file.html` or 
  (less canonically) `/path/to/file/index.json`
* trailing slashes don't matter

### Referrer Redirects

_hightmp_ deploys sites at a random subdirectory (e.g. `/3y4x0n6a200u2n6m316j/`) this works fine, but occasionally
leads to problems with sites that assume they will be deployed at root (`/`), we work round that problem by
inspecting the `Referer` header and redirecting to the intended page.

**Example**:
* The page `https://hightmp.samuelcolvin.workers.dev/3y4x0n6a200u2n6m316j/foobar/` has a link to `/another/` \
  which we want to resolve to `https://hightmp.samuelcolvin.workers.dev/3y4x0n6a200u2n6m316j/another/`
* When a user clicks on the link, the browser loads `https://hightmp.samuelcolvin.workers.dev/another/`
* _hightmp_ catches this request, inspects the `Referer` headers and spots `/3y4x0n6a200u2n6m316j/foobar/`
* _hightmp_ calculates that the request should be to `https://hightmp.samuelcolvin.workers.dev/3y4x0n6a200u2n6m316j/another/`
* _hightmp_ returns a `307` redirect to that page
* the browser loads the correct page

## CLI usage

TODO...

## Limits

The following limits apply to usage of hightmp:
* **50**: maximum number of sites you can create a day with a given key
* **30md**: maximum site size
* **25md**: maximum size of a file - this a limit of [Cloudflare's KV store](https://developers.cloudflare.com/workers/platform/limits#kv-limits)

**Notice:** hightmp is currently free for anyone to use, but if it starts to cost me a significant amount I
might reduce the limits, or stop it being free. Please [watch the github repo](https://github.com/samuelcolvin/hightmp)
to get notifications of changes to the service.
