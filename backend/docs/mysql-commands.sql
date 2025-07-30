create database if not exists gardenOfficedb;

create user if not exists dsw@'%' identified by 'dsw';
grant all on gardenOfficedb.* to dsw@'%';