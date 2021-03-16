from pathlib import Path
from setuptools import setup
from importlib.machinery import SourceFileLoader

description = 'Deploy ephemeral websites.'

THIS_DIR = Path(__file__).resolve().parent
try:
    long_description = (THIS_DIR / 'README.md').read_text()
except FileNotFoundError:
    long_description = description

# avoid loading the package before requirements are installed:
version = SourceFileLoader('version', 'smokeshow/version.py').load_module()

setup(
    name='smokeshow',
    version=version.VERSION,
    description=description,
    long_description=long_description,
    long_description_content_type='text/markdown',
    author='Samuel Colvin',
    author_email='s@muelcolvin.com',
    url='https://github.com/samuelcolvin/smokeshow',
    license='MIT',
    package_data={'smokeshow': ['py.typed']},
    python_requires='>=3.7',
    packages=['smokeshow'],
    zip_safe=False,
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3 :: Only',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Intended Audience :: Developers',
        'Intended Audience :: Information Technology',
        'Intended Audience :: System Administrators',
        'License :: OSI Approved :: MIT License',
        'Operating System :: Unix',
        'Operating System :: POSIX :: Linux',
        'Environment :: Console',
        'Environment :: MacOS X',
        'Environment :: Web Environment',
        'Topic :: Internet :: WWW/HTTP',
        'Topic :: Internet :: WWW/HTTP :: Site Management',
        'Topic :: Software Development :: Libraries :: Python Modules',
        'Topic :: Internet',
    ],
    install_requires=[
        'httpx>=0.17',
    ],
)
