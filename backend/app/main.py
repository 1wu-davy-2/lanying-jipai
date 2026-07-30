import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import Settings, uploads_directory
from app.routers.admin import router as admin_router
from app.routers.app_releases import router as app_releases_router
from app.routers.auth import router as auth_router
from app.routers.health import router as health_router
from app.routers.orders import router as orders_router
from app.routers.uploads import router as uploads_router
from app.routers.users import admin_router as admin_users_router
from app.routers.users import router as users_router
from app.routers.wallets import admin_router as admin_wallets_router
from app.routers.wallets import router as wallets_router
from app.routers.withdrawals import admin_router as admin_withdrawals_router
from app.routers.withdrawals import router as withdrawals_router

app = FastAPI(docs_url=None if os.getenv("APP_ENV") == "production" else "/docs", redoc_url=None if os.getenv("APP_ENV") == "production" else "/redoc")

cors_origins = [origin.strip() for origin in Settings().cors_origins.split(",") if origin.strip()]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

_ERROR_CODES = {400: 1001, 401: 1002, 403: 1003, 404: 1004, 409: 1005}


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        code = exc.detail.get("code", _ERROR_CODES.get(exc.status_code, exc.status_code))
        message = exc.detail.get("message", "请求失败")
    else:
        code = _ERROR_CODES.get(exc.status_code, exc.status_code)
        message = exc.detail if isinstance(exc.detail, str) else "请求失败"
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": code, "message": message, "data": None},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"code": 1001, "message": "请求参数不合法", "data": None})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"code": 500, "message": "服务器内部错误", "data": None})

app.include_router(health_router, prefix="/api")
app.include_router(app_releases_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(admin_users_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")
app.include_router(wallets_router, prefix="/api")
app.include_router(admin_wallets_router, prefix="/api")
app.include_router(withdrawals_router, prefix="/api")
app.include_router(admin_withdrawals_router, prefix="/api")

uploads_path = uploads_directory()
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")
