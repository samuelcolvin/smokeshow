# Smokeshow CLI

[![CI](https://github.com/samuelcolvin/hightmp/workflows/CI/badge.svg?event=push)](https://github.com/samuelcolvin/hightmp/actions?query=event%3Apush+branch%3Amain+workflow%3ACI)

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
