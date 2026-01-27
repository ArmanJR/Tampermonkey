#!/usr/bin/env python3
# /// script
# requires-python = ">=3.8"
# dependencies = ["beautifulsoup4"]
# ///
"""Clean HTML by removing head, svg, script, style tags and emojis."""

import re
import sys
from bs4 import BeautifulSoup


def remove_emojis(text):
    """Remove emoji characters from text."""
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags
        "\U00002702-\U000027B0"  # dingbats
        "\U000024C2-\U0001F251"  # enclosed characters
        "\U0001F900-\U0001F9FF"  # supplemental symbols
        "\U0001FA00-\U0001FA6F"  # chess symbols
        "\U0001FA70-\U0001FAFF"  # symbols extended
        "\U00002600-\U000026FF"  # misc symbols
        "\U00002300-\U000023FF"  # misc technical
        "]+",
        flags=re.UNICODE,
    )
    return emoji_pattern.sub("", text)


def clean_html(input_file, output_file):
    """Clean HTML file by removing specified elements and emojis."""
    with open(input_file, "r", encoding="utf-8") as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, "html.parser")

    # Remove head, svg, script, and style tags
    for tag in soup.find_all(["head", "svg", "script", "style"]):
        tag.decompose()

    # Convert back to string and remove emojis
    cleaned_html = str(soup)
    cleaned_html = remove_emojis(cleaned_html)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(cleaned_html)

    print(f"Cleaned HTML written to {output_file}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python clean_html.py <input.html> <output.html>")
        sys.exit(1)

    clean_html(sys.argv[1], sys.argv[2])
