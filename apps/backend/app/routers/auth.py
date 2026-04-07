"""
认证路由

POST /api/v1/auth/register  — 注册
POST /api/v1/auth/login     — 登录（返回 JWT）
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, TokenResponse
from app.auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    # 检查手机号是否已注册
    existing = await db.execute(select(User).where(User.phone == body.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="手机号已注册")

    # 验证成年（仅比较出生年份，保守估计：当年未过生日也算）
    today = date.today()
    is_adult = (today.year - body.birth_year) >= 18

    user = User(
        phone=body.phone,
        hashed_password=hash_password(body.password),
        nickname=body.nickname,
        date_of_birth=date(body.birth_year, 1, 1),   # 存为 1 月 1 日占位
        is_adult=is_adult,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone == body.phone))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码错误",
        )

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)
