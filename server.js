require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors()); 
app.use(express.json()); 

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
    if (err) return console.error('Erro ao conectar com o banco:', err.stack);
    console.log('Conexão com o PostgreSQL estabelecida com sucesso! 🚀');
    release();
});

// Configuração do Carteiro (Nodemailer) - Usa os dados do seu arquivo .env
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // ou o host que você estiver usando
    port: 465,
    secure: true,
    family: 4, // <--- ADICIONE ESSA LINHA AQUI
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.get('/', (req, res) => res.send('API do Playframe rodando perfeitamente!'));

// --- ROTAS DE AUTENTICAÇÃO ---
app.post('/register', async (req, res) => {
    const { name, email, password, duo_code } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Insira um e-mail válido.' });

    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) return res.status(400).json({ error: 'Este email já está em uso.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await pool.query(
            'INSERT INTO users (name, email, password, duo_code) VALUES ($1, $2, $3, $4) RETURNING id, name, email, duo_code',
            [name, email, hashedPassword, duo_code || null]
        );
        res.status(201).json({ message: 'Usuário registrado com sucesso!', user: newUser.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Preencha email e senha.' });

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) return res.status(401).json({ error: 'Usuário não encontrado.' });

        const user = userResult.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) return res.status(401).json({ error: 'Senha incorreta.' });

        const token = jwt.sign({ userId: user.id, email: user.email, duo_code: user.duo_code }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: 'Login realizado!', token, user: { id: user.id, name: user.name, email: user.email, duo_code: user.duo_code } });
    } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

// --- ROTA DE RECUPERAÇÃO PASSO 1: ENVIAR CÓDIGO ---
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Preencha o email.' });

    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length === 0) return res.status(404).json({ error: 'Nenhuma conta encontrada com este email.' });

        // Gera código de 6 dígitos e validade de 15 minutos
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Date.now() + 15 * 60 * 1000; 

        await pool.query('UPDATE users SET reset_code = $1, reset_expires = $2 WHERE email = $3', [resetCode, expires, email]);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Playframe - Código de Recuperação de Senha',
            html: `<h3>Olá!</h3><p>Você solicitou a recuperação de senha no Playframe.</p>
                   <p>Seu código de segurança é: <strong><span style="font-size: 24px; color: #e91e63;">${resetCode}</span></strong></p>
                   <p>Este código expira em 15 minutos. Se não foi você, ignore este e-mail.</p>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Erro no envio:", error);
                return res.status(500).json({ error: 'Erro ao tentar conectar com o servidor de e-mail.' });
            }
            res.status(200).json({ message: 'Código de segurança enviado para o seu e-mail!' });
        });

    } catch (error) { 
        console.error(error);
        res.status(500).json({ error: 'Erro interno no banco de dados.' }); 
    }
});

// --- ROTA DE RECUPERAÇÃO PASSO 2: VALIDAR E TROCAR ---
app.put('/reset-password', async (req, res) => {
    const { email, resetCode, newPassword } = req.body;
    if (!email || !resetCode || !newPassword) return res.status(400).json({ error: 'Preencha todos os campos.' });

    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length === 0) return res.status(404).json({ error: 'Nenhuma conta encontrada.' });

        const user = userCheck.rows[0];

        if (user.reset_code !== resetCode) return res.status(400).json({ error: 'Código de segurança incorreto.' });
        if (Date.now() > user.reset_expires) return res.status(400).json({ error: 'Este código já expirou. Solicite outro.' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await pool.query('UPDATE users SET password = $1, reset_code = NULL, reset_expires = NULL WHERE email = $2', [hashedPassword, email]);
        
        res.status(200).json({ message: 'Senha atualizada com sucesso! Você já pode fazer login.' });
    } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

// --- MIDDLEWARE E ROTAS DE ITENS ---
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; 
    if (!token) return res.status(401).json({ error: 'Acesso negado.' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Crachá inválido.' });
        req.user = user; next();
    });
};

app.put('/user/duocode', authenticateToken, async (req, res) => {
    const { duo_code } = req.body;
    try {
        await pool.query('UPDATE users SET duo_code = $1 WHERE id = $2', [duo_code || null, req.user.userId]);
        const user = (await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId])).rows[0];
        const newToken = jwt.sign({ userId: user.id, email: user.email, duo_code: user.duo_code }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: 'Código Duo atualizado!', token: newToken, duo_code: user.duo_code });
    } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

app.post('/items', authenticateToken, async (req, res) => {
    const { name, type, status, notes, image_url, list_type } = req.body;
    try {
        const newItem = await pool.query('INSERT INTO items (user_email, name, type, status, notes, image_url, list_type, duo_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *', [req.user.email, name, type, status, notes, image_url, list_type || 'individual', req.user.duo_code || null]);
        res.status(201).json({ message: 'Item adicionado!', item: newItem.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

app.get('/items', authenticateToken, async (req, res) => {
    try {
        const query = req.user.duo_code ? 'SELECT * FROM items WHERE user_email = $1 OR (list_type = $2 AND duo_code = $3) ORDER BY created_at DESC' : 'SELECT * FROM items WHERE user_email = $1 ORDER BY created_at DESC';
        const params = req.user.duo_code ? [req.user.email, 'duo', req.user.duo_code] : [req.user.email];
        res.status(200).json((await pool.query(query, params)).rows);
    } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

app.put('/items/:id', authenticateToken, async (req, res) => {
    const { name, type, status, notes, image_url, list_type } = req.body;
    try {
        const updatedItem = await pool.query('UPDATE items SET name = $1, type = $2, status = $3, notes = $4, image_url = $5, list_type = $6 WHERE id = $7 AND (user_email = $8 OR (list_type = $9 AND duo_code = $10)) RETURNING *', [name, type, status, notes, image_url, list_type, req.params.id, req.user.email, 'duo', req.user.duo_code]);
        res.status(200).json(updatedItem.rows[0]);
    } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

app.delete('/items/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM items WHERE id = $1 AND (user_email = $2 OR (list_type = $3 AND duo_code = $4))', [req.params.id, req.user.email, 'duo', req.user.duo_code]);
        res.status(200).json({ message: 'Deletado com sucesso' });
    } catch (error) { res.status(500).json({ error: 'Erro no servidor.' }); }
});

app.listen(process.env.PORT || 3000, () => console.log('Servidor rodando!'));
