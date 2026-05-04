const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { registerSchema, validate } = require('../lib/schemas');

router.post('/register', async (req, res, next) => {
  try {
    const body = validate(req, res, registerSchema);
    if (!body) return;

    const { email, password, name, partnerName } = body;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email já cadastrado' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, partnerName },
      select: { id: true, email: true, name: true, partnerName: true, darkMode: true },
    });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const { password: _, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (e) {
    next(e);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, partnerName: true, darkMode: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

router.put('/me', authMiddleware, async (req, res, next) => {
  try {
    const { name, partnerName, darkMode, currentPassword, newPassword } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (partnerName !== undefined) data.partnerName = partnerName;
    if (darkMode !== undefined) data.darkMode = darkMode;

    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Nova senha deve ter ao menos 8 caracteres' });
      }
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(400).json({ error: 'Senha atual incorreta' });
      data.password = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: { id: true, email: true, name: true, partnerName: true, darkMode: true },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
