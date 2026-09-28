-- Executado só na primeira vez que o container do PostgreSQL sobe.
-- Cria o banco separado usado pelos testes automatizados (npm test).
CREATE DATABASE trabalhae_test OWNER trabalhae;
