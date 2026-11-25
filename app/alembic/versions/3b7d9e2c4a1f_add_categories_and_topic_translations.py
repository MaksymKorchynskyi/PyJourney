"""add categories and topic translations

Revision ID: 3b7d9e2c4a1f
Revises: 65f71d8547bd
Create Date: 2026-11-25 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3b7d9e2c4a1f'
down_revision: Union[str, Sequence[str], None] = '65f71d8547bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('title_en', sa.String(length=200), nullable=False),
        sa.Column('title_uk', sa.String(length=200), nullable=False),
        sa.UniqueConstraint('slug', name='uq_categories_slug'),
    )

    op.add_column('topics', sa.Column('category_id', sa.Integer(), nullable=True))
    op.add_column('topics', sa.Column('slug', sa.String(length=150), nullable=True))
    op.add_column('topics', sa.Column('position', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('topics', sa.Column('title_en', sa.String(length=200), nullable=True))
    op.add_column('topics', sa.Column('title_uk', sa.String(length=200), nullable=True))
    op.add_column('topics', sa.Column('content_en', sa.Text(), nullable=True))
    op.add_column('topics', sa.Column('content_uk', sa.Text(), nullable=True))
    op.execute(
        "UPDATE topics SET title_en = title, title_uk = title, "
        "content_en = content, content_uk = content"
    )
    for column in ('title_en', 'title_uk'):
        op.alter_column('topics', column, existing_type=sa.String(length=200), nullable=False)
    for column in ('content_en', 'content_uk'):
        op.alter_column('topics', column, existing_type=sa.Text(), nullable=False)
    op.drop_column('topics', 'title')
    op.drop_column('topics', 'content')

    op.create_foreign_key(
        'fk_topics_category_id', 'topics', 'categories',
        ['category_id'], ['id'], ondelete='RESTRICT',
    )
    op.create_index('ix_topics_category_id', 'topics', ['category_id'])
    op.create_unique_constraint('uq_topics_slug', 'topics', ['slug'])


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('topics', sa.Column('title', sa.String(length=200), nullable=True))
    op.add_column('topics', sa.Column('content', sa.Text(), nullable=True))
    op.execute("UPDATE topics SET title = title_en, content = content_en")
    op.alter_column('topics', 'title', existing_type=sa.String(length=200), nullable=False)
    op.alter_column('topics', 'content', existing_type=sa.Text(), nullable=False)

    op.drop_constraint('uq_topics_slug', 'topics', type_='unique')
    op.drop_index('ix_topics_category_id', table_name='topics')
    op.drop_constraint('fk_topics_category_id', 'topics', type_='foreignkey')
    for column in ('content_uk', 'content_en', 'title_uk', 'title_en', 'position', 'slug', 'category_id'):
        op.drop_column('topics', column)
    op.drop_table('categories')
