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
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Γ¥î Database connection error:', err.stack);
    } else {
        console.log('Γ£à Database connected successfully at:', res.rows[0].now);
    }
});

// ==========================================
// MIDDLEWARE DEFINITIONS
// ==========================================
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

// New middleware for optional authentication (for browse failsafes)
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
            const u = await pool.query('SELECT is_admin, is_super_admin FROM users WHERE user_id = $1', [req.user.userId]);
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

// Gemini er endpoint
app.post('/api/ai/chat', optionalAuthenticate, async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY in .env' }); //env file gemini er api key rakha ase. but prothome quotation mark deyai mara kheye gesi
        }

        const { messages, system, model } = req.body || {};
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages array is required' });
        }

        // eshob habijabi gemini style e convert kora
        const contents = [];
        if (system && typeof system === 'string') {
            contents.push({ role: 'user', parts: [{ text: `System instruction: ${system}` }] });
        }
        for (const m of messages) {
            if (!m || !m.role || !m.content) continue;
            contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
        }

        const mdl = model || 'gemma-3-4b-it';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!resp.ok) {
            const txt = await resp.text();
            return res.status(502).json({ error: 'Gemini API error', details: txt });
        }
        const data = await resp.json();
        // text ta extract kora
        let text = '';
        try {
            text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        } catch (_) { /* kichu na*/ }

        let suggestedMovies = [];

        // --- SAFE QUERY ENFORCEMENT ---
        // NEW format: #GeminiMovies: movie1, movie2, movie3
        const movieRegex = /#GeminiMovies:\s*([\s\S]+?)(?:\r?\n|$)/i;
        const movieMatch = text.match(movieRegex);
        if (movieMatch) {
            const rawTitles = movieMatch[1].trim();
            // cleaming up
            const movieTitles = rawTitles.split(',')
                .map(t => t.trim().replace(/^['"`]+|['"`]+$/g, ''))
                .filter(t => t.length > 0);

            // sign shorailam
            text = text.replace(movieRegex, '').trim();

            if (movieTitles.length > 0) {
                try {
                    // gadha model er jonno query ami e likhe disi jor kore o khali naam dibe
                    const placeholders = movieTitles.map((_, index) => `$${index + 1}`).join(', ');
                    const safeQuery = `select id, title, poster_path, vote_average from movies where title in (${placeholders})`;
                    const result = await pool.query(safeQuery, movieTitles);
                    suggestedMovies = result.rows;
                    console.log(`[Chat] Enforced search for titles: ${movieTitles.join(', ')} -> Found ${suggestedMovies.length} movies.`);
                } catch (dbErr) {
                    console.error('[Chat] SQL Enforcement failed:', dbErr.message);
                }
            }
        }

        // authentication check
        const uId = req.user ? (req.user.userId || req.user.id || req.user.user_id) : null;
        if (uId) {
            console.log('[Chat] Attempting to save message for UID:', uId);
            try {
                // user er recent message save kora eta recommendation e kaaje lage
                const lastUserMessage = messages[messages.length - 1];
                if (lastUserMessage && lastUserMessage.role === 'user') {
                    await pool.query(
                        'INSERT INTO user_chat_messages (user_id, role, content) VALUES ($1, $2, $3)',
                        [uId, 'user', lastUserMessage.content]//user hole user role e rakhe
                    );
                }
                if (text) {
                    await pool.query(
                        'INSERT INTO user_chat_messages (user_id, role, content) VALUES ($1, $2, $3)',
                        [uId, 'model', text]//otherwise model
                    );
                }
                console.log('[Chat] Successfully saved user and model messages.');
            } catch (saveErr) {
                console.error('[Chat] Save error:', saveErr.message);
            }
        }

        return res.json({ text, suggestedMovies, raw: data });
    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'Request to Gemini timed out' });
        }
        console.error('AI chat proxy error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

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

        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) throw new Error('User already exists');

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

        await pool.query(
            `INSERT INTO email_otps (email, otp_code, expires_at) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (email) DO UPDATE SET otp_code = EXCLUDED.otp_code, expires_at = EXCLUDED.expires_at`,
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
        
        await client.query('BEGIN');

        // Check OTP
        const otpCheck = await client.query('SELECT * FROM email_otps WHERE email = $1 AND otp_code = $2', [email, otp_code]);
        if (otpCheck.rows.length === 0) throw new Error('Invalid or expired OTP');
        
        if (new Date() > new Date(otpCheck.rows[0].expires_at)) {
            await client.query('DELETE FROM email_otps WHERE email = $1', [email]);
            throw new Error('OTP has expired, please request a new one');
        }

        const userCheck = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) throw new Error('User already exists');

        const koybarHashingHobe = 10;
        const passwordHash = await bcrypt.hash(password, koybarHashingHobe);

        const userEmail = email.split('@')[0];
        const insertQuery = `INSERT INTO users (email, password, username, full_name, date_of_birth, gender, phone_number, address, profile_picture, is_verified) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING user_id, email, username, full_name, date_of_birth, gender, phone_number, address, profile_picture, is_admin`;
        const newUser = await client.query(insertQuery, [
            email, passwordHash, userEmail,
            full_name ? full_name.trim() : null,
            date_of_birth || null, gender || null,
            phone_number ? phone_number.trim() : null,
            address ? address.trim() : null,
            profile_picture || null, true // Automatically verified
        ]);

        await client.query('DELETE FROM email_otps WHERE email = $1', [email]);
        
        await client.query('COMMIT');

        // Automatically log them in by returning a token
        const token = jwt.sign(
            { userId: newUser.rows[0].user_id, email: newUser.rows[0].email, isAdmin: newUser.rows[0].is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            message: 'Account verified and created successfully!',
            user: newUser.rows[0],
            token: token
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(400).json({ error: error.message || 'Verification failed' });
    } finally {
        client.release();
    }
});

// existing user ke
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
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

// Email verification endpoint
app.get('/api/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
    }

    try {
        const result = await pool.query(
            'SELECT user_id, email, is_verified FROM users WHERE verification_token = $1',
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
            'UPDATE users SET is_verified = true, verification_token = NULL WHERE user_id = $1',
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
            'SELECT user_id, username, full_name, is_verified, verification_token FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No account found with this email' });
        }

        const user = result.rows[0];

        if (user.is_verified) {
            return res.json({ message: 'Email is already verified. You can log in.' });
        }

        // Generate new token if needed
        let token = user.verification_token;
        if (!token) {
            token = crypto.randomBytes(32).toString('hex');
            await pool.query('UPDATE users SET verification_token = $1 WHERE user_id = $2', [token, user.user_id]);
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
            // Guest experience: top movies
            const guestRes = await pool.query('SELECT * FROM movies WHERE vote_average >= 8.2 ORDER BY random() LIMIT 10');
            return res.json({
                recommendations: guestRes.rows.map(m => ({ ...m, ai_note: "Discover a top-rated cinematic masterpiece." })),
                cached_at: new Date()
            });
        }

        // Tier 1: Check Cache (if not forcing refresh)
        const currentCache = await pool.query('SELECT recommendations, last_updated FROM user_ai_cache WHERE user_id = $1', [userId]);
        const existingRecs = currentCache.rows.length > 0 ? currentCache.rows[0].recommendations : [];

        if (!forceRefresh && currentCache.rows.length > 0) {
            const lastUpdated = new Date(currentCache.rows[0].last_updated);
            const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
            if (lastUpdated > fourHoursAgo) {
                console.log(`[Browse] AI: Returning fresh cache for User ${userId}`);
                return res.json({ recommendations: existingRecs, cached_at: lastUpdated });
            }
        }

        // Tier 2: Generate New Picks (Priority logic)
        console.log(`[Browse] AI: Generating refined picks for User ${userId} (force=${forceRefresh})`);
        const avoidTitles = existingRecs.map(r => r.title).join(', ');

        const [genres, favs, wishlist, ratings, comments, posts, chats] = await Promise.all([
            pool.query('SELECT g.name FROM user_interests ui JOIN genres g ON ui.genre_id = g.id WHERE ui.user_id = $1', [userId]),
            pool.query('SELECT m.title, uf.created_at FROM user_favourites uf JOIN movies m ON uf.movie_id = m.id WHERE uf.user_id = $1 ORDER BY uf.created_at DESC LIMIT 5', [userId]),
            pool.query('SELECT m.title, w.created_at FROM wishlist w JOIN movies m ON w.movie_id = m.id WHERE w.user_id = $1 ORDER BY w.created_at DESC LIMIT 5', [userId]),
            pool.query('SELECT m.title, r.rating, r.created_at FROM movie_ratings r JOIN movies m ON r.movie_id = m.id WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 10', [userId]),
            pool.query('SELECT m.title, c.content, c.created_at FROM movie_comments c JOIN movies m ON c.movie_id = m.id WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT 5', [userId]),
            pool.query('SELECT content, created_at FROM social_posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5', [userId]),
            pool.query('SELECT role, content, created_at FROM user_chat_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId])
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
FORMAT: #AI_REC: SELECT id, title, poster_path, backdrop_path, vote_average FROM movies WHERE title ILIKE '%MOVIE%' LIMIT 1 | Personalized Immersive Note`;

            const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
                } catch (e) { /* skip bad quote */ }
            }

            if (recommendations.length > 0) {
                await pool.query(
                    `INSERT INTO user_ai_cache (user_id, recommendations, last_updated)
                     VALUES ($1, $2, now())
                     ON CONFLICT (user_id) DO UPDATE SET recommendations = EXCLUDED.recommendations, last_updated = now()`,
                    [userId, JSON.stringify(recommendations)]
                );
                return res.json({ recommendations, cached_at: new Date() });
            } else {
                throw new Error('No valid recommendations found');
            }
        } catch (genError) {
            console.error(`[Browse] AI: Gen failed for ${userId}, using fallback.`, genError.message);
            // Fallback to stale cache if it exists, otherwise popular
            if (existingRecs.length > 0) return res.json({ recommendations: existingRecs, cached_at: new Date(), is_stale: true });
            
            const popRes = await pool.query('SELECT * FROM movies WHERE vote_average >= 7.8 ORDER BY random() LIMIT 10');
            return res.json({ recommendations: popRes.rows.map(m => ({ ...m, ai_note: "A popular choice that matches your profile." })), cached_at: new Date(), is_fallback: true });
        }

    } catch (error) {
        console.error('[Browse] AI Error:', error);
        res.status(500).json({ error: 'Deep Discovery Engine currently recalibrating.' });
    }
});

// ==========================================
// SOCIAL FEATURE ROUTES
// ==========================================

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
            SELECT 
                sp.post_id, sp.content, sp.image, sp.created_at, sp.updated_at, sp.user_id,
                u.username, u.full_name, u.profile_picture,
                COALESCE(lc.like_count, 0)::int AS like_count,
                COALESCE(cc.comment_count, 0)::int AS comment_count,
                CASE WHEN ul.user_id IS NOT NULL THEN true ELSE false END AS liked_by_me
            FROM social_posts sp
            JOIN users u ON sp.user_id = u.user_id
            LEFT JOIN (
                SELECT post_id, COUNT(*) AS like_count FROM post_likes GROUP BY post_id
            ) lc ON sp.post_id = lc.post_id
            LEFT JOIN (
                SELECT post_id, COUNT(*) AS comment_count FROM post_comments GROUP BY post_id
            ) cc ON sp.post_id = cc.post_id
            LEFT JOIN post_likes ul ON sp.post_id = ul.post_id AND ul.user_id = $1
            ORDER BY sp.created_at DESC
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
            INSERT INTO social_posts (user_id, content, image)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const result = await pool.query(query, [userId, content.trim(), image || null]);


        const fullPost = await pool.query(`
            SELECT sp.*, u.username, u.full_name, u.profile_picture,
                   0 AS like_count, 0 AS comment_count, false AS liked_by_me
            FROM social_posts sp
            JOIN users u ON sp.user_id = u.user_id
            WHERE sp.post_id = $1
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

        const ownerCheck = await pool.query('SELECT user_id FROM social_posts WHERE post_id = $1', [postId]);
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
            UPDATE social_posts 
            SET content = $1, image = $2, updated_at = NOW()
            WHERE post_id = $3
            RETURNING *
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
        const ownerCheck = await pool.query('SELECT user_id FROM social_posts WHERE post_id = $1', [postId]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Post painai' });
        }
        if (ownerCheck.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'You can only delete your own posts' });
        }

        await pool.query('DELETE FROM social_posts WHERE post_id = $1', [postId]);
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
            'SELECT * FROM post_likes WHERE post_id = $1 AND user_id = $2',
            [postId, userId]
        );

        if (existing.rows.length > 0) {

            await pool.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
            const countResult = await pool.query('SELECT COUNT(*)::int AS like_count FROM post_likes WHERE post_id = $1', [postId]);
            res.json({ liked: false, like_count: countResult.rows[0].like_count });
        } else {
            // Like
            await pool.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
            const countResult = await pool.query('SELECT COUNT(*)::int AS like_count FROM post_likes WHERE post_id = $1', [postId]);
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
            SELECT pc.*, u.username, u.full_name, u.profile_picture
            FROM post_comments pc
            JOIN users u ON pc.user_id = u.user_id
            WHERE pc.post_id = $1
            ORDER BY pc.created_at ASC
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
            INSERT INTO post_comments (post_id, user_id, content, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const result = await pool.query(query, [postId, userId, content.trim(), parent_id || null]);

        // Return with user info
        const fullComment = await pool.query(`
            SELECT pc.*, u.username, u.full_name, u.profile_picture
            FROM post_comments pc
            JOIN users u ON pc.user_id = u.user_id
            WHERE pc.comment_id = $1
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
        const ownerCheck = await pool.query('SELECT user_id FROM post_comments WHERE comment_id = $1', [commentId]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        if (ownerCheck.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }

        await pool.query('DELETE FROM post_comments WHERE comment_id = $1', [commentId]);
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// movie rating — blends user ratings with the original IMDB vote_count/vote_average
app.post('/api/movies/:id/rate', authenticateToken, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.user.userId;
    const { rating } = req.body;

    try {
        if (!rating || rating < 1 || rating > 10) {
            return res.status(400).json({ error: 'Rating must be between 1 and 10' });
        }

        const upsertQuery = `
            INSERT INTO movie_ratings (movie_id, user_id, rating)
            VALUES ($1, $2, $3)
            ON CONFLICT (movie_id, user_id)
            DO UPDATE SET rating = $3
            RETURNING *
        `;
        await pool.query(upsertQuery, [movieId, userId, rating]);

        // Compute weighted average: blend original IMDB data with user ratings
        // We treat the original IMDB votes as a baseline and append our user ratings
        const blendedStats = await pool.query(`
            SELECT 
                m.vote_average AS imdb_avg,
                m.vote_count AS imdb_votes,
                COALESCE(AVG(r.rating), 0)::numeric(4,2) AS user_avg,
                COALESCE(COUNT(r.rating), 0)::int AS user_count
            FROM movies m
            LEFT JOIN movie_ratings r ON r.movie_id = m.id
            WHERE m.id = $1
            GROUP BY m.vote_average, m.vote_count
        `, [movieId]);

        let avg_rating, total_ratings;
        if (blendedStats.rows.length > 0) {
            const row = blendedStats.rows[0];
            const imdbAvg = parseFloat(row.imdb_avg || 0);
            const imdbVotes = parseInt(row.imdb_votes || 0);
            const userAvg = parseFloat(row.user_avg || 0);
            const userCount = parseInt(row.user_count || 0);
            // Weighted average: (imdb_avg * imdb_votes + user_avg * user_count) / (imdb_votes + user_count)
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

// rating get — returns blended IMDB + user rating
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
                    'SELECT rating FROM movie_ratings WHERE movie_id = $1 AND user_id = $2',
                    [movieId, decoded.userId]
                );
                if (userRating.rows.length > 0) {
                    myRating = parseFloat(userRating.rows[0].rating);
                }
            } catch (e) { /* ignore */ }
        }

        // Blend IMDB votes with user ratings
        const blendedStats = await pool.query(`
            SELECT 
                m.vote_average AS imdb_avg,
                m.vote_count AS imdb_votes,
                COALESCE(AVG(r.rating), 0)::numeric(4,2) AS user_avg,
                COALESCE(COUNT(r.rating), 0)::int AS user_count
            FROM movies m
            LEFT JOIN movie_ratings r ON r.movie_id = m.id
            WHERE m.id = $1
            GROUP BY m.vote_average, m.vote_count
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
            SELECT mc.*, u.username, u.full_name, u.profile_picture
            FROM movie_comments mc
            JOIN users u ON mc.user_id = u.user_id
            WHERE mc.movie_id = $1
            ORDER BY mc.created_at ASC
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
            'INSERT INTO movie_comments (movie_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [movieId, userId, content.trim(), parent_id || null]
        );

        const fullComment = await pool.query(`
            SELECT mc.*, u.username, u.full_name, u.profile_picture
            FROM movie_comments mc
            JOIN users u ON mc.user_id = u.user_id
            WHERE mc.comment_id = $1
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
        const check = await pool.query('SELECT user_id FROM movie_comments WHERE comment_id = $1', [commentId]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
        if (check.rows[0].user_id !== userId) return res.status(403).json({ error: 'You can only delete your own comments' });

        await pool.query('DELETE FROM movie_comments WHERE comment_id = $1', [commentId]);
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
        const existing = await pool.query('SELECT * FROM watchlist WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
        if (existing.rows.length > 0) {
            await pool.query('DELETE FROM watchlist WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
            res.json({ in_watchlist: false });
        } else {
            await pool.query('INSERT INTO watchlist (user_id, movie_id) VALUES ($1, $2)', [userId, movieId]);
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
        const existing = await pool.query('SELECT * FROM user_favourites WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
        if (existing.rows.length > 0) {
            await pool.query('DELETE FROM user_favourites WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
            res.json({ is_favourite: false });
        } else {
            await pool.query('INSERT INTO user_favourites (user_id, movie_id) VALUES ($1, $2)', [userId, movieId]);
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
        const existing = await pool.query('SELECT * FROM user_watched WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
        if (existing.rows.length > 0) {
            await pool.query('DELETE FROM user_watched WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
            res.json({ is_watched: false });
        } else {
            await pool.query('INSERT INTO user_watched (user_id, movie_id) VALUES ($1, $2)', [userId, movieId]);
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
            pool.query('SELECT 1 FROM watchlist WHERE user_id = $1 AND movie_id = $2', [userId, movieId]),
            pool.query('SELECT 1 FROM user_favourites WHERE user_id = $1 AND movie_id = $2', [userId, movieId]),
            pool.query('SELECT 1 FROM user_watched WHERE user_id = $1 AND movie_id = $2', [userId, movieId])
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
            SELECT DISTINCT m.id, m.title, m.poster_path, m.vote_average, m.release_date
            FROM movies m
            JOIN movie_genres mg ON m.id = mg.movie_id
            WHERE mg.genre_id IN (
                SELECT genre_id FROM movie_genres WHERE movie_id = $1
            )
            AND m.id != $1
            ORDER BY m.vote_average DESC NULLS LAST
            LIMIT 10
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
            `SELECT user_id, email, username, full_name, date_of_birth, gender, 
                    phone_number, address, profile_picture, date_joined, is_admin
             FROM users WHERE user_id = $1`,
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

// UPDATE PROFILE 
app.put('/api/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { full_name, phone_number, address, profile_picture } = req.body;

    try {
        const result = await pool.query(
            `UPDATE users SET 
                full_name = COALESCE($1, full_name),
                phone_number = COALESCE($2, phone_number),
                address = COALESCE($3, address),
                profile_picture = COALESCE($4, profile_picture)
             WHERE user_id = $5
             RETURNING user_id, email, username, full_name, date_of_birth, gender, 
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

        // Verify current password
        const user = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(current_password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Abar hash koro
        const passwordHash = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE user_id = $2', [passwordHash, userId]);

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
            `SELECT w.movie_id, w.created_at AS added_at,
                    m.title, m.poster_path, m.vote_average, m.release_date, m.overview
             FROM watchlist w
             LEFT JOIN movies m ON w.movie_id = m.id
             WHERE w.user_id = $1
             ORDER BY w.created_at DESC`,
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
        const existing = await pool.query('SELECT * FROM wishlist WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
        if (existing.rows.length > 0) {
            await pool.query('DELETE FROM wishlist WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
            res.json({ in_wishlist: false });
        } else {
            await pool.query('INSERT INTO wishlist (user_id, movie_id) VALUES ($1, $2)', [userId, movieId]);
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
            `SELECT w.movie_id, w.created_at AS added_at,
                    m.title, m.poster_path, m.vote_average, m.release_date, m.overview
             FROM wishlist w
             LEFT JOIN movies m ON w.movie_id = m.id
             WHERE w.user_id = $1
             ORDER BY w.created_at DESC`,
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
            `SELECT uf.movie_id, uf.created_at AS added_at,
                    m.title, m.poster_path, m.vote_average, m.release_date, m.overview
             FROM user_favourites uf
             LEFT JOIN movies m ON uf.movie_id = m.id
             WHERE uf.user_id = $1
             ORDER BY uf.created_at DESC`,
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
            `SELECT mr.movie_id, mr.rating, mr.created_at AS rated_at,
                    m.title, m.poster_path, m.vote_average, m.release_date
             FROM movie_ratings mr
             LEFT JOIN movies m ON mr.movie_id = m.id
             WHERE mr.user_id = $1
             ORDER BY mr.created_at DESC`,
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
            'SELECT * FROM favourite_people WHERE user_id = $1 AND person_id = $2',
            [userId, personId]
        );
        if (existing.rows.length > 0) {
            await pool.query('DELETE FROM favourite_people WHERE user_id = $1 AND person_id = $2', [userId, personId]);
            res.json({ is_following: false });
        } else {
            await pool.query(
                'INSERT INTO favourite_people (user_id, person_id, person_name, person_role, profile_path) VALUES ($1, $2, $3, $4, $5)',
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
            `SELECT * FROM favourite_people WHERE user_id = $1 ORDER BY created_at DESC`,
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
    const { genre_ids } = req.body; // array of genre_id integers

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Clear existing interests
        await client.query('DELETE FROM user_interests WHERE user_id = $1', [userId]);
        // Insert new ones
        if (genre_ids && genre_ids.length > 0) {
            const values = genre_ids.map((gid, i) => `($1, $${i + 2})`).join(', ');
            const params = [userId, ...genre_ids];
            await client.query(`INSERT INTO user_interests (user_id, genre_id) VALUES ${values}`, params);
        }
        await client.query('COMMIT');

        // Return updated interests
        const result = await pool.query(
            `SELECT ui.genre_id, g.name AS genre_name
             FROM user_interests ui
             LEFT JOIN genres g ON ui.genre_id = g.id
             WHERE ui.user_id = $1`,
            [userId]
        );
        res.json({ message: 'Interests updated', interests: result.rows });
    } catch (error) {
        await client.query('ROLLBACK');
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
            'SELECT COUNT(*)::int AS count FROM user_watched WHERE user_id = $1', [userId]
        );

        // Average rating given
        const avgRating = await pool.query(
            'SELECT COALESCE(AVG(rating), 0)::numeric(3,1) AS avg FROM movie_ratings WHERE user_id = $1', [userId]
        );

        // Total ratings given
        const ratingsCount = await pool.query(
            'SELECT COUNT(*)::int AS count FROM movie_ratings WHERE user_id = $1', [userId]
        );

        // Watchlist count
        const watchlistCount = await pool.query(
            'SELECT COUNT(*)::int AS count FROM watchlist WHERE user_id = $1', [userId]
        );

        // Favourites count
        const favouritesCount = await pool.query(
            'SELECT COUNT(*)::int AS count FROM user_favourites WHERE user_id = $1', [userId]
        );

        // Genre distribution 
        const genreDistribution = await pool.query(
            `SELECT g.name, COUNT(*)::int AS count
             FROM user_watched uw
             JOIN movie_genres mg ON uw.movie_id = mg.movie_id
             JOIN genres g ON mg.genre_id = g.id
             WHERE uw.user_id = $1
             GROUP BY g.name
             ORDER BY count DESC
             LIMIT 10`,
            [userId]
        );

        // Rating distribution 
        const ratingDistribution = await pool.query(
            `SELECT FLOOR(rating)::int AS rating_value, COUNT(*)::int AS count
             FROM movie_ratings
             WHERE user_id = $1
             GROUP BY FLOOR(rating)
             ORDER BY rating_value`,
            [userId]
        );

        // Monthly activity 
        const monthlyActivity = await pool.query(
            `SELECT 
                TO_CHAR(created_at, 'YYYY-MM') AS month,
                COUNT(*)::int AS activity_count
             FROM user_activity
             WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '6 months'
             GROUP BY TO_CHAR(created_at, 'YYYY-MM')
             ORDER BY month`,
            [userId]
        );

        // Recent activity
        const recentActivity = await pool.query(
            `SELECT ua.*, m.title AS movie_title, m.poster_path
             FROM user_activity ua
             LEFT JOIN movies m ON ua.movie_id = m.id
             WHERE ua.user_id = $1
             ORDER BY ua.created_at DESC
             LIMIT 20`,
            [userId]
        );

        // User interests
        const interests = await pool.query(
            `SELECT ui.genre_id, g.name AS genre_name
             FROM user_interests ui
             LEFT JOIN genres g ON ui.genre_id = g.id
             WHERE ui.user_id = $1`,
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
            'SELECT 1 FROM wishlist WHERE user_id = $1 AND movie_id = $2',
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
             ORDER bY m.title ASC
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
             ORDER bY s.name ASC
             LIMIt 5`,
            [`%${q}%`]
        );

        const combined = [...moviesResult.rows, ...seriesesResult.rows];
        // Sort by title lexicographically and limit to 8 combined results
        combined.sort((a,b) => a.title.localeCompare(b.title));
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
             LIMIT 3`,
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
            // Return top 5 trending if no query
            movies = await pool.query(`SELECT id, title as name, poster_path, 'movie' as type, release_date, popularity FROM movies ORDER BY popularity DESC LIMIT 5`);
            series = await pool.query(`SELECT tmdb_id as id, name, poster_path, 'series' as type, first_air_date as release_date, popularity FROM serieses ORDER BY popularity DESC LIMIT 5`);
        } else {
            // Search both tables
            movies = await pool.query(
                `SELECT id, title as name, poster_path, 'movie' as type, release_date, popularity 
                 FROM movies WHERE title ILIKE $1 ORDER BY popularity DESC LIMIT 5`,
                [`%${q}%`]
            );
            series = await pool.query(
                `SELECT tmdb_id as id, name, poster_path, 'series' as type, first_air_date as release_date, popularity
                 FROM serieses WHERE name ILIKE $1 ORDER BY popularity DESC LIMIT 5`,
                [`%${q}%`]
            );
        }

        const combined = [...movies.rows, ...series.rows].sort((a,b) => (b.popularity || 0) - (a.popularity || 0));
        res.json(combined);
    } catch (err) {
        console.error('Mention search error:', err);
        res.status(500).json({ error: 'Search failed', details: err.message });
    }
});

// Resolve mention title (Legacy and New support)
app.get('/api/movies/mention/resolve', async (req, res) => {
    try {
        const text = (req.query.text || '').trim();
        const type = req.query.type || 'movie';
        const id = req.query.id;

        if (id) {
            // New direct-id lookup
            const table = type === 'series' ? 'serieses' : 'movies';
            const idCol = type === 'series' ? 'tmdb_id' : 'id';
            const nameCol = type === 'series' ? 'name' : 'title';
            const result = await pool.query(`SELECT ${idCol} as id, ${nameCol} as title, poster_path FROM ${table} WHERE ${idCol} = $1`, [id]);
            if (result.rows.length > 0) return res.json(result.rows[0]);
        }

        // Legacy fuzzy lookup
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
        const result = await pool.query('SELECT id, name FROM genres ORDER BY name');
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

// ==========================================
// SERIES DETAILS ROUTES
// ==========================================

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
                const userRatingRes = await pool.query('SELECT rating FROM series_ratings WHERE series_id = $1 AND user_id = $2', [id, user.userId]);
                if (userRatingRes.rows.length > 0) {
                    myRating = parseFloat(userRatingRes.rows[0].rating);
                }
            } catch (e) { }
        }

        // Blend IMDB votes with user ratings
        const blended = await pool.query(`
            SELECT 
                s.vote_average AS imdb_avg,
                s.vote_count AS imdb_votes,
                COALESCE(AVG(r.rating), 0)::numeric(4,2) AS user_avg,
                COALESCE(COUNT(r.rating), 0)::int AS user_count
            FROM serieses s
            LEFT JOIN series_ratings r ON r.series_id = s.tmdb_id
            WHERE s.tmdb_id = $1
            GROUP BY s.vote_average, s.vote_count
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

        // series_ratings uses series_id which corresponds to serieses.tmdb_id
        await pool.query(
            `INSERT INTO series_ratings (series_id, user_id, rating) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (series_id, user_id) 
             DO UPDATE SET rating = excluded.rating`,
            [id, userId, rating]
        );

        // Compute blended rating: IMDB base + user ratings
        const blended = await pool.query(`
            SELECT 
                s.vote_average AS imdb_avg,
                s.vote_count AS imdb_votes,
                COALESCE(AVG(r.rating), 0)::numeric(4,2) AS user_avg,
                COALESCE(COUNT(r.rating), 0)::int AS user_count
            FROM serieses s
            LEFT JOIN series_ratings r ON r.series_id = s.tmdb_id
            WHERE s.tmdb_id = $1
            GROUP BY s.vote_average, s.vote_count
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
            pool.query('SELECT 1 FROM user_series_watchlist WHERE user_id = $1 AND series_id = $2', [userId, id]),
            pool.query('SELECT 1 FROM user_series_favourites WHERE user_id = $1 AND series_id = $2', [userId, id]),
            pool.query('SELECT 1 FROM user_series_watched WHERE user_id = $1 AND series_id = $2', [userId, id])
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
        const check = await pool.query('SELECT 1 FROM user_series_watchlist WHERE user_id = $1 AND series_id = $2', [userId, id]);
        if (check.rows.length > 0) {
            await pool.query('DELETE FROM user_series_watchlist WHERE user_id = $1 AND series_id = $2', [userId, id]);
            res.json({ in_watchlist: false, message: 'Removed from watchlist' });
        } else {
            await pool.query('INSERT INTO user_series_watchlist (user_id, series_id) VALUES ($1, $2)', [userId, id]);
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
        const check = await pool.query('SELECT 1 FROM user_series_favourites WHERE user_id = $1 AND series_id = $2', [userId, id]);
        if (check.rows.length > 0) {
            await pool.query('DELETE FROM user_series_favourites WHERE user_id = $1 AND series_id = $2', [userId, id]);
            res.json({ is_favourite: false, message: 'Removed from favourites' });
        } else {
            await pool.query('INSERT INTO user_series_favourites (user_id, series_id) VALUES ($1, $2)', [userId, id]);
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
        const check = await pool.query('SELECT 1 FROM user_series_watched WHERE user_id = $1 AND series_id = $2', [userId, id]);
        if (check.rows.length > 0) {
            await pool.query('DELETE FROM user_series_watched WHERE user_id = $1 AND series_id = $2', [userId, id]);
            res.json({ is_watched: false, message: 'Removed from watched' });
        } else {
            await pool.query('INSERT INTO user_series_watched (user_id, series_id) VALUES ($1, $2)', [userId, id]);
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
            SELECT c.*, u.username, u.full_name, u.profile_picture 
            FROM series_comments c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.series_id = $1
            ORDER BY c.created_at ASC
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
            `INSERT INTO series_comments (series_id, user_id, content, parent_id) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, userId, content.trim(), parent_id || null]
        );

        const comment = result.rows[0];
        const userRes = await pool.query('SELECT username, full_name, profile_picture FROM users WHERE user_id = $1', [userId]);
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
        const check = await pool.query('SELECT user_id FROM series_comments WHERE comment_id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
        
        if (check.rows[0].user_id !== userId && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }

        await pool.query('DELETE FROM series_comments WHERE comment_id = $1', [id]);
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});




// ==========================================
// FRIENDS & PROFILE ROUTES
// ==========================================

app.get('/api/users/search', async (req, res) => {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    try {
        const query = `
            SELECT user_id, username, full_name, profile_picture 
            FROM users 
            WHERE username ILIKE $1 OR full_name ILIKE $1 
            LIMIT 20
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
            'SELECT user_id, username, full_name, profile_picture, date_joined FROM users WHERE user_id = $1',
            [targetUserId]
        );
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        let friendStatus = 'none';
        let actionUserId = null;
        if (currentUserId && currentUserId !== parseInt(targetUserId)) {
            const fRes = await pool.query(
                `SELECT status, requester_id FROM friend_requests 
                 WHERE (requester_id = $1 AND receiver_id = $2) 
                    OR (requester_id = $2 AND receiver_id = $1)`,
                [currentUserId, targetUserId]
            );
            if (fRes.rows.length > 0) {
                friendStatus = fRes.rows[0].status;
                actionUserId = fRes.rows[0].requester_id;
            }
        }
        res.json({ ...userRes.rows[0], friendStatus, actionUserId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load profile' });
    }
});

app.get('/api/users/:id/posts', optionalAuthenticate, async (req, res) => {
    // Current user can see if they've liked posts
    const currentUserId = req.user ? req.user.userId : null;
    try {
        const query = `
            SELECT sp.*, u.username, u.full_name, u.profile_picture,
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = sp.post_id) AS like_count,
                   (SELECT COUNT(*) FROM post_comments WHERE post_id = sp.post_id) AS comment_count,
                   CASE WHEN $2::int IS NOT NULL AND EXISTS(SELECT 1 FROM post_likes WHERE post_id = sp.post_id AND user_id = $2) THEN true ELSE false END AS liked_by_me
            FROM social_posts sp
            JOIN users u ON sp.user_id = u.user_id
            WHERE sp.user_id = $1
            ORDER BY sp.created_at DESC
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
        await pool.query('BEGIN');
        const fRes = await pool.query(
            `INSERT INTO friend_requests (requester_id, receiver_id, status)
             VALUES ($1, $2, 'pending')
             ON CONFLICT (requester_id, receiver_id) DO NOTHING RETURNING id`,
            [currentUserId, targetUserId]
        );
        const revRes = await pool.query(`SELECT id FROM friend_requests WHERE requester_id = $1 AND receiver_id = $2`, [targetUserId, currentUserId]);
        if (fRes.rows.length > 0) {
            const uRes = await pool.query('SELECT username FROM users WHERE user_id = $1', [currentUserId]);
            await createNotification(targetUserId, currentUserId, 'friend_request', `${uRes.rows[0].username} sent you a friend request`);
        } else if (revRes.rows.length > 0) {
            return res.status(400).json({ error: 'Request already exists' });
        }
        await pool.query('COMMIT');
        res.json({ message: 'Request sent' });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: 'Action failed' });
    }
});

app.post('/api/friends/accept/:id', authenticateToken, async (req, res) => {
    const requesterId = req.params.id;
    const currentUserId = req.user.userId;
    try {
        await pool.query('BEGIN');
        const upd = await pool.query(
            `UPDATE friend_requests SET status = 'accepted', updated_at = NOW() 
             WHERE requester_id = $1 AND receiver_id = $2 RETURNING id`,
            [requesterId, currentUserId]
        );
        if (upd.rows.length > 0) {
            const uRes = await pool.query('SELECT username FROM users WHERE user_id = $1', [currentUserId]);
            await createNotification(requesterId, currentUserId, 'friend_accept', `${uRes.rows[0].username} accepted your friend request`);
            await pool.query(
                `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND sender_id = $2 AND type = 'friend_request'`,
                [currentUserId, requesterId]
            );
        }
        await pool.query('COMMIT');
        res.json({ message: 'Accepted' });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: 'Accept failed' });
    }
});

app.post('/api/friends/reject/:id', authenticateToken, async (req, res) => {
    const targetUserId = req.params.id;
    const currentUserId = req.user.userId;
    try {
        await pool.query(
            `DELETE FROM friend_requests WHERE (requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1)`,
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
            `SELECT n.*, u.username as sender_username, u.profile_picture as sender_picture
             FROM notifications n LEFT JOIN users u ON n.sender_id = u.user_id
             WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 50`,
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
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark read' });
    }
});

// ==========================================
// DIRECT MESSAGES & DISCUSSIONS REST APIs
// ==========================================

// Get a list of friends for the DM sidebar (plus latest message info if possible, simplified for now to just friends)
app.get('/api/messages/friends', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.user_id, u.username, u.full_name, u.profile_picture 
            FROM friend_requests f
            JOIN users u ON (f.requester_id = u.user_id OR f.receiver_id = u.user_id)
            WHERE f.status = 'accepted' 
              AND (f.requester_id = $1 OR f.receiver_id = $1)
              AND u.user_id != $1
        `, [req.user.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch friends' });
    }
});

// Get chat history with a specific user
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM direct_messages 
            WHERE (sender_id = $1 AND receiver_id = $2) 
               OR (sender_id = $2 AND receiver_id = $1)
            ORDER BY created_at ASC
            LIMIT 200
        `, [req.user.userId, req.params.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// NEW: Get aggregated conversations for the "All" tab
app.get('/api/chat/conversations', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(`
            WITH last_messages AS (
                SELECT DISTINCT ON (partner_id)
                    CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS partner_id,
                    message,
                    created_at,
                    sender_id
                FROM direct_messages
                WHERE sender_id = $1 OR receiver_id = $1
                ORDER BY partner_id, created_at DESC
            ),
            unread_counts AS (
                SELECT sender_id AS partner_id, COUNT(*)::int AS unread_count
                FROM direct_messages
                WHERE receiver_id = $1 AND read_at IS NULL
                GROUP BY sender_id
            )
            SELECT lm.*, u.username, u.full_name, u.profile_picture, COALESCE(uc.unread_count, 0) AS unread_count
            FROM last_messages lm
            JOIN users u ON lm.partner_id = u.user_id
            LEFT JOIN unread_counts uc ON lm.partner_id = uc.partner_id
            ORDER BY lm.created_at DESC
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// NEW: Global unread total
app.get('/api/chat/unread-total', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT COUNT(*)::int AS total FROM direct_messages WHERE receiver_id = $1 AND read_at IS NULL',
            [req.user.userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch unread total' });
    }
});

// NEW: Search users for Chat
app.get('/api/chat/search', authenticateToken, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    try {
        const result = await pool.query(`
            SELECT user_id, username, full_name, profile_picture FROM users 
            WHERE (username ILIKE $1 OR full_name ILIKE $1) AND user_id != $2
            LIMIT 10
        `, [`%${q}%`, req.user.userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// NEW: Mark messages from partner as read
app.post('/api/chat/read/:partnerId', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'UPDATE direct_messages SET read_at = NOW() WHERE receiver_id = $1 AND sender_id = $2 AND read_at IS NULL',
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
            SELECT d.*, u.username as creator_username, m.title as movie_title, m.poster_path
            FROM discussions d
            JOIN users u ON d.creator_id = u.user_id
            LEFT JOIN movies m ON d.movie_id = m.id
            WHERE d.access_level = 'public' 
               OR d.creator_id = $1 
               OR EXISTS (SELECT 1 FROM discussion_participants dp WHERE dp.discussion_id = d.id AND dp.user_id = $1)
            ORDER BY d.created_at DESC
            LIMIT 50
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
        await pool.query('BEGIN');
        const dRes = await pool.query(`
            INSERT INTO discussions (creator_id, movie_id, title, access_level, max_participants)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [req.user.userId, movie_id || null, title, access_level || 'public', max_participants || null]);

        const newGroup = dRes.rows[0];
        // Add creator as admin
        await pool.query(`INSERT INTO discussion_participants (discussion_id, user_id, role) VALUES ($1, $2, 'admin')`, [newGroup.id, req.user.userId]);
        await pool.query('COMMIT');
        res.json(newGroup);
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: 'Failed to create discussion' });
    }
});

// Get specific discussion and its messages
app.get('/api/discussions/:id', authenticateToken, async (req, res) => {
    try {
        const dRes = await pool.query(`
            SELECT d.*, m.title as movie_title, m.poster_path 
            FROM discussions d LEFT JOIN movies m ON d.movie_id = m.id WHERE d.id = $1
        `, [req.params.id]);
        if (dRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const msgRes = await pool.query(`
            SELECT dm.*, u.username as sender_username, u.profile_picture as sender_picture 
            FROM discussion_messages dm
            JOIN users u ON dm.sender_id = u.user_id
            WHERE dm.discussion_id = $1
            ORDER BY dm.created_at ASC LIMIT 100
        `, [req.params.id]);

        res.json({ discussion: dRes.rows[0], messages: msgRes.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch discussion' });
    }
});

// ==========================================
// SOCIAL DISCOVERY ROUTES
// ==========================================

// Smart friend suggestions: 3-tier scoring (mutual friends, genre affinity, movie taste)
app.get('/api/social/suggested-friends', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(`
            WITH my_friends AS (
                SELECT CASE WHEN requester_id = $1 THEN receiver_id ELSE requester_id END AS friend_id
                FROM friend_requests
                WHERE status = 'accepted' AND (requester_id = $1 OR receiver_id = $1)
            ),
            candidates AS (
                SELECT u.user_id, u.username, u.full_name, u.profile_picture
                FROM users u
                WHERE u.user_id != $1
                  AND u.user_id NOT IN (SELECT friend_id FROM my_friends)
                  AND u.user_id NOT IN (
                      SELECT CASE WHEN requester_id = $1 THEN receiver_id ELSE requester_id END
                      FROM friend_requests
                      WHERE requester_id = $1 OR receiver_id = $1
                  )
            ),
            mutual_score AS (
                SELECT c.user_id, COUNT(*)::int AS mutual_count
                FROM candidates c
                JOIN friend_requests fr ON fr.status = 'accepted'
                    AND (
                        (fr.requester_id = c.user_id AND fr.receiver_id IN (SELECT friend_id FROM my_friends))
                        OR (fr.receiver_id = c.user_id AND fr.requester_id IN (SELECT friend_id FROM my_friends))
                    )
                GROUP BY c.user_id
            ),
            genre_score AS (
                SELECT c.user_id, COUNT(*)::int AS genre_count,
                       STRING_AGG(g.name, ', ' ORDER BY g.name) AS shared_genres
                FROM candidates c
                JOIN user_interests ui_them ON ui_them.user_id = c.user_id
                JOIN user_interests ui_me   ON ui_me.user_id = $1 AND ui_me.genre_id = ui_them.genre_id
                JOIN genres g ON g.id = ui_them.genre_id
                GROUP BY c.user_id
            ),
            taste_score AS (
                SELECT c.user_id,
                       COALESCE(SUM(GREATEST(0, (5 - ABS(r_them.rating - r_me.rating)) * 2)), 0)::int AS taste_pts
                FROM candidates c
                JOIN movie_ratings r_them ON r_them.user_id = c.user_id
                JOIN movie_ratings r_me   ON r_me.user_id = $1 AND r_me.movie_id = r_them.movie_id
                WHERE ABS(r_them.rating - r_me.rating) <= 2
                GROUP BY c.user_id
            )
            SELECT
                c.user_id, c.username, c.full_name, c.profile_picture,
                COALESCE(ms.mutual_count, 0) * 10
                  + COALESCE(gs.genre_count, 0) * 4
                  + COALESCE(ts.taste_pts, 0) AS total_score,
                COALESCE(ms.mutual_count, 0)  AS mutual_friends,
                COALESCE(gs.shared_genres, '') AS shared_genres,
                COALESCE(gs.genre_count, 0)   AS genre_count,
                COALESCE(ts.taste_pts, 0)     AS taste_pts
            FROM candidates c
            LEFT JOIN mutual_score ms ON ms.user_id = c.user_id
            LEFT JOIN genre_score  gs ON gs.user_id = c.user_id
            LEFT JOIN taste_score  ts ON ts.user_id = c.user_id
            WHERE COALESCE(ms.mutual_count, 0) > 0
               OR COALESCE(gs.genre_count, 0) > 0
               OR COALESCE(ts.taste_pts, 0) > 0
            ORDER BY total_score DESC
            LIMIT 6
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

// Community stats for the social sidebar widget
app.get('/api/social/community-stats', async (req, res) => {
    try {
        const [postCount, userCount, todayActive] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS count FROM social_posts'),
            pool.query('SELECT COUNT(*)::int AS count FROM users'),
            pool.query(`SELECT COUNT(DISTINCT user_id)::int AS count FROM social_posts WHERE created_at >= NOW() - INTERVAL '24 hours'`)
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

// ==========================================
// ADMIN DASHBOARD ROUTES
// ==========================================

const logAdminActivity = async (adminId, actionType, targetEntity, targetId, details) => {
    try {
        await pool.query(
            `INSERT INTO admin_activity_logs (admin_id, action_type, target_entity, target_id, details) VALUES ($1, $2, $3, $4, $5)`,
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
            `INSERT INTO notifications (user_id, sender_id, type, message, related_id, created_at, is_read) 
             VALUES ($1, $2, $3, $4, $5, NOW(), false) RETURNING *`,
            [userId, senderId, type, message, relatedId]
        );
        
        if (res.rows.length > 0) {
            const newNotif = res.rows[0];
            let senderInfo = { username: 'System', profile_picture: null };
            if (senderId) {
                const s = await pool.query('SELECT username, profile_picture FROM users WHERE user_id = $1', [senderId]);
                if (s.rows.length > 0) senderInfo = s.rows[0];
            }
            
            const payload = { 
                ...newNotif, 
                sender_username: senderInfo.username, 
                sender_picture: senderInfo.profile_picture 
            };
            
            // Emit to the user's private socket room
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
            `INSERT INTO reports (reporter_id, post_id, comment_id, reason) VALUES ($1, $2, $3, $4)`,
            [userId, post_id || null, comment_id || null, reason]
        );
        res.json({ success: true, message: 'Report submitted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT user_id, username, email, is_admin, is_super_admin, banned_until FROM users ORDER BY user_id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id/role', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const target = await pool.query('SELECT is_admin, is_super_admin, email FROM users WHERE user_id = $1', [id]);
        if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const targetUser = target.rows[0];
        if (targetUser.is_super_admin) {
            return res.status(403).json({ error: 'Cannot modify SuperAdmin.' });
        }

        // Standard admins can't demote admins
        if (targetUser.is_admin && !req.user.isSuperAdmin) {
            return res.status(403).json({ error: 'Only SuperAdmin can demote an Admin.' });
        }
        
        const result = await pool.query('UPDATE users SET is_admin = NOT is_admin WHERE user_id = $1 RETURNING is_admin, email', [id]);
        const newState = result.rows[0].is_admin;
        
        await logAdminActivity(req.user.userId, newState ? 'MAKE_ADMIN' : 'REVOKE_ADMIN', 'users', id, `Changed admin status to ${newState} for ${result.rows[0].email}`);
        
        // Notify user
        const adminRes = await pool.query('SELECT username FROM users WHERE user_id = $1', [req.user.userId]);
        const adminName = adminRes.rows[0].username;
        const message = newState 
            ? `Administrator ${adminName} has promoted you to a role with Administrator privileges. Welcome to the team!` 
            : `Your Administrator privileges have been revoked by ${adminName}. If you have questions, please contact the SuperAdmin.`;
        await createNotification(id, req.user.userId, 'SYSTEM', message);
        
        res.json({ success: true, is_admin: newState });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id/ban', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { durationMs, reason } = req.body; 
    try {
        const target = await pool.query('SELECT is_admin, email, banned_until FROM users WHERE user_id = $1', [id]);
        if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const targetUser = target.rows[0];
        
        // Don't let standard admins ban other admins
        if (targetUser.is_admin && !req.user.isSuperAdmin) {
            return res.status(403).json({ error: 'Only SuperAdmin can ban an Admin.' });
        }

        // Toggle logic
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

        await pool.query('UPDATE users SET banned_until = $1 WHERE user_id = $2', [banUntil, id]);
        await logAdminActivity(req.user.userId, action, 'users', id, detailMsg);
        
        // Notify user
        const adminRes = await pool.query('SELECT username FROM users WHERE user_id = $1', [req.user.userId]);
        const adminName = adminRes.rows[0].username;
        
        if (!currentlyBanned) {
            const reasonMsg = reason ? ` Reason: ${reason}` : ' Policy violation.';
            await createNotification(id, req.user.userId, 'SYSTEM', `Your account has been banned by ${adminName}.${reasonMsg}`);
        } else {
            await createNotification(id, req.user.userId, 'SYSTEM', `Your account has been unbanned by ${adminName}. Welcome back!`);
        }
        
        res.json({ success: true, banned_until: banUntil });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/movies', authenticateAdmin, async (req, res) => {
    const { tmdb_id, title, original_title, overview, release_date, poster_path, backdrop_path, popularity, vote_average, vote_count, original_language } = req.body;
    try {
        const check = await pool.query('SELECT tmdb_id FROM movies WHERE tmdb_id = $1', [tmdb_id]);
        if (check.rows.length > 0) {
            await pool.query(
                `UPDATE movies SET title = $2, original_title = $3, overview = $4, release_date = $5, poster_path = $6, backdrop_path = $7, popularity = $8, vote_average = $9, vote_count = $10, tmdb_vote_average = $9, tmdb_vote_count = $10, original_language = $11 WHERE tmdb_id = $1`,
                [tmdb_id, title, original_title, overview, release_date || null, poster_path, backdrop_path, popularity || 0, vote_average || 0, vote_count || 0, original_language || 'en']
            );
        } else {
            await pool.query(
                `INSERT INTO movies 
                (tmdb_id, title, original_title, overview, release_date, poster_path, backdrop_path, popularity, vote_average, vote_count, tmdb_vote_average, tmdb_vote_count, original_language, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $10, $11, NOW())`,
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
        const check = await pool.query('SELECT tmdb_id FROM serieses WHERE tmdb_id = $1', [tmdb_id]);
        if (check.rows.length > 0) {
            await pool.query(
                `UPDATE serieses SET name = $2, original_name = $3, overview = $4, first_air_date = $5, poster_path = $6, popularity = $7, vote_average = $8, vote_count = $9, tmdb_vote_average = $8, tmdb_vote_count = $9, original_language = $10 WHERE tmdb_id = $1`,
                [tmdb_id, name, original_name, overview, first_air_date || null, poster_path, popularity || 0, vote_average || 0, vote_count || 0, original_language || 'en']
            );
        } else {
            await pool.query(
                `INSERT INTO serieses 
                (tmdb_id, name, original_name, overview, first_air_date, poster_path, popularity, vote_average, vote_count, tmdb_vote_average, tmdb_vote_count, original_language)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8, $9, $10)`,
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
        const check = await pool.query('SELECT id FROM people WHERE id = $1', [id]);
        if (check.rows.length > 0) {
            await pool.query(
                `UPDATE people SET name = $2, biography = $3, profile_path = $4, popularity = $5, gender = $6, place_of_birth = $7, birthday = $8, known_for_department = $9 WHERE id = $1`,
                [id, name, biography, profile_path, popularity || 0, gender || 0, place_of_birth, birthday || null, known_for_department]
            );
        } else {
            await pool.query(
                `INSERT INTO people 
                (id, name, biography, profile_path, popularity, gender, place_of_birth, birthday, known_for_department)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
        // Fetch author before deleting
        const post = await pool.query('SELECT user_id, content FROM social_posts WHERE post_id = $1', [id]);
        if (post.rows.length > 0) {
            const authorId = post.rows[0].user_id;
            const preview = post.rows[0].content.substring(0, 30) + '...';
            await createNotification(authorId, req.user.userId, 'SYSTEM', `An administrator has removed your post: "${preview}" for violating community standards.`);
        }
        await pool.query('DELETE FROM social_posts WHERE post_id = $1', [id]);
        await logAdminActivity(req.user.userId, 'DELETE_POST', 'social_posts', id, `Deleted post ${id}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/comments/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch author before deleting
        const comment = await pool.query('SELECT user_id, content FROM post_comments WHERE comment_id = $1', [id]);
        if (comment.rows.length > 0) {
            const authorId = comment.rows[0].user_id;
            const preview = comment.rows[0].content.substring(0, 30) + '...';
            await createNotification(authorId, req.user.userId, 'SYSTEM', `An administrator has removed your comment: "${preview}" for violating community standards.`);
        }
        await pool.query('DELETE FROM post_comments WHERE comment_id = $1', [id]);
        await logAdminActivity(req.user.userId, 'DELETE_COMMENT', 'post_comments', id, `Deleted comment ${id}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/logs', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.*, u.username, u.email 
            FROM admin_activity_logs a
            LEFT JOIN users u ON u.user_id = a.admin_id
            ORDER BY a.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/reports', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, 
                   u.username as reporter_username,
                   p.content as post_content,
                   c.content as comment_content,
                   p_user.username as post_author,
                   c_user.username as comment_author
            FROM reports r
            JOIN users u ON u.user_id = r.reporter_id
            LEFT JOIN social_posts p ON p.post_id = r.post_id
            LEFT JOIN post_comments c ON c.comment_id = r.comment_id
            LEFT JOIN users p_user ON p_user.user_id = p.user_id
            LEFT JOIN users c_user ON c_user.user_id = c.user_id
            ORDER BY r.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Movie Cast (Local + TMDB fallback)
app.get('/api/series/:id/season/:season_number/episodes', async (req, res) => {
    const { id, season_number } = req.params;
    try {
        // 1. Check local DB (series_id is the TMDB ID of the series from 'serieses' table)
        const localEpisodes = await pool.query(
            `SELECT episode_id, series_id, season_number, episode_number, name, overview, air_date, still_path, vote_average, vote_count
             FROM episodes 
             WHERE series_id = $1 AND season_number = $2
             ORDER BY episode_number ASC`,
            [id, season_number]
        );

        if (localEpisodes.rows.length > 0) {
            console.log(`[Episodes] Serving ${localEpisodes.rows.length} local episodes for Series ${id} S${season_number}`);
            return res.json(localEpisodes.rows);
        }

        // 2. Fallback to TMDB
        console.log(`[Episodes] Fetching episodes from TMDB for Series ${id} S${season_number}`);
        const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ffb76769eee5be098b949fd3877a9d0b';
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${season_number}?api_key=${TMDB_API_KEY}`);
        
        if (tmdbRes.ok) {
            const data = await tmdbRes.json();
            const episodes = data.episodes || [];
            
            // 3. Transform and Save (Upsert) to Local DB
            const savedEpisodes = [];
            for (const ep of episodes) {
                try {
                    const result = await pool.query(
                        `INSERT INTO episodes (series_id, season_number, episode_number, name, overview, air_date, still_path, vote_average, vote_count)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                         ON CONFLICT (series_id, season_number, episode_number) DO UPDATE 
                         SET name = EXCLUDED.name, overview = EXCLUDED.overview, still_path = EXCLUDED.still_path, 
                             vote_average = EXCLUDED.vote_average, vote_count = EXCLUDED.vote_count
                         RETURNING *`,
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
        // Try local DB first
        const localCast = await pool.query(`
            SELECT p.id, p.name, p.profile_path, mc.character, mc.cast_order
            FROM movie_cast mc
            JOIN people p ON mc.person_id = p.id
            WHERE mc.movie_id = $1
            ORDER BY mc.cast_order ASC
        `, [movieId]);

        if (localCast.rows.length > 0) {
            return res.json(localCast.rows);
        }

        // Fallback to TMDB
        const tmdbIdRes = await pool.query('SELECT tmdb_id FROM movies WHERE id = $1', [movieId]);
        if (tmdbIdRes.rows.length > 0) {
            const tmdbId = tmdbIdRes.rows[0].tmdb_id;
            const TMDB_API_KEY = process.env.TMDB_API_KEY || 'ffb76769eee5be098b949fd3877a9d0b';
            const castRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}`);
            if (castRes.ok) {
                const data = await castRes.json();
                const rawCast = data.cast.slice(0, 15); // Top 15 members
                
                // USER RULE: Only show people that exist in our 'people' table
                const personIds = rawCast.map(c => c.id);
                const localPeopleRes = await pool.query('SELECT id, name, profile_path FROM people WHERE id = ANY($1)', [personIds]);
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
            `SELECT p.post_id as id, p.content, p.created_at, u.username, 'post' as type 
             FROM social_posts p JOIN users u ON u.user_id = p.user_id 
             WHERE p.content ILIKE $1 ORDER BY p.created_at DESC LIMIT 50`,
            [`%${query}%`]
        );
        const comments = await pool.query(
            `SELECT c.comment_id as id, c.content, c.created_at, u.username, 'comment' as type
             FROM post_comments c JOIN users u ON u.user_id = c.user_id
             WHERE c.content ILIKE $1 ORDER BY c.created_at DESC LIMIT 50`,
            [`%${query}%`]
        );
        res.json([...posts.rows, ...comments.rows].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SOCKET.IO REAL-TIME CHAT
// ==========================================
io.on('connection', (socket) => {
    console.log('A user connected via WebSocket:', socket.id);

    // Auth & Room joining
    socket.on('join_user', (userId) => {
        if (userId) socket.join(`user_${userId}`);
    });

    socket.on('join_discussion', (discussionId) => {
        if (discussionId) socket.join(`discussion_${discussionId}`);
    });

    // Chat handling
    socket.on('send_dm', async (data) => {
        // data: { sender_id, receiver_id, message }
        try {
            const res = await pool.query(
                'INSERT INTO direct_messages (sender_id, receiver_id, message) VALUES ($1, $2, $3) RETURNING *',
                [data.sender_id, data.receiver_id, data.message]
            );
            const msg = res.rows[0];
            // Broadcast to the receiver and sender so both UI updates instantly
            io.to(`user_${data.receiver_id}`).emit('receive_dm', msg);
            io.to(`user_${data.sender_id}`).emit('receive_dm', msg);

            // Notify receiver of new message count
            const unreadRes = await pool.query(
                'SELECT COUNT(*)::int AS total FROM direct_messages WHERE receiver_id = $1 AND read_at IS NULL',
                [data.receiver_id]
            );
            io.to(`user_${data.receiver_id}`).emit('unread_update', { unreadCount: unreadRes.rows[0].total });
        } catch (err) {
            console.error('DM Error:', err);
        }
    });

    socket.on('send_discussion_msg', async (data) => {
        // data: { discussion_id, sender_id, message }
        try {
            // First check if user is in participant list or if it's public
            const discussionRes = await pool.query('SELECT access_level FROM discussions WHERE id = $1', [data.discussion_id]);
            if (discussionRes.rows.length === 0) return;
            // Simplified for now - assume they have access to send if they are physically there

            const res = await pool.query(
                `INSERT INTO discussion_messages (discussion_id, sender_id, message) VALUES ($1, $2, $3) RETURNING *`,
                [data.discussion_id, data.sender_id, data.message]
            );
            const msg = res.rows[0];

            // fetch sender details for ui
            const userRes = await pool.query('SELECT username, profile_picture FROM users WHERE user_id = $1', [data.sender_id]);
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

// ==========================================
// ACTOR & FAVOURITE PEOPLE ROUTES
// ==========================================

app.get('/api/person/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM people WHERE id = $1', [req.params.id]);
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
                    'SELECT 1 FROM favourite_people WHERE user_id = $1 AND person_id = $2 LIMIT 1',
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
            SELECT m.*, mc.character 
            FROM movies m 
            JOIN movie_cast mc ON m.id = mc.movie_id 
            WHERE mc.person_id = $1 
            ORDER BY m.popularity DESC NULLS LAST
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
        
        const check = await pool.query('SELECT * FROM favourite_people WHERE user_id = $1 AND person_id = $2', [userId, personId]);
        if (check.rows.length > 0) {
            await pool.query('DELETE FROM favourite_people WHERE user_id = $1 AND person_id = $2', [userId, personId]);
            return res.json({ status: 'unfollowed', following: false });
        } else {
            await pool.query(
                'INSERT INTO favourite_people (user_id, person_id, person_name, person_role, profile_path, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
                [userId, personId, person_name || 'Artist', person_role || 'Actor', profile_path || null]
            );
            return res.json({ status: 'followed', following: true });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dedicated endpoint to check if user follows a specific person
app.get('/api/people/:id/follow-status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const personId = req.params.id;
        const result = await pool.query(
            'SELECT 1 FROM favourite_people WHERE user_id = $1 AND person_id = $2 LIMIT 1',
            [userId, personId]
        );
        res.json({ following: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/profile/favourite-people', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM favourite_people WHERE user_id = $1 ORDER BY created_at DESC', [req.user.userId]);
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
            SELECT DISTINCT m.*
            FROM movies m
            JOIN movie_cast mc ON m.id = mc.movie_id
            JOIN favourite_people f ON mc.person_id = f.person_id
            WHERE f.user_id = $1
            ORDER BY m.popularity DESC NULLS LAST LIMIT 20
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

server.listen(PORT, () => {
    console.log("Server is running on http://localhost:" + PORT);
});
