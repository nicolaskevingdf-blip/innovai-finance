-- Estornos: novo tipo de movimentação. Separado da migração seguinte porque o
-- Postgres não permite usar um valor de enum na mesma transação em que foi criado.
-- Rollback: valores de enum não podem ser removidos; o valor sem uso é inofensivo.
alter type tx_type add value if not exists 'refund';
