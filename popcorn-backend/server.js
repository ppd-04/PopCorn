require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express(); 
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
        console.error('❌ Database connection error:', err.stack);
    } else {
        console.log('✅ Database connected successfully at:', res.rows[0].now);
    }
});

// first route e, new user register

app.post('/api/register', async (req, res) => {
    const { email, password, full_name, date_of_birth, gender, phone_number, address, profile_picture } = req.body;
    const client = await pool.connect();

    try {
        // --- Server-side Validation ---
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        // Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Password strength check
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }

        // Full name check
        if (!full_name || full_name.trim().length < 2) {
            throw new Error('Full name is required (at least 2 characters)');
        }


        if (date_of_birth) {
            const dob = new Date(date_of_birth);
            const now = new Date();
            if (isNaN(dob.getTime()) || dob >= now) {
                throw new Error('Please provide a valid date of birth');
            }
        }
        // eta na dileo pera nai 
        if (phone_number && phone_number.trim() !== '') {
            const phoneRegex = /^[+]?[\d\s()-]{7,20}$/;
            if (!phoneRegex.test(phone_number)) {
                throw new Error('Invalid phone number format');
            }
        }

        const allowedGenders = ['Male', 'Female', 'Other', 'Prefer not to say', ''];
        if (gender && !allowedGenders.includes(gender)) {
            throw new Error('Invalid gender selection');
        }

        // shuru 
        await client.query('BEGIN'); 

        // $1 er jaygay email boshbe, placeholder, WHERE EMAIL=EMAIL ER POSH VERSION

        const userCheck = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            throw new Error('User already exists');
        }


        // await mane wait kortese, promise korse password pailei diye dibe

        const koybarHashingHobe = 10;
        const passwordHash = await bcrypt.hash(password, koybarHashingHobe);


        // apatoto password hash na kore password dicchi shudhu, pore ekhane hashing build kora lagbe
        const userEmail = email.split('@')[0];
        const insertQuery = `INSERT INTO users (email, password, username, full_name, date_of_birth, gender, phone_number, address, profile_picture) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING user_id, email, username, full_name, date_of_birth, gender, phone_number, address, profile_picture`;
        // const insertQuery = 'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email';
        const newUser = await client.query(insertQuery, [
            email, 
            passwordHash, 
            userEmail,
            full_name ? full_name.trim() : null,
            date_of_birth || null,
            gender || null,
            phone_number ? phone_number.trim() : null,
            address ? address.trim() : null,
            profile_picture || null
        ]);

        // commit koro
        await client.query('COMMIT'); 

        res.status(201).json({ 
            message: 'User created successfully', 
            user: newUser.rows[0] 
        });

    } catch (error) {
        // genjam hoile rollback
        await client.query('ROLLBACK');
        console.error(error);
        res.status(400).json({ error: error.message || 'Registration failed' });
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

        // db te hash kora pass use kora hoise so hashed password er sathe compare kore
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // web token
        // jwt hocche ekta string je ta user info ke rakhe and secured
        const token = jwt.sign(
            { userId: user.user_id, email: user.email }, // Payload
            process.env.JWT_SECRET,                 // Secret Key
            { expiresIn: '1h' }                     // Expiration, 1hour por abar login kora lagbe
        );

        // token ta react e pathao, mane frontend e token jay
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
                profile_picture: user.profile_picture
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Start  server
const PORT = process.env.PORT || 5000;

// Middleware 
// token eshb habijabi check kore, biroktikor jinish
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
// abar verify kore
app.get('/api/verify', authenticateToken, (req, res) => {

    res.json({ valid: true, user: req.user });
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
            LEFT JOIN   (
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
        res.status(500).json({ error: 'Failed to toggle like' });
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
    const { content } = req.body;

    try {
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment cannot be empty' });
        }

        const query = `
            INSERT INTO post_comments (post_id, user_id, content)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const result = await pool.query(query, [postId, userId, content.trim()]);

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

// movie rating
app.post('/api/movies/:id/rate', authenticateToken, async (req, res) => {
    const movieId = req.params.id;
    const userId = req.user.userId;
    const { rating } = req.body;

    try {
        if (!rating || rating < 1 || rating > 10) {
            return res.status(400).json({ error: 'Rating must be between 1 and 10' });
        }

        const query = `
            INSERT INTO movie_ratings (movie_id, user_id, rating)
            VALUES ($1, $2, $3)
            ON CONFLICT (movie_id, user_id)
            DO UPDATE SET rating = $3
            RETURNING *
        `;
        await pool.query(query, [movieId, userId, rating]);

 
        const stats = await pool.query(`
            SELECT 
                COALESCE(AVG(rating), 0)::numeric(3,1) AS avg_rating,
                COUNT(*)::int AS total_ratings
            FROM movie_ratings WHERE movie_id = $1
        `, [movieId]);

        res.json({
            message: 'Rating saved',
            my_rating: parseFloat(rating),
            avg_rating: parseFloat(stats.rows[0].avg_rating),
            total_ratings: stats.rows[0].total_ratings
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
                    'SELECT rating FROM movie_ratings WHERE movie_id = $1 AND user_id = $2',
                    [movieId, decoded.userId]
                );
                if (userRating.rows.length > 0) {
                    myRating = parseFloat(userRating.rows[0].rating);
                }
            } catch (e) { /* ignore */ }
        }

        const stats = await pool.query(`
            SELECT 
                COALESCE(AVG(rating), 0)::numeric(3,1) AS avg_rating,
                COUNT(*)::int AS total_ratings
            FROM movie_ratings WHERE movie_id = $1
        `, [movieId]);

        res.json({
            avg_rating: parseFloat(stats.rows[0].avg_rating),
            total_ratings: stats.rows[0].total_ratings,
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
            ORDER BY mc.created_at DESC
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
    const { content } = req.body;

    try {
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment cannot be empty' });
        }

        const result = await pool.query(
            'INSERT INTO movie_comments (movie_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
            [movieId, userId, content.trim()]
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
                    phone_number, address, profile_picture, created_at
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
app.get('/api/genres', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name FROM genres ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// ovvai