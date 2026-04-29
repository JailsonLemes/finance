# FinCouple — Controle Financeiro do Casal

Sistema web completo de controle financeiro para casais, com dashboard, contas a pagar, investimentos, metas e planejamento.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| Backend | Node.js + Express + Prisma ORM |
| Banco | PostgreSQL 16 |
| Auth | JWT (30 dias) |
| Deploy | Docker + Docker Compose |

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) instalado
- [Docker Compose](https://docs.docker.com/compose/) v2+

---

## Iniciar com Docker (recomendado)

```bash
# 1. Clone ou entre na pasta do projeto
cd financial-control

# 2. Suba todos os serviços
docker compose up --build -d

# 3. Aguarde ~30 segundos e acesse
# Frontend: http://localhost
# Backend API: http://localhost:3001
# Health check: http://localhost:3001/health
```

### Usuário demo (opcional)

```bash
docker compose exec backend npm run seed
# Email: demo@fincouple.com | Senha: demo123
```

---

## Desenvolvimento local (sem Docker)

### Backend

```bash
cd backend
npm install

# Crie o arquivo .env
cp .env.example .env
# Edite DATABASE_URL com sua conexão PostgreSQL

npx prisma migrate dev --name init
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Acesse: http://localhost:5173
```

---

## Variáveis de ambiente

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://fincouple:fincouple123@localhost:5432/fincouple
JWT_SECRET=supersecretjwtkey2024fincouple
PORT=3001
NODE_ENV=development
```

---

## Funcionalidades

### Dashboard
- Saldo do mês, receitas, despesas, contas pendentes
- Indicador de saúde financeira (0–100%)
- Gráfico de pizza — despesas por categoria
- Gráfico de linha — evolução dos últimos 6 meses
- Alerta de contas atrasadas

### Receitas
- CRUD completo com filtro por mês
- Tipos: fixa / variável
- Por pessoa (parceiro 1, parceiro 2, ambos)
- Exportação para Excel

### Despesas
- CRUD completo com filtro por mês
- Integração com cartões de crédito
- Gráfico por categoria em tempo real
- Exportação para Excel

### Contas a Pagar ⭐
- **Checkbox interativo** — clique para marcar/desmarcar pagamento
- Status automático: 🟢 Pago · 🟡 Pendente · 🔴 Atrasado
- Registro automático da data de pagamento
- Filtro por status + exportação

### Cartões de Crédito
- Controle visual de faturas
- Parcelas (adicionar parcelamentos)
- Barra de limite disponível

### Investimentos
- Tipos: renda fixa, ações, FII, cripto, poupança
- Cálculo de rentabilidade
- Distribuição em gráfico de pizza

### Metas Financeiras
- Barra de progresso visual por meta
- Botão "Contribuir" para adicionar valores
- Cores personalizadas

### Planejamento
- Orçamento previsto vs realizado por categoria
- Alertas de estouro de orçamento
- Gráfico de barras comparativo

### UX/UI
- Modo escuro / claro (salvo no navegador)
- Design responsivo (mobile + desktop)
- Navegação lateral com ícones
- Filtro de mês com setas

---

## Estrutura do projeto

```
financial-control/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma      # Modelos do banco
│   │   └── seed.js            # Dados demo
│   └── src/
│       ├── index.js
│       ├── middleware/
│       │   ├── auth.js
│       │   └── errorHandler.js
│       └── routes/
│           ├── auth.js
│           ├── dashboard.js
│           ├── income.js
│           ├── expenses.js
│           ├── bills.js
│           ├── cards.js
│           ├── investments.js
│           ├── goals.js
│           └── planning.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── src/
    │   ├── App.tsx
    │   ├── contexts/
    │   │   ├── AuthContext.tsx
    │   │   └── ThemeContext.tsx
    │   ├── services/api.ts
    │   ├── types/index.ts
    │   ├── components/
    │   │   ├── Layout.tsx
    │   │   ├── Sidebar.tsx
    │   │   ├── Header.tsx
    │   │   ├── Modal.tsx
    │   │   ├── StatCard.tsx
    │   │   └── MonthPicker.tsx
    │   └── pages/
    │       ├── Login.tsx
    │       ├── Dashboard.tsx
    │       ├── Income.tsx
    │       ├── Expenses.tsx
    │       ├── Bills.tsx
    │       ├── Cards.tsx
    │       ├── Investments.tsx
    │       ├── Goals.tsx
    │       └── Planning.tsx
```

---

## Comandos úteis

```bash
# Ver logs em tempo real
docker compose logs -f

# Parar tudo
docker compose down

# Parar e apagar banco de dados
docker compose down -v

# Acessar banco via CLI
docker compose exec postgres psql -U fincouple

# Ver migrações do Prisma
docker compose exec backend npx prisma studio
```
