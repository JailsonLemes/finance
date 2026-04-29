# FinCouple — Controle Financeiro do Casal

Sistema web completo de controle financeiro para casais, com dashboard, contas a pagar, cartões, investimentos, metas e planejamento orçamentário.

## Stack

| Camada   | Tecnologia                                             |
| -------- | ------------------------------------------------------ |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Recharts |
| Backend  | Node.js + Express + Prisma ORM                         |
| Banco    | PostgreSQL 16                                          |
| Auth     | JWT (30 dias)                                          |
| Deploy   | Docker + Docker Compose                                |

---

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/) v2+

---

## Início rápido

```bash
# 1. Clone o repositório
git clone git@github.com:JailsonLemes/finance.git
cd finance

# 2. Crie o arquivo de variáveis de ambiente
cp .env.example .env
# Edite .env e defina um JWT_SECRET forte

# 3. Suba todos os serviços
docker compose up --build -d
```

Aguarde ~30 segundos e acesse:

| Serviço      | URL                                       |
| ------------ | ----------------------------------------- |
| Aplicação    | <http://localhost>                        |
| API          | <http://localhost:3001>                   |
| Health check | <http://localhost:3001/health>            |

---

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto a partir do exemplo:

```bash
cp .env.example .env
```

| Variável       | Descrição                              | Exemplo              |
| -------------- | -------------------------------------- | -------------------- |
| `JWT_SECRET`   | Chave secreta para assinar tokens JWT  | string aleatória     |
| `FRONTEND_URL` | Origem permitida no CORS               | `http://localhost`   |

> O `.env` está no `.gitignore` e **nunca deve ser commitado**.

---

## Funcionalidades

### Dashboard

- Saldo do mês, total de receitas, despesas e contas pendentes
- Indicador de saúde financeira (0–100%)
- Gráfico de pizza — despesas por categoria
- Gráfico de linha — evolução dos últimos 6 meses
- Alerta de contas atrasadas

### Receitas

- CRUD completo com filtro por mês/categoria/pessoa
- Tipos: fixa / variável
- Exportação para Excel

### Despesas

- CRUD completo com filtro por mês/categoria/pessoa/forma de pagamento
- Integração com cartões de crédito
- Gráfico de distribuição por categoria em tempo real
- Exportação para Excel

### Contas a Pagar

- **Checkbox com atualização otimista** — feedback visual imediato ao marcar/desmarcar
- Status automático: Pago · Pendente · Atrasado (calculado por data)
- **Recorrência automática** — contas recorrentes são geradas ao abrir um novo mês
- Registro automático da data de pagamento
- Filtro por status e exportação para Excel

### Cartões de Crédito

- Controle de fatura do ciclo atual
- Gestão de parcelamentos
- Barra visual de limite disponível / utilizado

### Investimentos

- Tipos: renda fixa, ações, FII, cripto, poupança
- Cálculo de rentabilidade e retorno total
- Distribuição em gráfico de pizza

### Metas Financeiras

- Barra de progresso visual por meta
- Botão de contribuição rápida
- Cores e categorias personalizadas

### Planejamento

- Orçamento previsto vs. realizado por categoria
- Alertas de estouro de orçamento
- Gráfico de barras comparativo
- Sincronização automática com despesas lançadas

### UX / UI

- Modo escuro / claro com persistência
- Design responsivo (mobile e desktop)
- Navegação lateral com ícones

---

## Estrutura do projeto

```text
finance/
├── .env.example
├── .gitignore
├── docker-compose.yml
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma        # Modelos do banco (8 entidades)
│   │   ├── seed.js              # Dados iniciais de demonstração
│   │   └── import.js            # Script de importação via JSON
│   └── src/
│       ├── index.js             # Entry point, CORS, rate limit
│       ├── lib/
│       │   └── prisma.js        # Singleton do PrismaClient
│       ├── middleware/
│       │   ├── auth.js          # Verificação JWT
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
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── App.tsx
        ├── utils/
        │   └── fmt.ts           # Formatação de moeda (BRL)
        ├── contexts/
        │   ├── AuthContext.tsx
        │   └── ThemeContext.tsx
        ├── services/
        │   └── api.ts           # Axios + interceptor JWT
        ├── types/
        │   └── index.ts
        ├── components/
        │   ├── Layout.tsx
        │   ├── Sidebar.tsx
        │   ├── Header.tsx
        │   ├── Modal.tsx
        │   ├── StatCard.tsx
        │   └── MonthPicker.tsx
        └── pages/
            ├── Login.tsx
            ├── Dashboard.tsx
            ├── Income.tsx
            ├── Expenses.tsx
            ├── Bills.tsx
            ├── Cards.tsx
            ├── Investments.tsx
            ├── Goals.tsx
            └── Planning.tsx
```

---

## Comandos úteis

```bash
# Acompanhar logs em tempo real
docker compose logs -f

# Parar os serviços
docker compose down

# Parar e remover o banco de dados (reset completo)
docker compose down -v

# Acessar o banco via CLI
docker compose exec postgres psql -U fincouple

# Abrir o Prisma Studio (interface visual do banco)
docker compose exec backend npx prisma studio
```

---

## Desenvolvimento local (sem Docker)

### Backend

```bash
cd backend
npm install

# Configure as variáveis de ambiente
cp ../.env.example .env
# Ajuste DATABASE_URL para sua instância PostgreSQL local

npx prisma db push
npm run dev   # porta 3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # porta 5173
```
