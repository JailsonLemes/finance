const { z } = require('zod');

const positiveDecimal = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .pipe(z.number().positive('Deve ser maior que zero').max(10_000_000, 'Valor muito alto'));

const dateString = z
  .string()
  .refine((s) => !isNaN(Date.parse(s)), { message: 'Data inválida' });

// ─── Receitas ─────────────────────────────────────────────────────────────────
const createIncomeSchema = z.object({
  date:        dateString,
  description: z.string().min(1, 'Obrigatório').max(200),
  category:    z.string().min(1, 'Obrigatório').max(100),
  value:       positiveDecimal,
  type:        z.enum(['fixed', 'variable'], { message: 'Tipo inválido' }),
  person:      z.string().min(1, 'Obrigatório').max(100),
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  email:       z.string().email('Email inválido').max(200),
  password:    z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(100),
  name:        z.string().min(1, 'Obrigatório').max(100),
  partnerName: z.string().max(100).optional().nullable(),
});

// ─── Despesas ─────────────────────────────────────────────────────────────────
const createExpenseSchema = z.object({
  date:               dateString,
  description:        z.string().min(1, 'Obrigatório').max(200),
  category:           z.string().min(1, 'Obrigatório').max(100),
  subcategory:        z.string().max(100).optional().nullable(),
  value:              positiveDecimal,
  person:             z.string().min(1, 'Obrigatório').max(100),
  paymentMethod:      z.string().min(1, 'Obrigatório').max(100),
  dueDate:            dateString.optional().nullable(),
  cardId:             z.string().optional().nullable(),
  installmentTotal:   z.coerce.number().int().min(1).max(360).optional().nullable(),
  installmentCurrent: z.coerce.number().int().min(1).optional().nullable(),
});

// ─── Contas ───────────────────────────────────────────────────────────────────
const createBillSchema = z.object({
  description: z.string().min(1, 'Obrigatório').max(200),
  value:       positiveDecimal,
  dueDate:     dateString,
  category:    z.string().min(1, 'Obrigatório').max(100),
  responsible: z.string().min(1, 'Obrigatório').max(100),
  recurrent:   z.boolean().optional().default(false),
});

// ─── Investimentos ────────────────────────────────────────────────────────────
const createInvestmentSchema = z.object({
  type:          z.string().min(1, 'Obrigatório').max(100),
  description:   z.string().min(1, 'Obrigatório').max(200),
  investedValue: positiveDecimal,
  currentValue:  z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().min(0).max(10_000_000))
    .optional(),
  profitability: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().min(-100).max(100_000))
    .optional()
    .default(0),
  date: dateString,
});

// ─── Metas ────────────────────────────────────────────────────────────────────
const createGoalSchema = z.object({
  title:        z.string().min(1, 'Obrigatório').max(200),
  description:  z.string().max(500).optional().nullable(),
  targetValue:  positiveDecimal,
  currentValue: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().min(0).max(10_000_000))
    .optional()
    .default(0),
  targetDate:   dateString.optional().nullable(),
  category:     z.string().min(1, 'Obrigatório').max(100),
  color:        z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida').optional().default('#6366f1'),
});

const contributeSchema = z.object({
  amount: positiveDecimal,
});

// ─── Planejamento ─────────────────────────────────────────────────────────────
const createPlanningSchema = z.object({
  month:        z.coerce.number().int().min(1).max(12),
  year:         z.coerce.number().int().min(2000).max(2100),
  category:     z.string().min(1, 'Obrigatório').max(100),
  plannedValue: positiveDecimal,
});

/**
 * Helper para validar req.body com um schema Zod e retornar 400 se inválido.
 * Uso: const data = validate(req, res, createIncomeSchema); if (!data) return;
 */
function validate(req, res, schema) {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: 'Dados inválidos',
      details: result.error.flatten().fieldErrors,
    });
    return null;
  }
  return result.data;
}

module.exports = {
  registerSchema,
  createIncomeSchema,
  createExpenseSchema,
  createBillSchema,
  createInvestmentSchema,
  createGoalSchema,
  contributeSchema,
  createPlanningSchema,
  validate,
};
