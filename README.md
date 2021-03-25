# smokeshow

[![CI](https://github.com/samuelcolvin/smokeshow/workflows/CI/badge.svg?event=push)](https://github.com/samuelcolvin/smokeshow/actions?query=event%3Apush+branch%3Amain+workflow%3ACI)
[![pypi](https://img.shields.io/pypi/v/smokeshow.svg)](https://pypi.python.org/pypi/smokeshow)
[![license](https://img.shields.io/github/license/samuelcolvin/smokeshow.svg)](https://github.com/samuelcolvin/smokeshow/blob/master/LICENSE)

<p align="center">
  <a href="https://smokeshow.helpmanual.io">
    <img src="https://smokeshow.helpmanual.io/icon.svg" alt="smokeshow" width="200" height="200">
  </a>
</p>

Deploy ephemeral websites via HTTP or [a CLI](#cli-usage).

If you need to do any of the following:
* 🚀 preview a site before launch
* 🙈 view the HTML version of coverage reports
* 👀 create a quick website to show someone something

_smokeshow_ is here to help. It lets you create a static website, 30 days after the site is created, it vanishes
like smoke in the wind.

What's great about _smokeshow_:
* 💸 It's free
* 🔑 You don't need to sign up, just create a key using the instructions below
* 💨 It's super fast around the world, _smokeshow_ uses CloudFlare's 280+ edge locations to store files meaning
  they're next to your users wherever they are

## Usage Warning

_smokeshow_ is currently free for anyone to use ([within limits](#limits)), but if it starts to cost me a 
significant amount, I might reduce the limits, or stop it being free.
Please [watch the github repo](https://github.com/samuelcolvin/smokeshow)
to get notifications of changes to the service if you're using it regularly or in an automated way.

_smokeshow_ is [open source](https://github.com/samuelcolvin/smokeshow) so if you want to modify it and/or deploy
your own instance to cloudflare workers, you can.

## Usage

Uploading a site to _smokeshow_ requires three steps:

1. Create an upload key where a numeric representation of its `sha-256` hash is less than `2 ^ 234`. 
   In other words; a simple proof of work. This key can then be used to create multiple sites.
2. Create a new site.
3. Upload one or more files to that site.

All three steps can be performed **either** [the python CLI](#cli-usage), or using [manually](#manual-usage).

### CLI Usage

The command line interface (CLI) for _smokeshow_ is written in python and available to download via 
[pypi](https://pypi.org/project/smokeshow/). Assuming you have python 3.7+ and pip installed, installing
the _smokeshow_ CLI should be as simple as:

```bash
pip install smokeshow
```

You can then get help on usage with:

```bash
smokeshow --help
```

To generate an upload key, use:

```bash
smokeshow generate-key
```

You should then set the key as an environment variable with

```bash
export SMOKESHOW_AUTH_KEY='...'
```

With that, you can upload a site with:

```bash
smokeshow upload path/to/upload
```

For more help run `smokeshow upload --help`, if you run `smokeshow upload` without either
setting the `SMOKESHOW_AUTH_KEY` environment variable or using the `--auth-key` option, _smokeshow_ will generate
a new upload key before uploading the site.

If you're having trouble with python versions and accessing the CLI, you can also run the _smokeshow_ library
module as a script via

```bash
python -m smokeshow
```

### GitHub actions & commit status integration

I build _smokeshow_ primarily to preview documentation and coverage generate with
[github actions](https://github.com/features/actions).

_smokeshow_ therefore integrates directly with github actions to add a status to commits with a link to
the newly created ephemeral site.

In addition, _smokeshow_ has custom logic to extract the total coverage figure from 
[coverage.py](https://coverage.readthedocs.io/en/coverage-5.5/) HTML coverage reports to both annotate commit status
updates and decide if the commit status is "success" or "failure".

Example of setting the commit status from a github action:

```yaml
- run: smokeshow upload cli/htmlcov
  env:
    SMOKESHOW_GITHUB_STATUS_DESCRIPTION: CLI Coverage {coverage-percentage}
    SMOKESHOW_GITHUB_COVERAGE_THRESHOLD: 50
    SMOKESHOW_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SMOKESHOW_GITHUB_PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
```

(this is taken directly from smokeshow's own CI, see
[here](https://github.com/samuelcolvin/smokeshow/blob/034e6cf416fc31a17bbb9b68c77623006d39dcd5/.github/workflows/ci.yml#L131-L136))

The following environment variables are used when setting commit statuses:

* `SMOKESHOW_GITHUB_STATUS_DESCRIPTION` (or alternatively the `--github-status-description` CLI option) set the description
  for the commit status; the string `{coverage-percentage}` has a special meaning and will be replaced by the actual
  coverage percentage if it can be extract from the root `index.html` file being uploaded, this must be set
  for _smokeshow_ to set the commit status
* `SMOKESHOW_GITHUB_COVERAGE_THRESHOLD` (or alternatively the `--github-coverage-threshold` CLI option) decide
  the "state" of the commit status update; `success` is used if either the total coverage number isn't available or it's
  above the threshold, `failure` is used if the coverage number is below this threshold
* `SMOKESHOW_GITHUB_TOKEN` this is used to authenticate the status update, more details
  [here](https://docs.github.com/en/actions/reference/authentication-in-a-workflow)
* `SMOKESHOW_GITHUB_PR_HEAD_SHA` or if it's omitted or empty `GITHUB_SHA` (which is set automatically by github actions)
  are used to decide which commit to set the status on.
  The `SMOKESHOW_GITHUB_PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}` trick shown above is required since
  github set the `GITHUB_SHA` env var to a merge commit on pull requests which isn't what you want
* `GITHUB_REPOSITORY` is set automatically by github actions, it's used to choose the repo to set the status on

### Manual Usage

You can create an upload key using the following python3.6+ script:

```python
import base64, hashlib, os

print('Searching for a key with valid hash. Hold tight, this might take a minute...')
threshold = 2 ** 234
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

Once you have your key, create a site using the following `curl` command:

```bash
curl -X POST \
  https://smokeshow.helpmanual.io/create/ \
  -H 'Authorisation:{generated-key-from-above}'
```

This should create a site and return a JSON object with details required
to upload files to that site:

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

## Limits

The following limits apply to usage of _smokeshow_:
* **50**: maximum number of sites you can create a day with a given key
* **30 MB**: maximum site size
* **25 MB**: maximum size of a file - this is a limit of [Cloudflare's KV store](https://developers.cloudflare.com/workers/platform/limits#kv-limits)
