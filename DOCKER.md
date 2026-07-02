# Rodando em Docker

Sobe a **aplicação Next.js** e o **PostgreSQL** em containers via Docker Compose.
A conexão é configurada por variáveis de ambiente (`.env`); nada sensível fica no
Dockerfile/compose. As **migrations não rodam sozinhas** — você as aplica manualmente.

## Stack

- **Next.js 16** (App Router) + **React 19**, imagem Node 20 LTS, build multi-stage `standalone`.
- **Prisma 7** com driver adapter `pg` (lê `DATABASE_URL` em runtime).
- **PostgreSQL 17** em container (mesma major da produção/Neon), com volume persistente `pgdata`.

## 1. Configurar o `.env`

Use o exemplo como base (sem credenciais reais) e ajuste:

```bash
cp .env.docker.example .env
```

Variáveis principais:
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — credenciais do container do banco.
- `DATABASE_URL` — conexão da **aplicação**, usando o host `db` (nome do serviço no compose):
  `postgresql://USUARIO:SENHA@db:5432/BANCO?sslmode=disable`
  (`sslmode=disable` porque o Postgres em container não usa TLS).

## 2. Subir o banco e aplicar o schema (migrations)

```powershell
# 2.1 Sobe só o banco
docker compose up -d db

# 2.2 Aplica as migrations a partir da SUA máquina, apontando para localhost
#     (o banco está publicado em localhost:5432). Use o MESMO usuário/senha/banco do .env.
$env:DATABASE_URL = "postgresql://USUARIO:SENHA@localhost:5432/BANCO?sslmode=disable"
npx prisma migrate deploy
```

> Por que `localhost` aqui e `db` no `.env`? Dentro do compose, a aplicação fala com o
> banco pelo nome do serviço (`db`). Da sua máquina (host), o banco está em `localhost:5432`.
> O comando acima sobrepõe a `DATABASE_URL` só para esse `migrate` — o `.env` continua com `db`.

## 3. Subir a aplicação

```powershell
docker compose up -d
```

A aplicação fica em **http://localhost:3000**.

## Como testar se subiu corretamente

1. **Containers no ar:**
   ```powershell
   docker compose ps
   ```
   `db` deve estar `healthy` e `app` `running` (estável, sem reiniciar em loop).

2. **Logs da aplicação:**
   ```powershell
   docker compose logs -f app
   ```
   Deve mostrar o servidor pronto em `0.0.0.0:3000`, sem erro de conexão.

3. **Acesso:** abra `http://localhost:3000`. Se o **Dashboard carregar com dados**
   (ou vazio, mas sem erro), a conexão com o banco está OK.

## Comandos do dia a dia

```powershell
docker compose logs -f app        # logs da app
docker compose logs -f db         # logs do banco
docker compose down               # parar e remover os containers (mantém o volume/dados)
docker compose down -v            # parar e APAGAR os dados do banco (volume pgdata)
docker compose up -d --build      # rebuild da app + subir
```

## Dados e backup

Os dados do Postgres ficam no volume nomeado `pgdata` e **sobrevivem** a `docker compose down`.
Só são apagados com `docker compose down -v`. Backup rápido:

```powershell
docker compose exec db pg_dump -U USUARIO BANCO > backup.sql
```

## Publicação no Proxmox (futuro)

A imagem não embute segredos — tudo vem do `.env`. No Proxmox, leve o repositório
(ou a imagem) + um `.env` e rode os mesmos passos. Se preferir um banco gerenciado
externo em vez do container, basta apontar a `DATABASE_URL` para ele e remover o
serviço `db` do compose.
