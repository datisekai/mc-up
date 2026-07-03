"""Chọn adapter AI-split theo key (AD-2/AD-10). Có OPENAI_API_KEY → LLM thật; rỗng → giả lập."""
from __future__ import annotations


def get_splitter(openai_key: str = ""):
    if openai_key:
        from .content_split_openai import OpenAISplitter
        return OpenAISplitter(openai_key)
    from .content_split_mock import MockSplitter
    return MockSplitter()
