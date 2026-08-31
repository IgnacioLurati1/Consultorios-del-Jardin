-- ============================================================
-- Reset de la base de datos
-- ============================================================
-- Necesario después del refactor que eliminó la entidad Diagnostic:
-- los turnos ahora guardan al paciente y las observaciones adentro,
-- y desaparecieron las columnas `type` (appointment) y `allowed_type` (schedule).
--
-- No se migran datos: se descarta todo el contenido viejo.
--
-- Uso:
--   mysql -u root -p < backend/docs/reset-db.sql
--
-- Después levantar el backend con NODE_ENV != production:
--   npm run start:dev
-- syncSchema() (src/shared/db/orm.ts) recrea el esquema completo a partir
-- de las entidades, así que no hace falta escribir los CREATE TABLE a mano.
-- ============================================================

drop database if exists gardenOfficedb;
create database gardenOfficedb;

-- El usuario de la app se crea una sola vez (ver mysql-commands.sql)
create user if not exists dsw@'%' identified by 'dsw';
grant all on gardenOfficedb.* to dsw@'%';
flush privileges;
