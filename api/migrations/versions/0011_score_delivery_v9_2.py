"""score.delivery (V9-2 bộ tín hiệu 'cách bạn nói': pauses/repetition/energy_arc)

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-05 10:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0011'
down_revision: Union[str, None] = '0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('score', schema=None) as batch_op:
        batch_op.add_column(sa.Column('delivery', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('score', schema=None) as batch_op:
        batch_op.drop_column('delivery')
