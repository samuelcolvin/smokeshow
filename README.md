# smokeshow

[![CI](https://github.com/samuelcolvin/smokeshow/workflows/CI/badge.svg?event=push)](https://github.com/samuelcolvin/smokeshow/actions?query=event%3Apush+branch%3Amain+workflow%3ACI)

Deploy ephemeral websites via HTTP.

If you need to do any of the following:
* 🚀 preview a site before launch
* 🙈 view the HTML version of coverage reports
* 👀 create a quick website to show someone something

_smokeshow_ is here to help, it lets you use HTTP to upload files to create a static website.
30 days after that site is created, it vanishes.

A few advantages:
* 💸 It's free
* 🔑 You don't need to sign up, just create a key using the script below
* 💨 It's super fast around the world, _smokeshow_ uses CloudFlare's 280+ edge locations to store files meaning
  they're next to your users

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
_(This script should take between a few seconds and a minute to generate a valid key)_

Once you have your key, you can create a site using the following `curl` command:

```bash
curl -X POST \
  https://smokeshow.helpmanual.io/create/ \
  -H 'Authorisation:{generated-key-from-above}'
```
This should create a site and return a JSON object with details required
to upload files to the site:

```json
{
  "message": "New site created successfully",
  "secret_key": "... secret upload key ...",
  "site_creation": "2021-03-13T18:36:44.419Z",
  "site_expiration": "2021-04-12T18:36:44.419Z",
  "sites_created_24h": 0,
  "upload_expiration": "2021-03-13T19:36:44.419Z",
  "url": "https://smokeshow.helpmanual.io/... 20 char random string .../"
}
```

You can then upload a file, again using `curl` (here `RESPONSE_JSON` refers to the response above):

```bash
curl -X POST \
  '{RESPONSE_JSON.url}path-to-upload.html' \
  -H 'Authorisation:{RESPONSE_JSON.secret_key}' \
  -H 'Content-Type:text/html' \
  --data-binary @file-to-upload.html
```

## Features

_smokeshow_ doesn't have too many special features, most things are designed to be
boringly predictable, But a few things warrant explanation.

### Content Type

The `Content-Type` header in responses is not inferred by _smokeshow_, instead it's taken from the same
header in the upload request.

### Path Matches

The following path equivalence is supported:
* `/path/to/file/` should return `/path/to/file/index.html` or `/path/to/file.html` or 
  (less canonically) `/path/to/file/index.json`
* trailing slashes don't matter

### Referrer Redirects

_smokeshow_ deploys sites at a random subdirectory (e.g. `/3y4x0n6a200u2n6m316j/`) this works fine, but could occasionally
lead to problems with sites that assume they will be deployed at root (`/`), we work round that problem by
inspecting the `Referer` header and redirecting to the intended page.

**Example** of how this works:
* 🔗 The page `https://smokeshow.helpmanual.io/3y4x0n6a200u2n6m316j/foobar/` has a link to `/another/` \
  which of course we want to resolve to `https://smokeshow.helpmanual.io/3y4x0n6a200u2n6m316j/another/`
* 👆 When a user clicks on the link, the browser loads `https://smokeshow.helpmanual.io/another/`
* 🎯 _smokeshow_ catches this request, inspects the `Referer` headers and spots `/3y4x0n6a200u2n6m316j/foobar/`
* 🤔 _smokeshow_ calculates that the request should be to `https://smokeshow.helpmanual.io/3y4x0n6a200u2n6m316j/another/`
* ↪️ _smokeshow_ returns a `307` redirect to that page
* 🏗️ the browser loads that page
* 😊 user is happy

## CLI usage

TODO...

## Limits

The following limits apply to usage of _smokeshow_:
* **50**: maximum number of sites you can create a day with a given key
* **30 MB**: maximum site size
* **25 MB**: maximum size of a file - this is a limit of [Cloudflare's KV store](https://developers.cloudflare.com/workers/platform/limits#kv-limits)

**Notice:** _smokeshow_ is currently free for anyone to use, but if it starts to cost me a significant amount, I
might reduce the limits, or stop it being free. Please [watch the github repo](https://github.com/samuelcolvin/smokeshow)
to get notifications of changes to the service if you're using it regularly.
