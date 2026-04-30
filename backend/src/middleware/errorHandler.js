function errorHandler(err, req, res, next) {
  console.error('[error]', {
    message: err.message,
    status: err.status,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  const status = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Em produção, erros 5xx não expõem detalhes internos (stack, mensagens do Prisma, etc.)
  const message =
    status < 500 || !isProduction
      ? err.message || 'Erro desconhecido'
      : 'Erro interno do servidor. Tente novamente.';

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
