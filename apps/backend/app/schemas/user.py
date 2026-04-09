"""用户相关 schema"""
import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator


class UserRegister(BaseModel):
    phone: str
    password: str
    nickname: str
    birth_year: int          # 仅收集出生年份，后端存为 date(birth_year, 1, 1)

    @field_validator("phone")
    @classmethod
    def phone_must_be_valid(cls, v: str) -> str:
        digits = v.replace("+", "").replace("-", "").replace(" ", "")
        if not digits.isdigit() or len(digits) < 8:
            raise ValueError("手机号格式不正确")
        return v

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("密码至少 8 位")
        return v

    @field_validator("birth_year")
    @classmethod
    def birth_year_must_be_valid(cls, v: int) -> int:
        if v < 1900 or v > 2100:
            raise ValueError("出生年份不合法")
        return v


class UserLogin(BaseModel):
    phone: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    """返回给移动端的用户信息 — 与 api.ts 的 UserOut 接口严格对齐"""
    id: uuid.UUID
    phone: str
    nickname: str
    avatar_emoji: str = "🌙"
    birth_year: int | None = None            # 由 date_of_birth.year 计算得到
    is_adult: bool
    onboarding_done: bool
    preferred_persona_id: str | None = None  # 来自 CallPreference，由路由层注入
    call_time_start: str | None = None
    call_time_end: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class OnboardingUpdate(BaseModel):
    """
    Onboarding 每一步的增量更新 — 所有字段均可选。
    移动端每步只发送本步的字段：
      Step 2: avatar_emoji
      Step 3: preferred_persona_id
      Step 4: call_time_start / call_time_end
      Step 5: onboarding_done = true
    """
    nickname: str | None = None
    avatar_emoji: str | None = None
    preferred_persona_id: uuid.UUID | None = None
    call_time_start: str | None = None       # "HH:MM"
    call_time_end: str | None = None         # "HH:MM"
    onboarding_done: bool | None = None
