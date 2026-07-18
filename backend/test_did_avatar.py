"""
D-ID Avatar - Generate a Test Video
"""

import os
import base64
import time
import requests
from dotenv import load_dotenv

load_dotenv()

raw_key = os.getenv("DID_API_KEY")
encoded_key = base64.b64encode(raw_key.encode()).decode()
headers = {
    "Authorization": f"Basic {encoded_key}",
    "Content-Type": "application/json",
}


def create_video(text: str):
    payload = {
        "avatar_id": "public_aria@avt_BS7cH6",
        "sentiment_id": "snt_CdkbPj",
        "script": {
            "type": "text",
            "input": f'<speak><prosody rate="85%">{text}</prosody></speak>',
            "ssml": True,
        },
    }
    response = requests.post("https://api.d-id.com/expressives", json=payload, headers=headers)
    response.raise_for_status()
    return response.json()["id"]


def check_status(video_id: str):
    url = f"https://api.d-id.com/expressives/{video_id}"
    while True:
        response = requests.get(url, headers=headers)
        data = response.json()
        status = data.get("status")
        print(f"Status: {status}")
        if status == "done":
            return data
        elif status == "error":
            raise Exception(f"Failed: {data}")
        time.sleep(3)


if __name__ == "__main__":
    video_id = create_video("Namaste! Main Umang hoon, aapka AI saathi.")
    print(f"Video ID: {video_id}")
    result = check_status(video_id)
    print(f"\nVideo URL: {result.get('result_url')}")