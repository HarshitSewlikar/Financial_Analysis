"""Let a primary-key type change proceed when a OneToOne unique constraint references it.

mssql-django 2.0.0 drops indexes before altering the referencing column, but a
SQL Server unique constraint is not marked as an index, so token_blacklist.0008
fails. Drop those constraints first and create them again afterwards.
"""

from django.db.backends.base.schema import _related_non_m2m_objects
from mssql.schema import DatabaseSchemaEditor

_original_alter_field = DatabaseSchemaEditor._alter_field


def _alter_field(
    self,
    model,
    old_field,
    new_field,
    old_type,
    new_type,
    old_db_params,
    new_db_params,
    strict=False,
):
    restore = []
    if old_field.primary_key and new_field.primary_key and old_type != new_type:
        for _old_rel, new_rel in _related_non_m2m_objects(old_field, new_field):
            field = new_rel.field
            if not field.unique or field.primary_key:
                continue
            related = new_rel.related_model
            names = self._db_table_constraint_names(
                related._meta.db_table,
                [field.column],
                unique_constraint=True,
            )
            for name in names:
                self.execute(
                    self._delete_constraint_sql(
                        self.sql_delete_constraint, related, name
                    )
                )
            restore.append((related, field))

    result = _original_alter_field(
        self,
        model,
        old_field,
        new_field,
        old_type,
        new_type,
        old_db_params,
        new_db_params,
        strict,
    )
    for related, field in restore:
        if field.null:
            statement = self._create_index_sql(
                related,
                [field],
                sql=self.sql_create_unique_null,
                suffix="_uniq",
            )
        else:
            statement = self._create_unique_sql(related, [field])
        if statement is not None:
            self.execute(statement)
    return result


if not getattr(DatabaseSchemaEditor._alter_field, "_finapp_pk_unique_fix", False):
    _alter_field._finapp_pk_unique_fix = True
    DatabaseSchemaEditor._alter_field = _alter_field
