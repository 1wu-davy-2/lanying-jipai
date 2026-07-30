from pydantic import BaseModel


class ScriptCategoryResponse(BaseModel):
    id: int
    code: str
    name: str
    description: str
    is_restricted: bool


class ScriptDocumentSummary(BaseModel):
    id: int
    title: str
    source_key: str
    source_filename: str
    section_count: int
    copy_block_count: int
    category: ScriptCategoryResponse


class ScriptDocumentDetail(ScriptDocumentSummary):
    markdown_body: str


class ScriptDocumentPage(BaseModel):
    items: list[ScriptDocumentSummary]
    total: int
    page: int
    page_size: int
