"""
D-ID - List Available Avatars
Ye script confirm karti hai ki API key sahi kaam kar rahi hai,
aur available avatars ki list deती hai.
"""

import os
import base64
import requests
from dotenv import load_dotenv

load_dotenv()

raw_key = os.getenv("DID_API_KEY")
encoded_key = base64.b64encode(raw_key.encode()).decode()

headers = {
    "Authorization": f"Basic {encoded_key}",
}

response = requests.get("https://api.d-id.com/expressives/avatars", headers=headers)

print(f"Status Code: {response.status_code}")
print(response.json())