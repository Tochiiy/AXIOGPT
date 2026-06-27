import os, requests

token = os.environ.get("VERCEL_TOKEN", "")
print(f"Token starts with: {token[:10]}...")

headers = {"Authorization": f"Bearer {token}"}
r = requests.get(
    "https://api.vercel.com/v2/user", headers=headers, timeout=15
)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:300]}")
