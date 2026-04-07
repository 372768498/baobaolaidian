"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-04-03

创建所有初始表：
  users, personas, call_preferences,
  conversation_sessions, conversation_messages,
  memory_items, risk_events, post_call_recaps
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(20), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("nickname", sa.String(30), nullable=False),
        sa.Column("date_of_birth", sa.Date, nullable=True),
        sa.Column("is_adult", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("onboarding_done", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_phone", "users", ["phone"])

    # ── personas ───────────────────────────────────────────────────────────────
    op.create_table(
        "personas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(30), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("system_prompt_template", sa.Text, nullable=False),
        sa.Column("voice_id", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ── call_preferences ───────────────────────────────────────────────────────
    op.create_table(
        "call_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("persona_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("personas.id"), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False, server_default="sleep"),
        sa.Column("window_start", sa.Time, nullable=False, server_default="21:00"),
        sa.Column("window_end", sa.Time, nullable=False, server_default="23:00"),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="Asia/Shanghai"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
    )
    op.create_index("ix_call_preferences_user_id", "call_preferences", ["user_id"])

    # ── conversation_sessions ──────────────────────────────────────────────────
    op.create_table(
        "conversation_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("persona_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("personas.id"), nullable=False),
        sa.Column("trigger_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("ended_at", sa.DateTime, nullable=True),
        sa.Column("duration_secs", sa.Integer, nullable=True),
        sa.Column("orchestration_phase", sa.String(30), nullable=True),
        sa.Column("risk_flagged", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_sessions_user_id", "conversation_sessions", ["user_id"])
    op.create_index("ix_sessions_status", "conversation_sessions", ["status"])
    op.create_index("ix_sessions_created_at", "conversation_sessions", ["created_at"])

    # ── conversation_messages ──────────────────────────────────────────────────
    op.create_table(
        "conversation_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("conversation_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("phase", sa.String(30), nullable=True),
        sa.Column("timestamp", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_messages_session_id", "conversation_messages", ["session_id"])

    # ── memory_items ───────────────────────────────────────────────────────────
    op.create_table(
        "memory_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("source_session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("conversation_sessions.id"), nullable=True),
        sa.Column("confidence", sa.Float, nullable=False, server_default="1.0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_memory_items_user_id", "memory_items", ["user_id"])

    # ── risk_events ────────────────────────────────────────────────────────────
    op.create_table(
        "risk_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("conversation_sessions.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("risk_type", sa.String(30), nullable=False),
        sa.Column("trigger_text", sa.Text, nullable=True),
        sa.Column("action_taken", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # ── post_call_recaps ───────────────────────────────────────────────────────
    op.create_table(
        "post_call_recaps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("conversation_sessions.id"), nullable=False, unique=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("summary_text", sa.Text, nullable=False),
        sa.Column("micro_action", sa.Text, nullable=False),
        sa.Column("followup_point", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("post_call_recaps")
    op.drop_table("risk_events")
    op.drop_table("memory_items")
    op.drop_table("conversation_messages")
    op.drop_table("conversation_sessions")
    op.drop_table("call_preferences")
    op.drop_table("personas")
    op.drop_table("users")
