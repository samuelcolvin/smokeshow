# Smokeshow CLI

[![CI](https://github.com/samuelcolvin/hightmp/workflows/CI/badge.svg?event=push)](https://github.com/samuelcolvin/hightmp/actions?query=event%3Apush+branch%3Amain+workflow%3ACI)
[![license](https://img.shields.io/github/license/samuelcolvin/smokeshow.svg)](https://github.com/samuelcolvin/smokeshow/blob/master/LICENSE)

CLI to deploy ephemeral websites, see [smokeshow.helpmanual.io](https://smokeshow.helpmanual.io) for more information.

## Installation

```bash
pip install smokeshow
```

## Usage

To get help on usage, run:

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
[here](https://github.com/samuelcolvin/smokeshow/blob/2985a676ff057394e032a4713c5d8c572bb40744/.github/workflows/ci.yml#L131-L136))

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
* `SMOKESHOW_GITHUB_CONTEXT` suffix for github status context
* `GITHUB_REPOSITORY` is set automatically by github actions, it's used to choose the repo to set the status on
