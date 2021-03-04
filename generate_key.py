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
