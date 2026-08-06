require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const http = require('http');
const { Server } = require('socket.io');

const { Resend } = require('resend');
const crypto = require('crypto');

const resend = new Resend(process.env.RESEND_API_KEY || process.env.SMTP_PASS);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
// app hocche web server. pore app.something() kora hobe

// cors mane cross origin resource sharing, frontend backend er moddhe connection kore
// jwt diye logged in user ke mone rakhe, json web token
// pool postgresql client for node js

// Middleware
// middleware majhkhan diye prottek req er age ei code gulo run kore
// app.use(cors()) diye frontend theke backend call kore
// 10 mb profile pic er size limit
// json file read korar jonno 

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database Connection, supabase er sathe coonection, ssl security r jonno
// max pool 10 mane 10 ta db connect hote parbe

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },

    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});
// tasting er jonno
pool.query('select now()', (err, res) => {
    if (err) {
        console.error('Γ¥î Database connection error:', err.stack);
    } else {
        console.log('Γ£à Database connected successfully at:', res.rows[0].now);
    }
});

//middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// middleaware bujhi nai
const optionalAuthenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('[Auth] JWT Verify Failed:', err.message);
            req.user = null;
            return next();
        }
        console.log('[Auth] Token verified for User ID:', user.userId);
        req.user = user;
        next();
    });
};

// admin auth middleware
const authenticateAdmin = (req, res, next) => {
    authenticateToken(req, res, async () => {
        try {
            const u = await pool.query('select is_admin, is_super_admin from users where user_id = $1', [req.user.userId]);
            if (u.rows.length === 0 || !u.rows[0].is_admin) {
                return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
            }
            req.user.isAdmin = true;
            req.user.isSuperAdmin = u.rows[0].is_super_admin;
            next();
        } catch (e) {
            res.status(500).json({ error: 'Auth check failed' });
        }
    });
};

// new gemini endpoint
// Gemini AI chat endpoint with automatic fallback
app.post('/api/ai/chat', optionalAuthenticate, async (req, res) => {
    try {

        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY in .env' });
        }


        const { messages, system } = req.body || {};
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages array is required' });
        }


        const contents = [];
        if (system && typeof system === 'string') {
            contents.push({ role: 'user', parts: [{ text: `System instruction: ${system}` }] });
            contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
        }
        for (const m of messages) {
            if (!m || !m.role || !m.content) continue;
            contents.push({ 
                role: m.role === 'assistant' ? 'model' : 'user', 
                parts: [{ text: m.content }] 
            });
        }

        if (contents.length === 0 || contents[0].role !== 'user') {
            return res.status(400).json({ error: 'First message must be from user' });
        }

 
        const FALLBACK_MODELS = [
            'gemini-3.5-flash',        
            'gemini-flash-latest',     
            'gemini-2.5-flash',        
            'gemini-2.0-flash',        
            'gemini-3.5-flash-lite',   
            'gemini-flash-lite-latest' 
        ];

        let data = null;
        let successModel = null;
        let lastError = null;

        for (const mdl of FALLBACK_MODELS) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            try {
                console.log(`[Chat] Trying model: ${mdl}`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent?key=${apiKey}`;
                
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents }),
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (resp.ok) {
                    data = await resp.json();
                    successModel = mdl;
                    console.log(`[Chat] ✅ Success with model: ${mdl}`);
                    break; 
                }

                const errText = await resp.text();
                lastError = { model: mdl, status: resp.status, body: errText };

                if (resp.status === 429) {
                    console.warn(`[Chat] ⏱️  Rate limited on ${mdl}, trying next...`);
                } else if (resp.status === 404) {
                    console.warn(`[Chat] ❌ Model ${mdl} not available, trying next...`);
                } else {
                    console.error(`[Chat] Error ${resp.status} on ${mdl}, trying next...`);
                }
            } catch (fetchErr) {
                clearTimeout(timeout);
                console.error(`[Chat] Fetch failed for ${mdl}:`, fetchErr.message);
                lastError = { model: mdl, message: fetchErr.message };
            }
        }


        if (!data) {
            console.error('[Chat] ALL MODELS FAILED. Last error:', lastError);
            return res.status(503).json({ 
                error: 'AI is temporarily unavailable. All models are rate-limited or unreachable. Please try again in a minute.',
                details: lastError
            });
        }

  
        let text = '';
        try {
            text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        } catch (_) { /* ignore */ }


        let suggestedMovies = [];
        const movieRegex = /#GeminiMovies:\s*([\s\S]+?)(?:\r?\n|$)/i;
        const movieMatch = text.match(movieRegex);
        if (movieMatch) {
            const rawTitles = movieMatch[1].trim();
            const movieTitles = rawTitles.split(',')
                .map(t => t.trim().replace(/^['"`]+|['"`]+$/g, ''))
                .filter(t => t.length > 0);

            text = text.replace(movieRegex, '').trim();

            if (movieTitles.length > 0) {
                try {
                    const placeholders = movieTitles.map((_, index) => `$${index + 1}`).join(', ');
                    const safeQuery = `SELECT id, title, poster_path, vote_average FROM movies WHERE title IN (${placeholders})`;
                    const result = await pool.query(safeQuery, movieTitles);
                    suggestedMovies = result.rows;
                    console.log(`[Chat] Found ${suggestedMovies.length}/${movieTitles.length} movies in DB`);
                } catch (dbErr) {
                    console.error('[Chat] SQL query failed:', dbErr.message);
                }
            }
        }

        const uId = req.user ? (req.user.userId || req.user.id || req.user.user_id) : null;
        if (uId) {
            try {
                const lastUserMessage = messages[messages.length - 1];
                if (lastUserMessage?.role === 'user') {
                    await pool.query(
                        'INSERT INTO user_chat_messages (user_id, role, content) VALUES ($1, $2, $3)',
                        [uId, 'user', lastUserMessage.content]
                    );
                }
                if (text) {
                    await pool.query(
                        'INSERT INTO user_chat_messages (user_id, role, content) VALUES ($1, $2, $3)',
                        [uId, 'model', text]
                    );
                }
                console.log(`[Chat] Saved messages for UID: ${uId}`);
            } catch (saveErr) {
                console.error('[Chat] Save error:', saveErr.message);
            }
        }

  
        return res.json({ 
            text, 
            suggestedMovies, 
            modelUsed: successModel,  
            raw: data 
        });

    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'Request to Gemini timed out' });
        }
        console.error('AI chat proxy error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});



// Gemini er endpoint






// app.post('/api/ai/chat', optionalAuthenticate, async (req, res) => {
//     try {
//         const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GENAI_API_KEY;
//         if (!apiKey) {
//             return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY in .env' }); //env file gemini er api key rakha ase. but prothome quotation mark deyai mara kheye gesi
//         }

//         const { messages, system, model } = req.body || {};
//         if (!messages || !Array.isArray(messages) || messages.length === 0) {
//             return res.status(400).json({ error: 'messages array is required' });
//         }


//         // new change
//         const VALID_MODELS = [
//             'gemini-3.5-flash',
//         ];
//         const mdl = VALID_MODELS.includes(model) ? model : 'gemini-3.5-flash';
//         // eshob habijabi gemini style e convert kora
//         const contents = [];
//         if (system && typeof system === 'string') {
//             contents.push({ role: 'user', parts: [{ text: `System instruction: ${system}` }] });
//             contents.push({
//                 role: 'model',
//                 parts: [{ text: 'Understood. I will follow these instructions.' }]
//             });
//         }
//         for (const m of messages) {
//             if (!m || !m.role || !m.content) continue;
//             contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
//         }
//         // new change
//         // const { messages, system, model } = req.body || {};
//         // const mdl = model || 'gemini-3.5-flash';
//         if (contents.length === 0 || contents[0].role !== 'user') {
//             return res.status(400).json({ 
//                 error: 'First message must be from user' 
//             });
//         }
//         // const validModels = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];
//         // const mdl = validModels.includes(model) ? model : 'gemini-3.5-flash';
//         const controller = new AbortController();
//         const timeout = setTimeout(() => controller.abort(), 30000);

//         const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent?key=${apiKey}`;
//         console.log(`[Chat] Calling Gemini model: ${mdl}`);
//         const resp = await fetch(url, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ contents }),
//             signal: controller.signal
//         });
//         clearTimeout(timeout);

//         if (!resp.ok) {
//             const txt = await resp.text();
//             console.error("GOOGLE API REJECTED:", txt);
//             return res.status(502).json({ error: 'Gemini API error', details: txt });
//         }
//         const data = await resp.json();
//         // text ta extract kora
//         let text = '';
//         try {
//             text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
//         } catch (_) { /* kichu na*/ }

//         let suggestedMovies = [];

//         //je gemini ta noob o vulval query kore tai jor kore query koracchi
//         const movieRegex = /#GeminiMovies:\s*([\s\S]+?)(?:\r?\n|$)/i;
//         const movieMatch = text.match(movieRegex);
//         if (movieMatch) {
//             const rawTitles = movieMatch[1].trim();
//             // cleaming up
//             const movieTitles = rawTitles.split(',')
//                 .map(t => t.trim().replace(/^['"`]+|['"`]+$/g, ''))
//                 .filter(t => t.length > 0);

//             // sign shorailam
//             text = text.replace(movieRegex, '').trim();

//             if (movieTitles.length > 0) {
//                 try {
//                     // gadha model er jonno query ami e likhe disi jor kore o khali naam dibe
//                     const placeholders = movieTitles.map((_, index) => `$${index + 1}`).join(', ');
//                     const safeQuery = `select id, title, poster_path, vote_average from movies where title in (${placeholders})`;
//                     const result = await pool.query(safeQuery, movieTitles);
//                     suggestedMovies = result.rows;
//                     console.log(`[Chat] Enforced search for titles: ${movieTitles.join(', ')} -> Found ${suggestedMovies.length} movies.`);
//                 } catch (dbErr) {
//                     console.error('[Chat] SQL Enforcement failed:', dbErr.message);
//                 }
//             }
//         }

//         // authentication check
//         const uId = req.user ? (req.user.userId || req.user.id || req.user.user_id) : null;
//         if (uId) {
//             console.log('[Chat] Attempting to save message for UID:', uId);
//             try {
//                 // user er recent message save kora eta recommendation e kaaje lage
//                 const lastUserMessage = messages[messages.length - 1];
//                 if (lastUserMessage && lastUserMessage.role === 'user') {
//                     await pool.query(
//                         'insert into user_chat_messages (user_id, role, content) values ($1, $2, $3)',
//                         [uId, 'user', lastUserMessage.content]//user hole user role e rakhe
//                     );
//                 }
//                 if (text) {
//                     await pool.query(
//                         'insert into user_chat_messages (user_id, role, content) values ($1, $2, $3)',
//                         [uId, 'model', text]//otherwise model
//                     );
//                 }
//                 console.log('[Chat] Successfully saved user and model messages.');
//             } catch (saveErr) {
//                 console.error('[Chat] Save error:', saveErr.message);
//             }
//         }

//         return res.json({ text, suggestedMovies, raw: data });
//     } catch (err) {
//         if (err.name === 'AbortError') {
//             return res.status(504).json({ error: 'Request to Gemini timed out' });
//         }
//         console.error('AI chat proxy error:', err);
//         return res.status(500).json({ error: 'Internal server error' });
//     }
// });

// first route e, new user register

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

app.post('/api/send-otp', async (req, res) => {
    const { email, password, full_name, date_of_birth, phone_number, gender } = req.body;

    try {
        if (!email || !password) throw new Error('Email and password are required');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) throw new Error('Invalid email format');
        if (password.length < 6) throw new Error('Password must be at least 6 characters long');
        if (!full_name || full_name.trim().length < 2) throw new Error('Full name is required (at least 2 characters)');

        const userCheck = await pool.query('select * from users where email = $1', [email]);
        if (userCheck.rows.length > 0) throw new Error('User already exists');

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

        await pool.query(
            `insert into email_otps (email, otp_code, expires_at) 
             values ($1, $2, $3) 
             on conflict (email) DO update set otp_code = excluded.otp_code, expires_at = excluded.expires_at`,
            [email, otp, expiresAt]
        );

        await resend.emails.send({
            from: 'PopCorn <onboarding@resend.dev>',
            to: email,
            subject: '≡ƒÄ¼ Your PopCorn OTP Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 40px; border-radius: 16px; border: 1px solid rgba(245,197,24,0.3);">
                    <h1 style="color: #f5c518; text-align: center;">≡ƒÄ¼ PopCorn Verification</h1>
                    <p style="text-align: center; color: #ccc;">Hi ${full_name || 'there'},</p>
                    <p style="text-align: center; color: #ccc;">Here is your code to verify your email. It expires in 10 minutes:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="display: inline-block; padding: 14px 32px; background: #222; color: #f5c518; border-radius: 10px; font-weight: bold; font-size: 32px; letter-spacing: 4px; border: 2px dashed #f5c518;">${otp}</span>
                    </div>
                </div>
            `
        });

        res.json({ message: 'OTP sent successfully to email' });
    } catch (error) {
        console.error('OTP Send Error:', error);
        res.status(400).json({ error: error.message || 'Failed to send OTP' });
    }
});

app.post('/api/register', async (req, res) => {
    const { email, password, full_name, date_of_birth, gender, phone_number, address, profile_picture, otp_code } = req.body;

    const client = await pool.connect();

    try {
        if (!email || !otp_code) throw new Error('Email and OTP code are required');

        await client.query('begin');

        // Check OTP
        const otpCheck = await client.query('select * from email_otps where email = $1 and otp_code = $2', [email, otp_code]);
        if (otpCheck.rows.length === 0) throw new Error('Invalid or expired OTP');

        if (new Date() > new Date(otpCheck.rows[0].expires_at)) {
            await client.query('delete from email_otps where email = $1', [email]);
            throw new Error('OTP has expired, please request a new one');
        }

        const userCheck = await client.query('select * from users where email = $1', [email]);
        if (userCheck.rows.length > 0) throw new Error('User already exists');

        const userEmail = email.split('@')[0];
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            'CALL sp_register_user($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL)',
            [
                email,
                passwordHash,
                userEmail,
                full_name ? full_name.trim() : null,
                date_of_birth || null,
                gender || null,
                phone_number ? phone_number.trim() : null,
                address ? address.trim() : null,
                profile_picture || null,
                otp_code
            ]
        );

        const newUserId = result.rows[0].p_user_id;

        const userRes = await pool.query('select * from users where user_id = $1', [newUserId]);
        const newUser = userRes.rows[0];

        // Automatically login
        const token = jwt.sign(
            { userId: newUser.user_id, email: newUser.email, isAdmin: newUser.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            message: 'Account verified and created successfully!',
            user: newUser,
            token: token
        });

    } catch (error) {
        console.error('[Registration] Procedure Error:', error.message);
        res.status(400).json({ error: error.message || 'Verification failed' });
    }
});

// existing user ke
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('select * from users where email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Check email verification
        if (user.is_verified === false) {
            return res.status(403).json({ error: 'Please verify your email before logging in. Check your inbox for the verification link.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { userId: user.user_id, email: user.email, isAdmin: user.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token: token,
            user: {
                id: user.user_id,
                email: user.email,
                username: user.username,
                full_name: user.full_name,
                date_of_birth: user.date_of_birth,
                gender: user.gender,
                phone_number: user.phone_number,
                address: user.address,
                profile_picture: user.profile_picture,
                is_admin: user.is_admin,
                is_super_admin: user.is_super_admin
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Email verification 
app.get('/api/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
    }

    try {
        const result = await pool.query(
            'select user_id, email, is_verified from users where verification_token = $1',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification link.' });
        }

        const user = result.rows[0];

        if (user.is_verified) {
            return res.json({ message: 'Your email is already verified! You can log in now.' });
        }

        await pool.query(
            'update users set is_verified = true, verification_token = NULL where user_id = $1',
            [user.user_id]
        );

        console.log(`Γ£à Email verified for user ${user.email}`);
        res.json({ message: 'Email verified successfully! You can now log in to PopCorn.' });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

// Resend verification email
app.post('/api/resend-verification', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const result = await pool.query(
            'select user_id, username, full_name, is_verified, verification_token from users where email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No account found with this email' });
        }

        const user = result.rows[0];

        if (user.is_verified) {
            return res.json({ message: 'Email is already verified. You can log in.' });
        }

        // new tken banano
        let token = user.verification_token;
        if (!token) {
            token = crypto.randomBytes(32).toString('hex');
            await pool.query('update users set verification_token = $1 where user_id = $2', [token, user.user_id]);
        }

        const verifyUrl = `${FRONTEND_URL}/verify?token=${token}`;
        await resend.emails.send({
            from: 'PopCorn <onboarding@resend.dev>',
            to: email,
            subject: '≡ƒÄ¼ Verify your PopCorn account',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 40px; border-radius: 16px; border: 1px solid rgba(245,197,24,0.3);">
                    <h1 style="color: #f5c518; text-align: center;">≡ƒÄ¼ Verify Your Email</h1>
                    <p style="text-align: center; color: #ccc;">Click below to verify your PopCorn account:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(45deg, #f5c518, #e6b800); color: #000; text-decoration: none; border-radius: 10px; font-weight: bold;">Verify My Email</a>
                    </div>
                    <p style="text-align: center; color: #888; font-size: 12px;"><a href="${verifyUrl}" style="color: #f5c518;">${verifyUrl}</a></p>
                </div>
            `
        });

        console.log(`Γ£à Resent verification email to ${email}`);
        res.json({ message: 'Verification email resent!' });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Failed to resend verification email' });
    }
});

// Start  server
const PORT = process.env.PORT || 5000;

// Middleware 
// token eshb habijabi check kore, biroktikor jinish
// abar verify kore
app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});




//browse page, best jinish

app.get('/api/browse/trending', async (req, res) => {//uporer boro boro trending gula dekhai
    try {
        const result = await pool.query('select * from trending_movies_view order by random() limit 50');
        console.log(`[Browse] Trending: sending ${result.rows.length} random movies from top 500 pool`);
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch trending' });
    }
});

app.get('/api/browse/collaborative', optionalAuthenticate, async (req, res) => {//similar minds gula dekhai
    try {
        const userId = req.user ? req.user.userId : null;
        const result = await pool.query('select * from get_collaborative_recommendations($1)', [userId]);
        console.log(`[Browse] Collaborative (User: ${userId || 'Guest'}): sending ${result.rows.length} movies`);
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch collaborative recs' });
    }
});

app.get('/api/browse/foryou', optionalAuthenticate, async (req, res) => {//genre based recommend kore
    try {
        const userId = req.user ? req.user.userId : null;
        const result = await pool.query('select * from get_genre_recommendations($1)', [userId]);
        console.log(`[Browse] ForYou (User: ${userId || 'Guest'}): sending ${result.rows.length} movies`);
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch genre recs' });
    }
});

app.get('/api/browse/related', optionalAuthenticate, async (req, res) => {//because you liked kichu ekta recoomend kore
    try {
        const userId = req.user ? req.user.userId : null;
        console.log(`[Browse] Related Request - UserID: ${userId}`);

        if (!userId) {
            return res.json({ anchor: null, movies: [] });
        }

        const result = await pool.query('select * from get_recommendations_by_recently_liked($1)', [userId]);
        console.log(`[Browse] Related SQL result: ${result.rows.length} rows`);

        if (result.rows.length > 0) {
            const anchorTitle = result.rows[0].anchor_title;
            const movies = result.rows.map(row => {
                const { anchor_title, ...movie } = row;
                return movie;
            });
            console.log(`[Browse] Related: Found anchor "${anchorTitle}" with ${movies.length} matches`);
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            return res.json({ anchor: anchorTitle, movies });
        } else {
            console.log(`[Browse] Related: No recommendations found for User ${userId}`);
        }

    } catch (error) {
        console.error('[Browse] Related Route Error:', error);
        res.status(500).json({ error: 'Failed to fetch related recs' });
    }
});

app.get('/api/browse/ai', optionalAuthenticate, async (req, res) => {
    try {
        const userId = req.user ? (req.user.userId || req.user.id || req.user.user_id) : null;
        const forceRefresh = req.query.force === 'true';

        if (!userId) {
            const guestRes = await pool.query('select * from movies where vote_average >= 8.2 order by random() limit 10');
            return res.json({
                recommendations: guestRes.rows.map(m => ({ ...m, ai_note: "Discover a top-rated cinematic masterpiece." })),
                cached_at: new Date()
            });
        }

        const currentCache = await pool.query('select recommendations, last_updated from user_ai_cache where user_id = $1', [userId]);
        const existingRecs = currentCache.rows.length > 0 ? currentCache.rows[0].recommendations : [];

        if (!forceRefresh && currentCache.rows.length > 0) {
            const lastUpdated = new Date(currentCache.rows[0].last_updated);
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
            if (lastUpdated > fourHoursAgo) {
                console.log(`[Browse] AI: Returning fresh cache for User ${userId}`);
                return res.json({ recommendations: existingRecs, cached_at: lastUpdated });
            }
        }

        console.log(`[Browse] AI: Generating refined picks for User ${userId} (force=${forceRefresh})`);
        const avoidTitles = existingRecs.map(r => r.title).join(', ');

        const [genres, favs, wishlist, ratings, comments, posts, chats] = await Promise.all([
            pool.query('select g.name from user_interests ui join genres g on ui.genre_id = g.id where ui.user_id = $1', [userId]),
            pool.query('select m.title, uf.created_at from user_favourites uf join movies m on uf.movie_id = m.id where uf.user_id = $1 order by uf.created_at desc limit 5', [userId]),
            pool.query('select m.title, w.created_at from wishlist w join movies m on w.movie_id = m.id where w.user_id = $1 order by w.created_at desc limit 5', [userId]),
            pool.query('select m.title, r.rating, r.created_at from movie_ratings r join movies m on r.movie_id = m.id where r.user_id = $1 order by r.created_at desc limit 10', [userId]),
            pool.query('select m.title, c.content, c.created_at from movie_comments c join movies m on c.movie_id = m.id where c.user_id = $1 order by c.created_at desc limit 5', [userId]),
            pool.query('select content, created_at from social_posts where user_id = $1 order by created_at desc limit 5', [userId]),
            pool.query('select role, content, created_at from user_chat_messages where user_id = $1 order by created_at desc limit 10', [userId])
        ]);

        const timelineStrings = [
            `Interests: ${genres.rows.map(g => g.name).join(', ') || 'Unknown'}`,
            ...favs.rows.map(f => `[Fav] ${f.title}`),
            ...wishlist.rows.map(w => `[Watchlist] ${w.title}`),
            ...ratings.rows.map(r => `[Rated] ${r.title} ${r.rating}/10`),
            ...comments.rows.map(c => `[Commented] ${c.title}: ${c.content}`),
            ...chats.rows.reverse().map(ch => `[MOST RECENT CHAT] ${ch.role.toUpperCase()}: ${ch.content}`)
        ];

        try {
            const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
            const systemPrompt = `You are a personalized movie recommendation assistant. 
PRIORITY NO 1: Recent Chat Messages. 
If a user mentions a topic (e.g. "sharks", "space", "romance"), recommend 2-3 relevant movies immediately.
AI NOTES: Must be immersive and conversational. 
Use phrases like: 
- "Because you recently watchlisted..."
- "Since you mentioned X in our chat..."
- "Since you are a fan of [topic]..."
STRICT RULES:
- NO markdown (no **, no *). Just clean text.
- MAXIMUM 10 recommendations.
- AVOID these titles already recommended: [${avoidTitles}]
FORMAT: #AI_REC: select id, title, poster_path, backdrop_path, vote_average from movies where title ilike '%MOVIE%' limit 1 | Personalized Immersive Note`;

            //const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { //eta pro sir er jonno special
            const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUSER TIMELINE (Recent Chat is priority):\n${timelineStrings.join('\n')}` }] }]
                })
            });

            if (!aiRes.ok) {
                const errBody = await aiRes.text();
                console.error(`[Browse] Gemini API Error (${aiRes.status}):`, errBody);
                throw new Error(`Gemini API Error: ${aiRes.status}`);
            }

            const data = await aiRes.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const recMatches = aiText.split('#AI_REC:').slice(1);
            const recommendations = [];

            for (const block of recMatches) {
                const [queryPart, notePart] = block.split('|');
                if (!queryPart || !notePart) continue;
                try {
                    const row = await pool.query(queryPart.trim());
                    if (row.rows.length > 0) {
                        recommendations.push({ ...row.rows[0], ai_note: notePart.trim().replace(/\*/g, '') });
                    }
                } catch (e) { /* skip bad*/ }
            }

            if (recommendations.length > 0) {
                await pool.query(
                    `insert into user_ai_cache (user_id, recommendations, last_updated)
                     values ($1, $2, now())
                     on conflict (user_id) DO update set recommendations = excluded.recommendations, last_updated = now()`,
                    [userId, JSON.stringify(recommendations)]
                );
                return res.json({ recommendations, cached_at: new Date() });
            } else {
                throw new Error('No valid recommendations found');
            }
        } catch (genError) {
            console.error(`[Browse] AI: Gen failed for ${userId}, using fallback.`, genError.message);
            if (existingRecs.length > 0) return res.json({ recommendations: existingRecs, cached_at: new Date(), is_stale: true });

            const popRes = await pool.query('select * from movies where vote_average >= 7.8 order by random() limit 10');
            return res.json({ recommendations: popRes.rows.map(m => ({ ...m, ai_note: "A popular choice that matches your profile." })), cached_at: new Date(), is_fallback: true });
        }

    } catch (error) {
        console.error('[Browse] AI Error:', error);
        res.status(500).json({ error: 'Deep Discovery Engine currently recalibrating.' });
    }
});

//social

// post tost ashe
app.get('/api/posts', async (req, res) => {
    try {
        // logged in naki
        let currentUserId = null;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                currentUserId = decoded.userId;
            } catch (e) { /* ignore invalid tokens for public route */ }
        }

        const query = `
            select 
                sp.post_id, sp.content, sp.image, sp.created_at, sp.updated_at, sp.user_id,
                u.username, u.full_name, u.profile_picture,
                coalesce(lc.like_count, 0)::int as like_count,
                coalesce(cc.comment_count, 0)::int as comment_count,
                case when ul.user_id is not null then true else false end as liked_by_me
            from social_posts sp
            join users u on sp.user_id = u.user_id
            left join (
                select post_id, count(*) as like_count from post_likes group by post_id
            ) lc on sp.post_id = lc.post_id
            left join (
                select post_id, count(*) as comment_count from post_comments group by post_id
            ) cc on sp.post_id = cc.post_id
            left join post_likes ul on sp.post_id = ul.post_id and ul.user_id = $1
            order by sp.created_at desc
        `;
        const result = await pool.query(query, [currentUserId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

//  new post lekhe
app.post('/api/posts', authenticateToken, async (req, res) => {
    const { content, image } = req.body;
    const userId = req.user.userId;

    try {
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Post content cannot be empty' });
        }

        const query = `
            insert into social_posts (user_id, content, image)
            values ($1, $2, $3)
            returning *
        `;
        const result = await pool.query(query, [userId, content.trim(), image || null]);


        const fullPost = await pool.query(`
            select sp.*, u.username, u.full_name, u.profile_picture,
                   0 as like_count, 0 as comment_count, false as liked_by_me
            from social_posts sp
            join users u on sp.user_id = u.user_id
            where sp.post_id = $1
        `, [result.rows[0].post_id]);

        res.status(201).json(fullPost.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// only owner er jonno edit option 
app.put('/api/posts/:id', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.userId;
    const { content, image } = req.body;

    try {

        const ownerCheck = await pool.query('select user_id from social_posts where post_id = $1', [postId]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        if (ownerCheck.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'You can only edit your own posts' });
        }

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Post content cannot be empty' });
        }

        const query = `
            update social_posts 
            set content = $1, image = $2, updated_at = now()
            where post_id = $3
            returning *
        `;
        const result = await pool.query(query, [content.trim(), image !== undefined ? image : null, postId]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update post' });
    }
});

// delete
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.userId;

    try {
        const ownerCheck = await pool.query('select user_id from social_posts where post_id = $1', [postId]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Post painai' });
        }
        if (ownerCheck.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'You can only delete your own posts' });
        }

        await pool.query('delete from social_posts where post_id = $1', [postId]);
        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete post sad' });
    }
});

// like
app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.userId;

    try {

        const existing = await pool.query(
            'select * from post_likes where post_id = $1 and user_id = $2',
            [postId, userId]
        );

        if (existing.rows.length > 0) {

            await pool.query('delete from post_likes where post_id = $1 and user_id = $2', [postId, userId]);
            const countResult = await pool.query('select count(*)::int as like_count from post_likes where post_id = $1', [postId]);
            res.json({ liked: false, like_count: countResult.rows[0].like_count });
        } else {
            // Like
            await pool.query('insert into post_likes (post_id, user_id) values ($1, $2)', [postId, userId]);
            const countResult = await pool.query('select count(*)::int as like_count from post_likes where post_id = $1', [postId]);
            res.json({ liked: true, like_count: countResult.rows[0].like_count });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to like' });
    }
});

// comments
app.get('/api/posts/:id/comments', async (req, res) => {
    const postId = req.params.id;

    try {
        const query = `
            select pc.*, u.username, u.full_name, u.profile_picture
            from post_comments pc
            join users u on pc.user_id = u.user_id
            where pc.post_id = $1
            order by pc.created_at asc
        `;
        const result = await pool.query(query, [postId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// cmnt add
app.post('/api/posts/:id/comments', authenticateToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.userId;
    const { content, parent_id } = req.body;

    try {
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment cannot be empty' });
        }

        const query = `
            insert into post_comments (post_id, user_id, content, parent_id)
            values ($1, $2, $3, $4)
            returning *
        `;
        const result = await pool.query(query, [postId, userId, content.trim(), parent_id || null]);

        // Return with user info
        const fullComment = await pool.query(`
            select pc.*, u.username, u.full_name, u.profile_picture
            from post_comments pc
            join users u on pc.user_id = u.user_id
            where pc.comment_id = $1
        `, [result.rows[0].comment_id]);

        res.status(201).json(fullComment.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// owner delete kore commnt
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
    const commentId = req.params.id;
    const userId = req.user.userId;

    try {
        const ownerCheck = await pool.query('select user_id from post_comments where comment_id = $1', [commentId]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        if (ownerCheck.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }

        await pool.query('delete from post_comments where comment_id = $1', [commentId]);
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// movie rating 
app.post('/api/movies/:id/rate', authenticateToken, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.user.userId;
    const { rating } = req.body;

    try {
        if (!rating || rating < 1 || rating > 10) {
            return res.status(400).json({ error: 'Rating must be between 1 and 10' });
        }

        const upsertQuery = `
            insert into movie_ratings (movie_id, user_id, rating)
            values ($1, $2, $3)
            on conflict (movie_id, user_id)
            DO update set rating = $3
            returning *
        `;
        await pool.query(upsertQuery, [movieId, userId, rating]);

        //average
        const blendedStats = await pool.query(`
            select 
                m.vote_average as imdb_avg,
                m.vote_count as imdb_votes,
                coalesce(avg(r.rating), 0)::numeric(4,2) as user_avg,
                coalesce(count(r.rating), 0)::int as user_count
            from movies m
            left join movie_ratings r on r.movie_id = m.id
            where m.id = $1
            group by m.vote_average, m.vote_count
        `, [movieId]);

        let avg_rating, total_ratings;
        if (blendedStats.rows.length > 0) {
            const row = blendedStats.rows[0];
            const imdbAvg = parseFloat(row.imdb_avg || 0);
            const imdbVotes = parseInt(row.imdb_votes || 0);
            const userAvg = parseFloat(row.user_avg || 0);
            const userCount = parseInt(row.user_count || 0);

            total_ratings = imdbVotes + userCount;
            avg_rating = total_ratings > 0
                ? ((imdbAvg * imdbVotes + userAvg * userCount) / total_ratings)
                : 0;
            avg_rating = Math.round(avg_rating * 10) / 10;
        } else {
            avg_rating = parseFloat(rating);
            total_ratings = 1;
        }

        res.json({
            message: 'Rating saved',
            my_rating: parseFloat(rating),
            avg_rating: avg_rating,
            total_ratings: total_ratings
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save rating' });
    }
});

// rating get 
app.get('/api/movies/:id/rating', async (req, res) => {
    const movieId = req.params.id;

    try {
        let myRating = null;
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const userRating = await pool.query(
                    'select rating from movie_ratings where movie_id = $1 and user_id = $2',
                    [movieId, decoded.userId]
                );
                if (userRating.rows.length > 0) {
                    myRating = parseFloat(userRating.rows[0].rating);
                }
            } catch (e) { }
        }

        // rating mix kore calculate
        const blendedStats = await pool.query(`
            select 
                m.vote_average as imdb_avg,
                m.vote_count as imdb_votes,
                coalesce(avg(r.rating), 0)::numeric(4,2) as user_avg,
                coalesce(count(r.rating), 0)::int as user_count
            from movies m
            left join movie_ratings r on r.movie_id = m.id
            where m.id = $1
            group by m.vote_average, m.vote_count
        `, [movieId]);

        let avg_rating = 0, total_ratings = 0;
        if (blendedStats.rows.length > 0) {
            const row = blendedStats.rows[0];
            const imdbAvg = parseFloat(row.imdb_avg || 0);
            const imdbVotes = parseInt(row.imdb_votes || 0);
            const userAvg = parseFloat(row.user_avg || 0);
            const userCount = parseInt(row.user_count || 0);
            total_ratings = imdbVotes + userCount;
            avg_rating = total_ratings > 0
                ? Math.round(((imdbAvg * imdbVotes + userAvg * userCount) / total_ratings) * 10) / 10
                : 0;
        }

        res.json({
            avg_rating: avg_rating,
            total_ratings: total_ratings,
            my_rating: myRating
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch rating' });
    }
});
//movie cmnts
app.get('/api/movies/:id/comments', async (req, res) => {
    const movieId = req.params.id;
    try {
        const query = `
            select mc.*, u.username, u.full_name, u.profile_picture
            from movie_comments mc
            join users u on mc.user_id = u.user_id
            where mc.movie_id = $1
            order by mc.created_at asc
        `;
        const result = await pool.query(query, [movieId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// movie cmnt add
app.post('/api/movies/:id/comments', authenticateToken, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.user.userId;
    const { content, parent_id } = req.body;

    try {
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment cannot be empty' });
        }

        const result = await pool.query(
            'insert into movie_comments (movie_id, user_id, content, parent_id) values ($1, $2, $3, $4) returning *',
            [movieId, userId, content.trim(), parent_id || null]
        );

        const fullComment = await pool.query(`
            select mc.*, u.username, u.full_name, u.profile_picture
            from movie_comments mc
            join users u on mc.user_id = u.user_id
            where mc.comment_id = $1
        `, [result.rows[0].comment_id]);

        res.status(201).json(fullComment.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// movie cmnt delete
app.delete('/api/movie-comments/:id', authenticateToken, async (req, res) => {
    const commentId = req.params.id;
    const userId = req.user.userId;

    try {
        const check = await pool.query('select user_id from movie_comments where comment_id = $1', [commentId]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
        if (check.rows[0].user_id !== userId) return res.status(403).json({ error: 'You can only delete your own comments' });

        await pool.query('delete from movie_comments where comment_id = $1', [commentId]);
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

//watchlist
app.post('/api/movies/:id/watchlist', authenticateToken, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.user.userId;
    try {
        const existing = await pool.query('select * from watchlist where user_id = $1 and movie_id = $2', [userId, movieId]);
        if (existing.rows.length > 0) {
            await pool.query('delete from watchlist where user_id = $1 and movie_id = $2', [userId, movieId]);
            res.json({ in_watchlist: false });
        } else {
            await pool.query('insert into watchlist (user_id, movie_id) values ($1, $2)', [userId, movieId]);
            res.json({ in_watchlist: true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to toggle watchlist' });
    }
});

//fav
app.post('/api/movies/:id/favourite', authenticateToken, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.user.userId;
    try {
        const existing = await pool.query('select * from user_favourites where user_id = $1 and movie_id = $2', [userId, movieId]);
        if (existing.rows.length > 0) {
            await pool.query('delete from user_favourites where user_id = $1 and movie_id = $2', [userId, movieId]);
            res.json({ is_favourite: false });
        } else {
            await pool.query('insert into user_favourites (user_id, movie_id) values ($1, $2)', [userId, movieId]);
            res.json({ is_favourite: true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to toggle favourite' });
    }
});

//watched
app.post('/api/movies/:id/watched', authenticateToken, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.user.userId;
    try {
        const existing = await pool.query('select * from user_watched where user_id = $1 and movie_id = $2', [userId, movieId]);
        if (existing.rows.length > 0) {
            await pool.query('delete from user_watched where user_id = $1 and movie_id = $2', [userId, movieId]);
            res.json({ is_watched: false });
        } else {
            await pool.query('insert into user_watched (user_id, movie_id) values ($1, $2)', [userId, movieId]);
            res.json({ is_watched: true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to toggle watched' });
    }
});

// user status
app.get('/api/movies/:id/status', authenticateToken, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.user.userId;
    try {
        const [wl, fav, watched] = await Promise.all([
            pool.query('select 1 from watchlist where user_id = $1 and movie_id = $2', [userId, movieId]),
            pool.query('select 1 from user_favourites where user_id = $1 and movie_id = $2', [userId, movieId]),
            pool.query('select 1 from user_watched where user_id = $1 and movie_id = $2', [userId, movieId])
        ]);
        res.json({
            in_watchlist: wl.rows.length > 0,
            is_favourite: fav.rows.length > 0,
            is_watched: watched.rows.length > 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// kasakasi same genre movie, ekhane ai dhukaite hobe
app.get('/api/movies/:id/related', async (req, res) => {
    const movieId = req.params.id;
    try {
        const query = `
            select distinct m.id, m.title, m.poster_path, m.vote_average, m.release_date
            from movies m
            join movie_genres mg on m.id = mg.movie_id
            where mg.genre_id in (
                select genre_id from movie_genres where movie_id = $1
            )
            and m.id != $1
            order by m.vote_average desc nulls last
            limit 10
        `;
        const result = await pool.query(query, [movieId]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch related movies' });
    }
});

// abar profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            `select user_id, email, username, full_name, date_of_birth, gender, 
                    phone_number, address, profile_picture, date_joined, is_admin
             from users where user_id = $1`,
            [userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// update kora profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { full_name, phone_number, address, profile_picture } = req.body;

    try {
        const result = await pool.query(
            `update users set 
                full_name = coalesce($1, full_name),
                phone_number = coalesce($2, phone_number),
                address = coalesce($3, address),
                profile_picture = coalesce($4, profile_picture)
             where user_id = $5
             returning user_id, email, username, full_name, date_of_birth, gender, 
                       phone_number, address, profile_picture, created_at`,
            [full_name, phone_number, address, profile_picture, userId]
        );

        res.json({ message: 'Profile updated', user: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// password change wow
app.put('/api/profile/password', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { current_password, new_password } = req.body;

    try {
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Both current and new password are required sad' });
        }
        if (new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        // verify current password
        const user = await pool.query('select password from users where user_id = $1', [userId]);
        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(current_password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // abar hash koro
        const passwordHash = await bcrypt.hash(new_password, 10);
        await pool.query('update users set password = $1 where user_id = $2', [passwordHash, userId]);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// watchlist get
app.get('/api/profile/watchlist', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            `select w.movie_id, w.created_at as added_at,
                    m.title, m.poster_path, m.vote_average, m.release_date, m.overview
             from watchlist w
             left join movies m on w.movie_id = m.id
             where w.user_id = $1
             order by w.created_at desc`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
});

// watchlist toggle
app.post('/api/movies/:id/wishlist', authenticateToken, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.user.userId;
    try {
        const existing = await pool.query('select * from wishlist where user_id = $1 and movie_id = $2', [userId, movieId]);
        if (existing.rows.length > 0) {
            await pool.query('delete from wishlist where user_id = $1 and movie_id = $2', [userId, movieId]);
            res.json({ in_wishlist: false });
        } else {
            await pool.query('insert into wishlist (user_id, movie_id) values ($1, $2)', [userId, movieId]);
            res.json({ in_wishlist: true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to toggle wishlist' });
    }
});

// wiushlist
app.get('/api/profile/wishlist', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            `select w.movie_id, w.created_at as added_at,
                    m.title, m.poster_path, m.vote_average, m.release_date, m.overview
             from wishlist w
             left join movies m on w.movie_id = m.id
             where w.user_id = $1
             order by w.created_at desc`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch wishlist' });
    }
});

// fav movies with shob kisu

app.get('/api/profile/favourites', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            `select uf.movie_id, uf.created_at as added_at,
                    m.title, m.poster_path, m.vote_average, m.release_date, m.overview
             from user_favourites uf
             left join movies m on uf.movie_id = m.id
             where uf.user_id = $1
             order by uf.created_at desc`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch favourites' });
    }
});

// all rated movies byuser
app.get('/api/profile/ratings', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            `select mr.movie_id, mr.rating, mr.created_at as rated_at,
                    m.title, m.poster_path, m.vote_average, m.release_date
             from movie_ratings mr
             left join movies m on mr.movie_id = m.id
             where mr.user_id = $1
             order by mr.created_at desc`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch ratings' });
    }
});

// actor director follow
app.post('/api/people/:id/follow', authenticateToken, async (req, res) => {
    const personId = req.params.id;
    const userId = req.user.userId;
    const { person_name, person_role, profile_path } = req.body;

    try {
        const existing = await pool.query(
            'select * from favourite_people where user_id = $1 and person_id = $2',
            [userId, personId]
        );
        if (existing.rows.length > 0) {
            await pool.query('delete from favourite_people where user_id = $1 and person_id = $2', [userId, personId]);
            res.json({ is_following: false });
        } else {
            await pool.query(
                'insert into favourite_people (user_id, person_id, person_name, person_role, profile_path) values ($1, $2, $3, $4, $5)',
                [userId, personId, person_name || 'Unknown', person_role || null, profile_path || null]
            );
            res.json({ is_following: true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to toggle follow' });
    }
});

// followed lsit
app.get('/api/profile/favourite-people', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            `select * from favourite_people where user_id = $1 order by created_at desc`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch favourite people' });
    }
});

// genre preference
app.put('/api/profile/interests', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { genre_ids } = req.body;

    const client = await pool.connect();
    try {
        await client.query('begin');
        await client.query('delete from user_interests where user_id = $1', [userId]);
        if (genre_ids && genre_ids.length > 0) {
            const values = genre_ids.map((gid, i) => `($1, $${i + 2})`).join(', ');
            const params = [userId, ...genre_ids];
            await client.query(`insert into user_interests (user_id, genre_id) values ${values}`, params);
        }
        await client.query('commit');

        // genre select update er query
        const result = await pool.query(
            `select ui.genre_id, g.name as genre_name
             from user_interests ui
             left join genres g on ui.genre_id = g.id
             where ui.user_id = $1`,
            [userId]
        );
        res.json({ message: 'Interests updated', interests: result.rows });
    } catch (error) {
        await client.query('rollback');
        console.error(error);
        res.status(500).json({ error: 'Failed to update interests' });
    } finally {
        client.release();
    }
});

//stat dashboard
app.get('/api/profile/stats', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        // koyta dekhse
        const watchedCount = await pool.query(
            'select count(*)::int as count from user_watched where user_id = $1', [userId]
        );


        const avgRating = await pool.query(
            'select coalesce(avg(rating), 0)::numeric(3,1) as avg from movie_ratings where user_id = $1', [userId]
        );

        const ratingsCount = await pool.query(
            'select count(*)::int as count from movie_ratings where user_id = $1', [userId]
        );

        const watchlistCount = await pool.query(
            'select count(*)::int as count from watchlist where user_id = $1', [userId]
        );

        const favouritesCount = await pool.query(
            'select count(*)::int as count from user_favourites where user_id = $1', [userId]
        );

        const genreDistribution = await pool.query(
            `select g.name, count(*)::int as count
             from user_watched uw
             join movie_genres mg on uw.movie_id = mg.movie_id
             join genres g on mg.genre_id = g.id
             where uw.user_id = $1
             group by g.name
             order by count desc
             limit 10`,
            [userId]
        );

        const ratingDistribution = await pool.query(
            `select floor(rating)::int as rating_value, count(*)::int as count
             from movie_ratings
             where user_id = $1
             group by floor(rating)
             order by rating_value`,
            [userId]
        );

        const monthlyActivity = await pool.query(
            `select 
                to_char(created_at, 'YYYY-MM') as month,
                count(*)::int as activity_count
             from user_activity
             where user_id = $1 and created_at >= now() - interval '6 months'
             group by to_char(created_at, 'YYYY-MM')
             order by month`,
            [userId]
        );

        const recentActivity = await pool.query(
            `select ua.*, m.title as movie_title, m.poster_path
             from user_activity ua
             left join movies m on ua.movie_id = m.id
             where ua.user_id = $1
             order by ua.created_at desc
             limit 20`,
            [userId]
        );

        const interests = await pool.query(
            `select ui.genre_id, g.name as genre_name
             from user_interests ui
             left join genres g on ui.genre_id = g.id
             where ui.user_id = $1`,
            [userId]
        );

        res.json({
            movies_watched: watchedCount.rows[0].count,
            avg_rating: parseFloat(avgRating.rows[0].avg),
            total_ratings: ratingsCount.rows[0].count,
            watchlist_count: watchlistCount.rows[0].count,
            favourites_count: favouritesCount.rows[0].count,
            genre_distribution: genreDistribution.rows,
            rating_distribution: ratingDistribution.rows,
            monthly_activity: monthlyActivity.rows,
            recent_activity: recentActivity.rows,
            interests: interests.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// wishlist status
app.get('/api/movies/:id/wishlist-status', authenticateToken, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            'select 1 from wishlist where user_id = $1 and movie_id = $2',
            [userId, movieId]
        );
        res.json({ in_wishlist: result.rows.length > 0 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch wishlist status' });
    }
});

// all genre
// smartly search suggest kora
app.get('/api/movies/search', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) {
            return res.json([]);
        }

        const moviesResult = await pool.query(
            `select 
               m.id, 
               m.title, 
               m.poster_path, 
               m.release_date, 
               m.overview,
               'movie' as type,
               coalesce(round(avg(r.rating)::numeric, 1), 0)::float as avg_rating,
               coalesce(count(r.rating), 0)::int as rating_count
             from movies m
             left join movie_ratings r on r.movie_id = m.id
             where m.title ilike $1
             group by m.id, m.title, m.poster_path, m.release_date, m.overview
             ORDER bY m.title asc
             LIMIt 5`,
            [`%${q}%`]
        );

        const seriesesResult = await pool.query(
            `select 
               s.tmdb_id as id, 
               s.name as title, 
               s.poster_path, 
               s.first_air_date as release_date, 
               s.overview,
               'series' as type,
               coalesce(round(avg(r.rating)::numeric, 1), 0)::float as avg_rating,
               coalesce(count(r.rating), 0)::int as rating_count
             from serieses s
             left join series_ratings r on r.series_id = s.tmdb_id
             where s.name ilike $1
             group by s.tmdb_id, s.name, s.poster_path, s.first_air_date, s.overview
             ORDER bY s.name asc
             LIMIt 5`,
            [`%${q}%`]
        );

        const combined = [...moviesResult.rows, ...seriesesResult.rows];
        combined.sort((a, b) => a.title.localeCompare(b.title));
        return res.json(combined.slice(0, 8));
    } catch (error) {
        console.error('Movie search error:', error);
        return res.status(500).json({ error: 'Failed to fetch movie suggestions' });
    }
});

// @ diye mention kora
app.get('/api/movies/mention', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return res.json([]);
        const result = await pool.query(
            `select 
               m.id,
               m.title,
               m.poster_path,
               m.release_date,
               coalesce(round(avg(r.rating)::numeric, 1), 0)::float as avg_rating,
               coalesce(count(r.rating), 0)::int as rating_count
             from movies m
             left join movie_ratings r on r.movie_id = m.id
             where m.title ilike '%' || $1 || '%'
             group by m.id, m.title, m.poster_path, m.release_date
             order by rating_count desc, avg_rating desc, m.title asc
             limit 3`,
            [q]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Movie mention search error:', error);
        return res.status(500).json({ error: 'Failed to fetch mention suggestions' });
    }
});

// exact title neyar jonno jaate @inters dile blue hoye @interstellar na dekhai
app.get('/api/movies/resolve', async (req, res) => {
    try {
        const title = (req.query.title || '').trim();
        if (!title) return res.status(400).json({ error: 'title is required' });
        const result = await pool.query(
            `select id, title from movies where lower(title) = lower($1) limit 1`,
            [title]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        return res.json(result.rows[0]);
    } catch (err) {
        console.error('Movie exact resolve error:', err);
        return res.status(500).json({ error: 'Failed to resolve title' });
    }
});

// Global mention search (Movies + Series)
app.get('/api/mention/search', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();

        let movies, series;
        if (!q) {
            // top 5
            movies = await pool.query(`select id, title as name, poster_path, 'movie' as type, release_date, popularity from movies order by popularity desc limit 5`);
            series = await pool.query(`select tmdb_id as id, name, poster_path, 'series' as type, first_air_date as release_date, popularity from serieses order by popularity desc limit 5`);
        } else {
            // naile khujlam
            movies = await pool.query(
                `select id, title as name, poster_path, 'movie' as type, release_date, popularity 
                 from movies where title ilike $1 order by popularity desc limit 5`,
                [`%${q}%`]
            );
            series = await pool.query(
                `select tmdb_id as id, name, poster_path, 'series' as type, first_air_date as release_date, popularity
                 from serieses where name ilike $1 order by popularity desc limit 5`,
                [`%${q}%`]
            );
        }

        const combined = [...movies.rows, ...series.rows].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        res.json(combined);
    } catch (err) {
        console.error('Mention search error:', err);
        res.status(500).json({ error: 'Search failed', details: err.message });
    }
});

app.get('/api/movies/mention/resolve', async (req, res) => {
    try {
        const text = (req.query.text || '').trim();
        const type = req.query.type || 'movie';
        const id = req.query.id;

        if (id) {
            const table = type === 'series' ? 'serieses' : 'movies';
            const idCol = type === 'series' ? 'tmdb_id' : 'id';
            const nameCol = type === 'series' ? 'name' : 'title';
            const result = await pool.query(`select ${idCol} as id, ${nameCol} as title, poster_path from ${table} where ${idCol} = $1`, [id]);
            if (result.rows.length > 0) return res.json(result.rows[0]);
        }

        if (!text) return res.status(400).json({ error: 'text is required' });
        const result = await pool.query(
            `select id, title, poster_path, 'movie' as type
             from movies m
             where lower($1) like lower(m.title) || '%'
             order by length(m.title) desc
             limit 1`,
            [text]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        return res.json(result.rows[0]);
    } catch (err) {
        console.error('Mention resolve error:', err);
        return res.status(500).json({ error: 'Failed to resolve mention' });
    }
});

app.get('/api/genres', async (req, res) => {
    try {
        const result = await pool.query('select id, name from genres order by name');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});

app.get('/api/series/top', async (req, res) => {
    try {
        const result = await pool.query('select * from serieses limit 1');
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        }
        else {
            res.status(404).json({ error: 'kisui pailam na' });
        }
    }
    catch (error) {
        console.error("cant find", error);
        res.status(500).json({ error: 'server error' });
    }
});

// series details

app.get('/api/series/:id/rating', async (req, res) => {
    try {
        const { id } = req.params;
        let myRating = null;

        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            try {
                const user = jwt.verify(token, process.env.JWT_SECRET);
                // series_ratings.series_id corresponds to serieses.tmdb_id
                const userRatingRes = await pool.query('select rating from series_ratings where series_id = $1 and user_id = $2', [id, user.userId]);
                if (userRatingRes.rows.length > 0) {
                    myRating = parseFloat(userRatingRes.rows[0].rating);
                }
            } catch (e) { }
        }

        const blended = await pool.query(`
            select 
                s.vote_average as imdb_avg,
                s.vote_count as imdb_votes,
                coalesce(avg(r.rating), 0)::numeric(4,2) as user_avg,
                coalesce(count(r.rating), 0)::int as user_count
            from serieses s
            left join series_ratings r on r.series_id = s.tmdb_id
            where s.tmdb_id = $1
            group by s.vote_average, s.vote_count
        `, [id]);

        if (blended.rows.length > 0) {
            const row = blended.rows[0];
            const imdbAvg = parseFloat(row.imdb_avg || 0);
            const imdbVotes = parseInt(row.imdb_votes || 0);
            const userAvg = parseFloat(row.user_avg || 0);
            const userCount = parseInt(row.user_count || 0);
            const total_ratings = imdbVotes + userCount;
            const avg_rating = total_ratings > 0
                ? Math.round(((imdbAvg * imdbVotes + userAvg * userCount) / total_ratings) * 10) / 10
                : 0;
            res.json({ avg_rating, total_ratings, my_rating: myRating });
        } else {
            res.json({ avg_rating: 0, total_ratings: 0, my_rating: myRating });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch series rating' });
    }
});

app.post('/api/series/:id/rate', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user.userId;

    try {
        if (!rating || rating < 1 || rating > 10) {
            return res.status(400).json({ error: 'Rating must be between 1 and 10' });
        }

        // series_ratings 
        await pool.query(
            `insert into series_ratings (series_id, user_id, rating) 
             values ($1, $2, $3) 
             on conflict (series_id, user_id) 
             DO update set rating = excluded.rating`,
            [id, userId, rating]
        );

        const blended = await pool.query(`
            select 
                s.vote_average as imdb_avg,
                s.vote_count as imdb_votes,
                coalesce(avg(r.rating), 0)::numeric(4,2) as user_avg,
                coalesce(count(r.rating), 0)::int as user_count
            from serieses s
            left join series_ratings r on r.series_id = s.tmdb_id
            where s.tmdb_id = $1
            group by s.vote_average, s.vote_count
        `, [id]);

        let avg_rating = parseFloat(rating), total_ratings = 1;
        if (blended.rows.length > 0) {
            const row = blended.rows[0];
            const imdbAvg = parseFloat(row.imdb_avg || 0);
            const imdbVotes = parseInt(row.imdb_votes || 0);
            const userAvg = parseFloat(row.user_avg || 0);
            const userCount = parseInt(row.user_count || 0);
            total_ratings = imdbVotes + userCount;
            avg_rating = total_ratings > 0
                ? Math.round(((imdbAvg * imdbVotes + userAvg * userCount) / total_ratings) * 10) / 10
                : 0;
        }

        res.json({
            message: 'Rating saved successfully',
            my_rating: parseFloat(rating),
            avg_rating: avg_rating,
            total_ratings: total_ratings
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save rating' });
    }
});

app.get('/api/series/:id/status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const [watchlistRes, favRes, watchedRes] = await Promise.all([
            pool.query('select 1 from user_series_watchlist where user_id = $1 and series_id = $2', [userId, id]),
            pool.query('select 1 from user_series_favourites where user_id = $1 and series_id = $2', [userId, id]),
            pool.query('select 1 from user_series_watched where user_id = $1 and series_id = $2', [userId, id])
        ]);

        res.json({
            in_watchlist: watchlistRes.rows.length > 0,
            is_favourite: favRes.rows.length > 0,
            is_watched: watchedRes.rows.length > 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

app.post('/api/series/:id/watchlist', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const check = await pool.query('select 1 from user_series_watchlist where user_id = $1 and series_id = $2', [userId, id]);
        if (check.rows.length > 0) {
            await pool.query('delete from user_series_watchlist where user_id = $1 and series_id = $2', [userId, id]);
            res.json({ in_watchlist: false, message: 'Removed from watchlist' });
        } else {
            await pool.query('insert into user_series_watchlist (user_id, series_id) values ($1, $2)', [userId, id]);
            res.json({ in_watchlist: true, message: 'Added to watchlist' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle watchlist' });
    }
});

app.post('/api/series/:id/favourite', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const check = await pool.query('select 1 from user_series_favourites where user_id = $1 and series_id = $2', [userId, id]);
        if (check.rows.length > 0) {
            await pool.query('delete from user_series_favourites where user_id = $1 and series_id = $2', [userId, id]);
            res.json({ is_favourite: false, message: 'Removed from favourites' });
        } else {
            await pool.query('insert into user_series_favourites (user_id, series_id) values ($1, $2)', [userId, id]);
            res.json({ is_favourite: true, message: 'Added to favourites' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle favourite' });
    }
});

app.post('/api/series/:id/watched', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const check = await pool.query('select 1 from user_series_watched where user_id = $1 and series_id = $2', [userId, id]);
        if (check.rows.length > 0) {
            await pool.query('delete from user_series_watched where user_id = $1 and series_id = $2', [userId, id]);
            res.json({ is_watched: false, message: 'Removed from watched' });
        } else {
            await pool.query('insert into user_series_watched (user_id, series_id) values ($1, $2)', [userId, id]);
            res.json({ is_watched: true, message: 'Added to watched check' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle watched' });
    }
});

app.get('/api/series/:id/comments', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            select c.*, u.username, u.full_name, u.profile_picture 
            from series_comments c
            join users u on c.user_id = u.user_id
            where c.series_id = $1
            order by c.created_at asc
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

app.post('/api/series/:id/comments', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { content, parent_id } = req.body;
    const userId = req.user.userId;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content is required' });
    }

    try {
        const result = await pool.query(
            `insert into series_comments (series_id, user_id, content, parent_id) 
             values ($1, $2, $3, $4) returning *`,
            [id, userId, content.trim(), parent_id || null]
        );

        const comment = result.rows[0];
        const userRes = await pool.query('select username, full_name, profile_picture from users where user_id = $1', [userId]);
        const user = userRes.rows[0];

        res.status(201).json({
            ...comment,
            username: user.username,
            full_name: user.full_name,
            profile_picture: user.profile_picture
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to post comment' });
    }
});

app.delete('/api/series-comments/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const check = await pool.query('select user_id from series_comments where comment_id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });

        if (check.rows[0].user_id !== userId && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }

        await pool.query('delete from series_comments where comment_id = $1', [id]);
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});




// friend treind

app.get('/api/users/search', async (req, res) => {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    try {
        const query = `
            select user_id, username, full_name, profile_picture 
            from users 
            where username ilike $1 or full_name ilike $1 
            limit 20
        `;
        const result = await pool.query(query, [`%${q}%`]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/api/users/:id/profile', optionalAuthenticate, async (req, res) => {
    const targetUserId = req.params.id;
    const currentUserId = req.user ? req.user.userId : null;
    try {
        const userRes = await pool.query(
            'select user_id, username, full_name, profile_picture, date_joined from users where user_id = $1',
            [targetUserId]
        );
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        let friendStatus = 'none';
        let actionUserId = null;
        if (currentUserId && currentUserId !== parseInt(targetUserId)) {
            const fRes = await pool.query(
                `select status, requester_id from friend_requests 
                 where (requester_id = $1 and receiver_id = $2) 
                    or (requester_id = $2 and receiver_id = $1)`,
                [currentUserId, targetUserId]
            );
            if (fRes.rows.length > 0) {
                friendStatus = fRes.rows[0].status;
                actionUserId = fRes.rows[0].requester_id;
            }
        }
        
        const watchedCount = await pool.query('select count(*)::int as count from user_watched where user_id = $1', [targetUserId]);
        const avgRating = await pool.query('select coalesce(avg(rating), 0)::numeric(3,1) as avg from movie_ratings where user_id = $1', [targetUserId]);
        const ratingsCount = await pool.query('select count(*)::int as count from movie_ratings where user_id = $1', [targetUserId]);
        const interests = await pool.query(
            `select ui.genre_id, g.name as genre_name
             from user_interests ui
             left join genres g on ui.genre_id = g.id
             where ui.user_id = $1`, [targetUserId]
        );
        
        const stats = {
            watched: watchedCount.rows[0].count,
            avgRating: avgRating.rows[0].avg,
            ratings: ratingsCount.rows[0].count,
        };
        const favoriteGenres = interests.rows.map(row => row.genre_name).filter(name => name);

        res.json({ ...userRes.rows[0], friendStatus, actionUserId, stats, favoriteGenres });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load profile' });
    }
});

app.get('/api/users/:id/posts', optionalAuthenticate, async (req, res) => {
    // Current user poster pike dekhte parbe
    const currentUserId = req.user ? req.user.userId : null;
    try {
        const query = `
            select sp.*, u.username, u.full_name, u.profile_picture,
                   (select count(*) from post_likes where post_id = sp.post_id) as like_count,
                   (select count(*) from post_comments where post_id = sp.post_id) as comment_count,
                   case when $2::int is not null and exists(select 1 from post_likes where post_id = sp.post_id and user_id = $2) then true else false end as liked_by_me
            from social_posts sp
            join users u on sp.user_id = u.user_id
            where sp.user_id = $1
            order by sp.created_at desc
        `;
        const result = await pool.query(query, [req.params.id, currentUserId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

app.post('/api/friends/request/:id', authenticateToken, async (req, res) => {
    const targetUserId = req.params.id;
    const currentUserId = req.user.userId;
    if (currentUserId == targetUserId) return res.status(400).json({ error: 'Cannot add yourself' });
    try {
        await pool.query('begin');
        const fRes = await pool.query(
            `insert into friend_requests (requester_id, receiver_id, status)
             values ($1, $2, 'pending')
             on conflict (requester_id, receiver_id) do nothing returning id`,
            [currentUserId, targetUserId]
        );
        const revRes = await pool.query(`select id from friend_requests where requester_id = $1 and receiver_id = $2`, [targetUserId, currentUserId]);
        if (fRes.rows.length > 0) {
            const uRes = await pool.query('select username from users where user_id = $1', [currentUserId]);
            await createNotification(targetUserId, currentUserId, 'friend_request', `${uRes.rows[0].username} sent you a friend request`);
        } else if (revRes.rows.length > 0) {
            return res.status(400).json({ error: 'Request already exists' });
        }
        await pool.query('commit');
        res.json({ message: 'Request sent' });
    } catch (err) {
        await pool.query('rollback');
        res.status(500).json({ error: 'Action failed' });
    }

});

app.post('/api/friends/accept/:id', authenticateToken, async (req, res) => {
    const requesterId = req.params.id;
    const currentUserId = req.user.userId;
    try {
        await pool.query('begin');
        const upd = await pool.query(
            `update friend_requests set status = 'accepted', updated_at = now() 
             where requester_id = $1 and receiver_id = $2 returning id`,
            [requesterId, currentUserId]
        );
        if (upd.rows.length > 0) {
            const uRes = await pool.query('select username from users where user_id = $1', [currentUserId]);
            await createNotification(requesterId, currentUserId, 'friend_accept', `${uRes.rows[0].username} accepted your friend request`);
            await pool.query(
                `update notifications set is_read = TRUE where user_id = $1 and sender_id = $2 and type = 'friend_request'`,
                [currentUserId, requesterId]
            );
        }
        await pool.query('commit');
        res.json({ message: 'Accepted' });
    } catch (err) {
        await pool.query('rollback');
        res.status(500).json({ error: 'Accept failed' });
    }
});

app.post('/api/friends/reject/:id', authenticateToken, async (req, res) => {
    const targetUserId = req.params.id;
    const currentUserId = req.user.userId;
    try {
        await pool.query(
            `delete from friend_requests where (requester_id = $1 and receiver_id = $2) or (requester_id = $2 and receiver_id = $1)`,
            [currentUserId, targetUserId]
        );
        res.json({ message: 'Removed' });
    } catch (err) {
        res.status(500).json({ error: 'Reject failed' });
    }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const uId = req.user.userId || req.user.id || req.user.user_id;
        console.log(`[Notifications] Fetching for UID: ${uId}`);
        const result = await pool.query(
            `select n.*, u.username as sender_username, u.profile_picture as sender_picture
             from notifications n left join users u on n.sender_id = u.user_id
             where n.user_id = $1 order by n.created_at desc limit 50`,
            [uId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[Notifications] Fetch Error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        await pool.query('update notifications set is_read = TRUE where id = $1 and user_id = $2', [req.params.id, req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark read' });
    }
});


// dm er panel
app.get('/api/messages/friends', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            select u.user_id, u.username, u.full_name, u.profile_picture 
            from friend_requests f
            join users u on (f.requester_id = u.user_id or f.receiver_id = u.user_id)
            where f.status = 'accepted' 
              and (f.requester_id = $1 or f.receiver_id = $1)
              and u.user_id != $1
        `, [req.user.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch friends' });
    }
});

// chat history neya
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            select * from direct_messages 
            where (sender_id = $1 and receiver_id = $2) 
               or (sender_id = $2 and receiver_id = $1)
            order by created_at asc
            limit 200
        `, [req.user.userId, req.params.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// all e shobai
app.get('/api/chat/conversations', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(`
            WITH last_messages as (
                select distinct on (partner_id)
                    case when sender_id = $1 then receiver_id else sender_id end as partner_id,
                    message,
                    created_at,
                    sender_id
                from direct_messages
                where sender_id = $1 or receiver_id = $1
                order by partner_id, created_at desc
            ),
            unread_counts as (
                select sender_id as partner_id, count(*)::int as unread_count
                from direct_messages
                where receiver_id = $1 and read_at is null
                group by sender_id
            )
            select lm.*, u.username, u.full_name, u.profile_picture, coalesce(uc.unread_count, 0) as unread_count
            from last_messages lm
            join users u on lm.partner_id = u.user_id
            left join unread_counts uc on lm.partner_id = uc.partner_id
            order by lm.created_at desc
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// Global unread total
app.get('/api/chat/unread-total', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'select count(*)::int as total from direct_messages where receiver_id = $1 and read_at is null',
            [req.user.userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch unread total' });
    }
});

//Search users for chat
app.get('/api/chat/search', authenticateToken, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const result = await pool.query(`
            select user_id, username, full_name, profile_picture from users 
            where (username ilike $1 or full_name ilike $1) and user_id != $2
            limit 10
        `, [`%${q}%`, req.user.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
});

//  message read hoi
app.post('/api/chat/read/:partnerId', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'update direct_messages set read_at = now() where receiver_id = $1 and sender_id = $2 and read_at is null',
            [req.user.userId, req.params.partnerId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark read' });
    }
});

// Discussions feed
app.get('/api/discussions/feed', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            select d.*, u.username as creator_username, m.title as movie_title, m.poster_path
            from discussions d
            join users u on d.creator_id = u.user_id
            left join movies m on d.movie_id = m.id
            where d.access_level = 'public' 
               or d.creator_id = $1 
               or exists (select 1 from discussion_participants dp where dp.discussion_id = d.id and dp.user_id = $1)
            order by d.created_at desc
            limit 50
        `, [req.user.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch discussions feed' });
    }
});

// Create discussion
app.post('/api/discussions', authenticateToken, async (req, res) => {
    const { movie_id, title, access_level, max_participants } = req.body;
    try {
        await pool.query('begin');
        const dRes = await pool.query(`
            insert into discussions (creator_id, movie_id, title, access_level, max_participants)
            values ($1, $2, $3, $4, $5) returning *
        `, [req.user.userId, movie_id || null, title, access_level || 'public', max_participants || null]);

        const newGroup = dRes.rows[0];
        // Add creator admin hishebe
        await pool.query(`insert into discussion_participants (discussion_id, user_id, role) values ($1, $2, 'admin')`, [newGroup.id, req.user.userId]);
        await pool.query('commit');
        res.json(newGroup);
    } catch (err) {
        await pool.query('rollback');
        res.status(500).json({ error: 'Failed to create discussion' });
    }
});

// discussion er history neya
app.get('/api/discussions/:id', authenticateToken, async (req, res) => {
    try {
        const dRes = await pool.query(`
            select d.*, m.title as movie_title, m.poster_path 
            from discussions d left join movies m on d.movie_id = m.id where d.id = $1
        `, [req.params.id]);
        if (dRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const msgRes = await pool.query(`
            select dm.*, u.username as sender_username, u.profile_picture as sender_picture 
            from discussion_messages dm
            join users u on dm.sender_id = u.user_id
            where dm.discussion_id = $1
            order by dm.created_at asc limit 100
        `, [req.params.id]);

        res.json({ discussion: dRes.rows[0], messages: msgRes.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch discussion' });
    }
});


// SOCIAL DISCOVERY ROUTES

// friend suggest kore
app.get('/api/social/suggested-friends', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(`
            WITH my_friends as (
                select case when requester_id = $1 then receiver_id else requester_id end as friend_id
                from friend_requests
                where status = 'accepted' and (requester_id = $1 or receiver_id = $1)
            ),
            candidates as (
                select u.user_id, u.username, u.full_name, u.profile_picture
                from users u
                where u.user_id != $1
                  and u.user_id not in (select friend_id from my_friends)
                  and u.user_id not in (
                      select case when requester_id = $1 then receiver_id else requester_id end
                      from friend_requests
                      where requester_id = $1 or receiver_id = $1
                  )
            ),
            mutual_score as (
                select c.user_id, count(*)::int as mutual_count
                from candidates c
                join friend_requests fr on fr.status = 'accepted'
                    and (
                        (fr.requester_id = c.user_id and fr.receiver_id in (select friend_id from my_friends))
                        or (fr.receiver_id = c.user_id and fr.requester_id in (select friend_id from my_friends))
                    )
                group by c.user_id
            ),
            genre_score as (
                select c.user_id, count(*)::int as genre_count,
                       string_agg(g.name, ', ' order by g.name) as shared_genres
                from candidates c
                join user_interests ui_them on ui_them.user_id = c.user_id
                join user_interests ui_me   on ui_me.user_id = $1 and ui_me.genre_id = ui_them.genre_id
                join genres g on g.id = ui_them.genre_id
                group by c.user_id
            ),
            taste_score as (
                select c.user_id,
                       coalesce(sum(GREATEST(0, (5 - ABS(r_them.rating - r_me.rating)) * 2)), 0)::int as taste_pts
                from candidates c
                join movie_ratings r_them on r_them.user_id = c.user_id
                join movie_ratings r_me   on r_me.user_id = $1 and r_me.movie_id = r_them.movie_id
                where ABS(r_them.rating - r_me.rating) <= 2
                group by c.user_id
            )
            select
                c.user_id, c.username, c.full_name, c.profile_picture,
                coalesce(ms.mutual_count, 0) * 10
                  + coalesce(gs.genre_count, 0) * 4
                  + coalesce(ts.taste_pts, 0) as total_score,
                coalesce(ms.mutual_count, 0)  as mutual_friends,
                coalesce(gs.shared_genres, '') as shared_genres,
                coalesce(gs.genre_count, 0)   as genre_count,
                coalesce(ts.taste_pts, 0)     as taste_pts
            from candidates c
            left join mutual_score ms on ms.user_id = c.user_id
            left join genre_score  gs on gs.user_id = c.user_id
            left join taste_score  ts on ts.user_id = c.user_id
            where coalesce(ms.mutual_count, 0) > 0
               or coalesce(gs.genre_count, 0) > 0
               or coalesce(ts.taste_pts, 0) > 0
            order by total_score desc
            limit 6
        `, [userId]);

        const suggestions = result.rows.map(row => {
            let reason = '';
            if (row.mutual_friends > 0) {
                reason = `${row.mutual_friends} mutual friend${row.mutual_friends > 1 ? 's' : ''}`;
            } else if (row.genre_count > 0) {
                const genres = row.shared_genres.split(', ').slice(0, 2).join(', ');
                reason = `Loves ${genres}`;
            } else if (row.taste_pts > 0) {
                reason = 'Similar movie taste';
            }
            return {
                user_id: row.user_id,
                username: row.username,
                full_name: row.full_name,
                profile_picture: row.profile_picture,
                total_score: row.total_score,
                reason,
                tier: row.mutual_friends > 0 ? 'mutual' : row.genre_count > 0 ? 'genre' : 'taste'
            };
        });

        res.json(suggestions);
    } catch (err) {
        console.error('[Social] Suggested friends error:', err.message);
        res.json([]);
    }
});

// Community stats soical e
app.get('/api/social/community-stats', async (req, res) => {
    try {
        const [postCount, userCount, todayActive] = await Promise.all([
            pool.query('select count(*)::int as count from social_posts'),
            pool.query('select count(*)::int as count from users'),
            pool.query(`select count(distinct user_id)::int as count from social_posts where created_at >= now() - interval '24 hours'`)
        ]);
        res.json({
            total_posts: postCount.rows[0].count,
            total_users: userCount.rows[0].count,
            active_today: todayActive.rows[0].count
        });
    } catch (err) {
        console.error('[Social] Community stats error:', err.message);
        res.json({ total_posts: 0, total_users: 0, active_today: 0 });
    }
});


// ADMIN DASHBOARD ROUTES

const logAdminActivity = async (adminId, actionType, targetEntity, targetId, details) => {
    try {
        await pool.query(
            `insert into admin_activity_logs (admin_id, action_type, target_entity, target_id, details) values ($1, $2, $3, $4, $5)`,
            [adminId, actionType, targetEntity, targetId, details]
        );
    } catch (e) {
        console.error('Failed to log admin activity:', e);
    }
};

const createNotification = async (userId, senderId, type, message, relatedId = null) => {
    try {
        console.log(`[Notifications] Creating notif for UID: ${userId}, Type: ${type}`);
        const res = await pool.query(
            `insert into notifications (user_id, sender_id, type, message, related_id, created_at, is_read) 
             values ($1, $2, $3, $4, $5, now(), false) returning *`,
            [userId, senderId, type, message, relatedId]
        );

        if (res.rows.length > 0) {
            const newNotif = res.rows[0];
            let senderInfo = { username: 'System', profile_picture: null };
            if (senderId) {
                const s = await pool.query('select username, profile_picture from users where user_id = $1', [senderId]);
                if (s.rows.length > 0) senderInfo = s.rows[0];
            }

            const payload = {
                ...newNotif,
                sender_username: senderInfo.username,
                sender_picture: senderInfo.profile_picture
            };

            io.to(`user_${userId}`).emit('new_notification', payload);
            console.log(`[Notifications] Real-time emit to user_${userId}`);
        }
    } catch (e) {
        console.error('[Notifications] Creation Error:', e);
    }
};

app.post('/api/social/report', authenticateToken, async (req, res) => {
    const { post_id, comment_id, reason } = req.body;
    const userId = req.user.userId;

    if (!reason || reason.trim() === '') {
        return res.status(400).json({ error: 'Reason is required' });
    }

    try {
        await pool.query(
            `insert into reports (reporter_id, post_id, comment_id, reason) values ($1, $2, $3, $4)`,
            [userId, post_id || null, comment_id || null, reason]
        );
        res.json({ success: true, message: 'Report submitted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query('select user_id, username, email, is_admin, is_super_admin, banned_until from users order by user_id desc');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id/role', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const target = await pool.query('select is_admin, is_super_admin, email from users where user_id = $1', [id]);
        if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const targetUser = target.rows[0];
        if (targetUser.is_super_admin) {
            return res.status(403).json({ error: 'Cannot modify SuperAdmin.' });
        }

        // admin admin ke namaite parbe na
        if (targetUser.is_admin && !req.user.isSuperAdmin) {
            return res.status(403).json({ error: 'Only SuperAdmin can demote an Admin.' });
        }

        const result = await pool.query('update users set is_admin = not is_admin where user_id = $1 returning is_admin, email', [id]);
        const newState = result.rows[0].is_admin;

        // NEW: Refactored to use procedure for multi-step workflow (Update + Log + Notify)
        const adminRes = await pool.query('select username from users where user_id = $1', [req.user.userId]);
        const adminName = adminRes.rows[0].username;

        const logMsg = `Changed admin status to ${newState} for ${result.rows[0].email}`;
        const notifMsg = newState
            ? `Administrator ${adminName} has promoted you to a role with Administrator privileges. Welcome to the team!`
            : `Your Administrator privileges have been revoked by ${adminName}. If you have questions, please contact the SuperAdmin.`;

        await pool.query('CALL sp_update_user_privileges($1, $2, $3, $4, $5)', [
            req.user.userId,
            id,
            newState,
            logMsg,
            notifMsg
        ]);

        res.json({ success: true, is_admin: newState });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id/ban', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { durationMs, reason } = req.body;
    try {
        const target = await pool.query('select is_admin, email, banned_until from users where user_id = $1', [id]);
        if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const targetUser = target.rows[0];

        // standard admins ban admin parbe na
        if (targetUser.is_admin && !req.user.isSuperAdmin) {
            return res.status(403).json({ error: 'Only SuperAdmin can ban an Admin.' });
        }

        const currentlyBanned = targetUser.banned_until && new Date(targetUser.banned_until) > new Date();

        let banUntil = null;
        let action = 'UNBAN_USER';
        let detailMsg = `Unbanned user ${targetUser.email}`;

        if (!currentlyBanned) {
            action = 'BAN_USER';
            let pDuration = 'PERMANENT';
            if (durationMs) {
                banUntil = new Date(Date.now() + durationMs);
                pDuration = durationMs === 86400000 ? '24 Hours' : `${durationMs}ms`;
            } else {
                banUntil = new Date('3000-01-01T00:00:00Z');
            }
            detailMsg = `Banned user ${targetUser.email} for: ${pDuration}. Reason: ${reason || 'Not specified'}`;
        }

        // NEW: Refactored to use procedure for atomic multi-step workflow (Update + Log + Notify)
        const adminRes = await pool.query('select username from users where user_id = $1', [req.user.userId]);
        const adminName = adminRes.rows[0].username;

        let notifMsg = '';
        if (!currentlyBanned) {
            const reasonMsg = reason ? ` Reason: ${reason}` : ' Policy violation.';
            notifMsg = `Your account has been banned by ${adminName}.${reasonMsg}`;
        } else {
            notifMsg = `Your account has been unbanned by ${adminName}. Welcome back!`;
        }

        await pool.query('CALL sp_handle_user_ban($1, $2, $3, $4, $5, $6)', [
            req.user.userId,
            id,
            banUntil,
            action,
            detailMsg,
            notifMsg
        ]);

        res.json({ success: true, banned_until: banUntil });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/movies', authenticateAdmin, async (req, res) => {
    const { tmdb_id, title, original_title, overview, release_date, poster_path, backdrop_path, popularity, vote_average, vote_count, original_language } = req.body;
    try {
        const check = await pool.query('select tmdb_id from movies where tmdb_id = $1', [tmdb_id]);
        if (check.rows.length > 0) {
            await pool.query(
                `update movies set title = $2, original_title = $3, overview = $4, release_date = $5, poster_path = $6, backdrop_path = $7, popularity = $8, vote_average = $9, vote_count = $10, tmdb_vote_average = $9, tmdb_vote_count = $10, original_language = $11 where tmdb_id = $1`,
                [tmdb_id, title, original_title, overview, release_date || null, poster_path, backdrop_path, popularity || 0, vote_average || 0, vote_count || 0, original_language || 'en']
            );
        } else {
            await pool.query(
                `insert into movies 
                (tmdb_id, title, original_title, overview, release_date, poster_path, backdrop_path, popularity, vote_average, vote_count, tmdb_vote_average, tmdb_vote_count, original_language, created_at)
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $10, $11, now())`,
                [tmdb_id, title, original_title, overview, release_date || null, poster_path, backdrop_path, popularity || 0, vote_average || 0, vote_count || 0, original_language || 'en']
            );
        }
        await logAdminActivity(req.user.userId, 'ADD_MOVIE', 'movies', tmdb_id, `Added/Updated movie: ${title}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/series', authenticateAdmin, async (req, res) => {
    const { tmdb_id, name, original_name, overview, first_air_date, poster_path, popularity, vote_average, vote_count, original_language } = req.body;
    try {
        const check = await pool.query('select tmdb_id from serieses where tmdb_id = $1', [tmdb_id]);
        if (check.rows.length > 0) {
            await pool.query(
                `update serieses set name = $2, original_name = $3, overview = $4, first_air_date = $5, poster_path = $6, popularity = $7, vote_average = $8, vote_count = $9, tmdb_vote_average = $8, tmdb_vote_count = $9, original_language = $10 where tmdb_id = $1`,
                [tmdb_id, name, original_name, overview, first_air_date || null, poster_path, popularity || 0, vote_average || 0, vote_count || 0, original_language || 'en']
            );
        } else {
            await pool.query(
                `insert into serieses 
                (tmdb_id, name, original_name, overview, first_air_date, poster_path, popularity, vote_average, vote_count, tmdb_vote_average, tmdb_vote_count, original_language)
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8, $9, $10)`,
                [tmdb_id, name, original_name, overview, first_air_date || null, poster_path, popularity || 0, vote_average || 0, vote_count || 0, original_language || 'en']
            );
        }
        await logAdminActivity(req.user.userId, 'ADD_SERIES', 'serieses', tmdb_id, `Added/Updated series: ${name}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/people', authenticateAdmin, async (req, res) => {
    const { id, name, biography, profile_path, popularity, gender, place_of_birth, birthday, known_for_department } = req.body;
    try {
        const check = await pool.query('select id from people where id = $1', [id]);
        if (check.rows.length > 0) {
            await pool.query(
                `update people set name = $2, biography = $3, profile_path = $4, popularity = $5, gender = $6, place_of_birth = $7, birthday = $8, known_for_department = $9 where id = $1`,
                [id, name, biography, profile_path, popularity || 0, gender || 0, place_of_birth, birthday || null, known_for_department]
            );
        } else {
            await pool.query(
                `insert into people 
                (id, name, biography, profile_path, popularity, gender, place_of_birth, birthday, known_for_department)
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [id, name, biography, profile_path, popularity || 0, gender || 0, place_of_birth, birthday || null, known_for_department]
            );
        }
        await logAdminActivity(req.user.userId, 'ADD_PERSON', 'people', id, `Added/Updated person: ${name}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/posts/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // delete korar age oke ber kora
        const post = await pool.query('select user_id, content from social_posts where post_id = $1', [id]);
        if (post.rows.length > 0) {
            const authorId = post.rows[0].user_id;
            const preview = post.rows[0].content.substring(0, 30) + '...';
            await createNotification(authorId, req.user.userId, 'SYSTEM', `An administrator has removed your post: "${preview}" for violating community standards.`);
        }
        await pool.query('delete from social_posts where post_id = $1', [id]);
        await logAdminActivity(req.user.userId, 'DELETE_POST', 'social_posts', id, `Deleted post ${id}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/comments/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // oi delete er age ber korlam
        const comment = await pool.query('select user_id, content from post_comments where comment_id = $1', [id]);
        if (comment.rows.length > 0) {
            const authorId = comment.rows[0].user_id;
            const preview = comment.rows[0].content.substring(0, 30) + '...';
            await createNotification(authorId, req.user.userId, 'SYSTEM', `An administrator has removed your comment: "${preview}" for violating community standards.`);
        }
        await pool.query('delete from post_comments where comment_id = $1', [id]);
        await logAdminActivity(req.user.userId, 'DELETE_COMMENT', 'post_comments', id, `Deleted comment ${id}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/logs', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            select a.*, u.username, u.email 
            from admin_activity_logs a
            left join users u on u.user_id = a.admin_id
            order by a.created_at desc limit 100
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/reports', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            select r.*, 
                   u.username as reporter_username,
                   p.content as post_content,
                   c.content as comment_content,
                   p_user.username as post_author,
                   c_user.username as comment_author
            from reports r
            join users u on u.user_id = r.reporter_id
            left join social_posts p on p.post_id = r.post_id
            left join post_comments c on c.comment_id = r.comment_id
            left join users p_user on p_user.user_id = p.user_id
            left join users c_user on c_user.user_id = c.user_id
            order by r.created_at desc
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NEW: Report Resolution Endpoint using sp_resolve_report Procedure
app.put('/api/admin/reports/:id/resolve', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body; // status: 'Resolved', 'Dismissed'

    try {
        // Multi-step: Update report + Log action + Notify reporter
        await pool.query('CALL sp_resolve_report($1, $2, $3, $4)', [
            id,
            req.user.userId,
            status || 'Resolved',
            note || 'No additional notes.'
        ]);
        res.json({ success: true, message: 'Report resolved via procedure.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// movie cast
app.get('/api/series/:id/season/:season_number/episodes', async (req, res) => {
    const { id, season_number } = req.params;
    try {
        // local DB
        const localEpisodes = await pool.query(
            `select episode_id, series_id, season_number, episode_number, name, overview, air_date, still_path, vote_average, vote_count
             from episodes 
             where series_id = $1 and season_number = $2
             order by episode_number asc`,
            [id, season_number]
        );

        if (localEpisodes.rows.length > 0) {
            console.log(`[Episodes] Serving ${localEpisodes.rows.length} local episodes for Series ${id} S${season_number}`);
            return res.json(localEpisodes.rows);
        }

        // naile tmdb
        console.log(`[Episodes] Fetching episodes from TMDB for Series ${id} S${season_number}`);
        const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ffb76769eee5be098b949fd3877a9d0b';
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${season_number}?api_key=${TMDB_API_KEY}`);

        if (tmdbRes.ok) {
            const data = await tmdbRes.json();
            const episodes = data.episodes || [];

            //local e dhukai dilam ei fake
            const savedEpisodes = [];
            for (const ep of episodes) {
                try {
                    const result = await pool.query(
                        `insert into episodes (series_id, season_number, episode_number, name, overview, air_date, still_path, vote_average, vote_count)
                         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                         on conflict (series_id, season_number, episode_number) DO update 
                         set name = excluded.name, overview = excluded.overview, still_path = excluded.still_path, 
                             vote_average = excluded.vote_average, vote_count = excluded.vote_count
                         returning *`,
                        [
                            id,
                            season_number,
                            ep.episode_number,
                            ep.name,
                            ep.overview,
                            ep.air_date || null,
                            ep.still_path,
                            ep.vote_average,
                            ep.vote_count
                        ]
                    );
                    savedEpisodes.push(result.rows[0]);
                } catch (insertErr) {
                    console.error('[Episodes] Insert error (skipping):', insertErr.message);
                }
            }
            return res.json(savedEpisodes.length > 0 ? savedEpisodes : episodes);
        }

        res.json([]);
    } catch (error) {
        console.error('[Episodes] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/movies/:id/cast', async (req, res) => {
    const movieId = req.params.id;
    try {
        // age local
        const localCast = await pool.query(`
            select p.id, p.name, p.profile_path, mc.character, mc.cast_order
            from movie_cast mc
            join people p on mc.person_id = p.id
            where mc.movie_id = $1
            order by mc.cast_order asc
        `, [movieId]);

        if (localCast.rows.length > 0) {
            return res.json(localCast.rows);
        }

        // naile tmdb
        const tmdbIdRes = await pool.query('select tmdb_id from movies where id = $1', [movieId]);
        if (tmdbIdRes.rows.length > 0) {
            const tmdbId = tmdbIdRes.rows[0].tmdb_id;
            const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ffb76769eee5be098b949fd3877a9d0b';
            const castRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}`);
            if (castRes.ok) {
                const data = await castRes.json();
                const rawCast = data.cast.slice(0, 15); // top 15

                //people table e na thakle na dekhailam
                const personIds = rawCast.map(c => c.id);
                const localPeopleRes = await pool.query('select id, name, profile_path from people where id = any($1)', [personIds]);
                const localPeopleMap = new Map(localPeopleRes.rows.map(p => [p.id, p]));

                const filteredCast = rawCast
                    .filter(c => localPeopleMap.has(c.id))
                    .map(c => ({
                        ...localPeopleMap.get(c.id),
                        character: c.character,
                        cast_order: c.order
                    }));

                return res.json(filteredCast);
            }
        }

        res.json([]);
    } catch (error) {
        console.error('Cast Fetch Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/content/search', authenticateAdmin, async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);
    try {
        const posts = await pool.query(
            `select p.post_id as id, p.content, p.created_at, u.username, 'post' as type 
             from social_posts p join users u on u.user_id = p.user_id 
             where p.content ilike $1 order by p.created_at desc limit 50`,
            [`%${query}%`]
        );
        const comments = await pool.query(
            `select c.comment_id as id, c.content, c.created_at, u.username, 'comment' as type
             from post_comments c join users u on u.user_id = c.user_id
             where c.content ilike $1 order by c.created_at desc limit 50`,
            [`%${query}%`]
        );
        res.json([...posts.rows, ...comments.rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//chat
io.on('connection', (socket) => {
    console.log('A user connected via WebSocket:', socket.id);

    socket.on('join_user', (userId) => {
        if (userId) socket.join(`user_${userId}`);
    });

    socket.on('join_discussion', (discussionId) => {
        if (discussionId) socket.join(`discussion_${discussionId}`);
    });

    socket.on('send_dm', async (data) => {
        try {
            const res = await pool.query(
                'insert into direct_messages (sender_id, receiver_id, message) values ($1, $2, $3) returning *',
                [data.sender_id, data.receiver_id, data.message]
            );
            const msg = res.rows[0];
            // receiver and sender 
            io.to(`user_${data.receiver_id}`).emit('receive_dm', msg);
            io.to(`user_${data.sender_id}`).emit('receive_dm', msg);

            // Notification
            const unreadRes = await pool.query(
                'select count(*)::int as total from direct_messages where receiver_id = $1 and read_at is null',
                [data.receiver_id]
            );
            io.to(`user_${data.receiver_id}`).emit('unread_update', { unreadCount: unreadRes.rows[0].total });
        } catch (err) {
            console.error('DM Error:', err);
        }
    });

    socket.on('send_discussion_msg', async (data) => {
        try {
            // public naki
            const discussionRes = await pool.query('select access_level from discussions where id = $1', [data.discussion_id]);
            if (discussionRes.rows.length === 0) return;

            const res = await pool.query(
                `insert into discussion_messages (discussion_id, sender_id, message) values ($1, $2, $3) returning *`,
                [data.discussion_id, data.sender_id, data.message]
            );
            const msg = res.rows[0];

            // ui e chehara dekhanor jonno
            const userRes = await pool.query('select username, profile_picture from users where user_id = $1', [data.sender_id]);
            if (userRes.rows.length > 0) {
                msg.sender_username = userRes.rows[0].username;
                msg.sender_picture = userRes.rows[0].profile_picture;
            }

            io.to(`discussion_${data.discussion_id}`).emit('receive_discussion_msg', msg);
        } catch (err) {
            console.error('Discussion Msg Error:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

//actor tactor

app.get('/api/person/:id', async (req, res) => {
    try {
        const result = await pool.query('select * from people where id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Person not found' });
        const person = result.rows[0];

        // Check follow status if user is authenticated
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const followCheck = await pool.query(
                    'select 1 from favourite_people where user_id = $1 and person_id = $2 limit 1',
                    [decoded.userId, req.params.id]
                );
                person.is_following = followCheck.rows.length > 0;
            } catch (e) {
                person.is_following = false;
            }
        } else {
            person.is_following = false;
        }

        res.json(person);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/person/:id/movies', async (req, res) => {
    try {
        const result = await pool.query(`
            select m.*, mc.character 
            from movies m 
            join movie_cast mc on m.id = mc.movie_id 
            where mc.person_id = $1 
            order by m.popularity desc nulls last
        `, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/people/:id/follow', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const personId = req.params.id;
        const { person_name, person_role, profile_path } = req.body;

        const check = await pool.query('select * from favourite_people where user_id = $1 and person_id = $2', [userId, personId]);
        if (check.rows.length > 0) {
            await pool.query('delete from favourite_people where user_id = $1 and person_id = $2', [userId, personId]);
            return res.json({ status: 'unfollowed', following: false });
        } else {
            await pool.query(
                'insert into favourite_people (user_id, person_id, person_name, person_role, profile_path, created_at) values ($1, $2, $3, $4, $5, now())',
                [userId, personId, person_name || 'Artist', person_role || 'Actor', profile_path || null]
            );
            return res.json({ status: 'followed', following: true });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// user follow status
app.get('/api/people/:id/follow-status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const personId = req.params.id;
        const result = await pool.query(
            'select 1 from favourite_people where user_id = $1 and person_id = $2 limit 1',
            [userId, personId]
        );
        res.json({ following: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/profile/favourite-people', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('select * from favourite_people where user_id = $1 order by created_at desc', [req.user.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/browse/favorite-people-movies', optionalAuthenticate, async (req, res) => {
    try {
        const userId = req.user ? req.user.userId : null;
        if (!userId) return res.json([]);
        const result = await pool.query(`
            select distinct m.*
            from movies m
            join movie_cast mc on m.id = mc.movie_id
            join favourite_people f on mc.person_id = f.person_id
            where f.user_id = $1
            order by m.popularity desc nulls last limit 20
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

server.listen(PORT, () => {
    console.log("Server is running on http://localhost:" + PORT);
});
