import os, json
import requests

token = os.environ.get("GITHUB_TOKEN", "")
if not token:
    print("No GITHUB_TOKEN")
    exit(1)

proxies = {
    "http": "http://14a0fa8168773:efed560f55@212.69.10.161:12323",
    "https": "http://14a0fa8168773:efed560f55@212.69.10.161:12323",
}
headers = {"Authorization": f"token {token}", "Content-Type": "application/json"}

# Step 1: get repo node_id
query = """
query {
  viewer {
    id
    pinnedItems(first: 10) {
      nodes {
        ... on Repository {
          id
          nameWithOwner
        }
      }
    }
    repository(name: "AXIOGPT") {
      id
      nameWithOwner
    }
  }
}
"""

r = requests.post(
    "https://api.github.com/graphql",
    json={"query": query},
    headers=headers,
    proxies=proxies,
    timeout=15,
)
data = r.json()
if "errors" in data:
    print("Error:", json.dumps(data["errors"], indent=2))
    exit(1)

viewer = data["data"]["viewer"]
user_id = viewer["id"]
repo = viewer["repository"]
if not repo:
    print("Repo 'AXIOGPT' not found under your account")
    exit(1)

repo_id = repo["id"]
current_pinned = [n["id"] for n in viewer["pinnedItems"]["nodes"]]
print(f"User ID: {user_id}")
print(f"Repo ID: {repo_id} ({repo['nameWithOwner']})")
print(f"Currently pinned: {[n['nameWithOwner'] for n in viewer['pinnedItems']['nodes']]}")

# Step 2: Pin the repo
mutation = """
mutation($repoId: ID!) {
  pinProfileRepo(input: {repositoryId: $repoId}) {
    clientMutationId
  }
}
"""

r2 = requests.post(
    "https://api.github.com/graphql",
    json={"query": mutation, "variables": {"repoId": repo_id}},
    headers=headers,
    proxies=proxies,
    timeout=15,
)
result = r2.json()
if "errors" in result:
    print("Pin error:", json.dumps(result["errors"], indent=2))
else:
    print("AXIOGPT pinned successfully to your profile!")
