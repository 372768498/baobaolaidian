"""
用户路由

GET  /api/v1/users/me           — 获取当前用户信息
PUT  /api/v1/users/onboarding   — 增量更新 Onboarding 偏好（每步调用一次）
GET  /api/v1/users/personas     — 获取所有人格列表
"""
from datetime import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.persona import Persona
from app.models.call_preference import CallPreference
from app.schemas.user import UserOut, OnboardingUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    返回当前用户信息。
    preferred_persona_id 不存储在 User 行上，而是来自 CallPreference，
    因此手动构建响应字典而非依赖 ORM from_attributes。
    """
    pref_result = await db.execute(
        select(CallPreference).where(CallPreference.user_id == current_user.id)
    )
    pref = pref_result.scalar_one_or_none()

    return {
        "id": current_user.id,
        "phone": current_user.phone,
        "nickname": current_user.nickname,
        "avatar_emoji": current_user.avatar_emoji,
        "birth_year": current_user.date_of_birth.year if current_user.date_of_birth else None,
        "is_adult": current_user.is_adult,
        "onboarding_done": current_user.onboarding_done,
        "preferred_persona_id": str(pref.persona_id) if pref and pref.persona_id else None,
        "call_time_start": pref.window_start.strftime("%H:%M") if pref and pref.window_start else None,
        "call_time_end": pref.window_end.strftime("%H:%M") if pref and pref.window_end else None,
        "created_at": current_user.created_at,
    }


@router.put("/onboarding")
async def complete_onboarding(
    body: OnboardingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    增量更新 Onboarding 偏好 — 每一步只传本步的字段。
    Step 2: avatar_emoji
    Step 3: preferred_persona_id
    Step 4: call_time_start / call_time_end
    Step 5: onboarding_done = true
    """
    # ── 更新 User 行上的字段 ───────────────────────────────────────
    if body.nickname is not None:
        current_user.nickname = body.nickname
    if body.avatar_emoji is not None:
        current_user.avatar_emoji = body.avatar_emoji
    if body.onboarding_done is not None:
        current_user.onboarding_done = body.onboarding_done

    # ── 更新 CallPreference（如有相关字段）────────────────────────
    needs_pref = (
        body.preferred_persona_id is not None
        or body.call_time_start is not None
        or body.call_time_end is not None
    )
    if needs_pref:
        pref_result = await db.execute(
            select(CallPreference).where(CallPreference.user_id == current_user.id)
        )
        pref = pref_result.scalar_one_or_none()
        if pref is None:
            pref = CallPreference(user_id=current_user.id)
            db.add(pref)

        if body.preferred_persona_id is not None:
            # 验证人格存在
            persona_result = await db.execute(
                select(Persona).where(Persona.id == body.preferred_persona_id)
            )
            if not persona_result.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="人格不存在")
            pref.persona_id = body.preferred_persona_id

        if body.call_time_start is not None:
            h, m = map(int, body.call_time_start.split(":"))
            pref.window_start = time(h, m)

        if body.call_time_end is not None:
            h, m = map(int, body.call_time_end.split(":"))
            pref.window_end = time(h, m)

        pref.is_active = True

    if body.onboarding_done:
        pref_result = await db.execute(
            select(CallPreference).where(CallPreference.user_id == current_user.id)
        )
        pref = pref_result.scalar_one_or_none()
        missing_fields: list[str] = []
        if not current_user.nickname:
            missing_fields.append("nickname")
        if not current_user.avatar_emoji:
            missing_fields.append("avatar_emoji")
        if not pref or not pref.persona_id:
            missing_fields.append("preferred_persona_id")
        if not pref or not pref.window_start or not pref.window_end:
            missing_fields.append("call_time_window")
        if missing_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Onboarding 信息不完整: {', '.join(missing_fields)}",
            )

    await db.commit()
    return {"message": "ok"}


@router.get("/personas")
async def list_personas(db: AsyncSession = Depends(get_db)):
    """
    返回所有可用人格（无需登录）。
    字段名称与移动端 PersonaOut 接口对齐：
      description → short_bio
      type        → voice_style
    """
    result = await db.execute(select(Persona))
    personas = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "avatar_emoji": p.avatar_emoji,
            "short_bio": p.description,
            "personality_tags": p.personality_tags or [],
            "voice_style": p.type,
        }
        for p in personas
    ]
