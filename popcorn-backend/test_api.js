require('dotenv').config();

async function run() {
    try {
        const payload = {
            "tmdb_id": 157336,
            "title": "Interstellar",
            "original_title": "Interstellar",
            "overview": "The adventures of a group of explorers who make use of a newly discovered wormhole...",
            "release_date": "2014-11-05",
            "poster_path": "/gEU2QlsUUHXjNpeEYZjWAI1Z8L.jpg",
            "backdrop_path": "/pbrkL804c8yAv3zBZR4QPEafpAR.jpg",
            "popularity": 250.5,
            "vote_average": 8.4,
            "vote_count": 35000,
            "original_language": "en"
        };
        
        // Login as fahmid0403 to get token
        console.log("Logging in...");
        const loginRes = await fetch('http://localhost:5000/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email: 'fahmid0403@outlook.com', password: 'spiderman'})
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log("Login token acquired.");

        console.log("Submitting movie...");
        const res = await fetch('http://localhost:5000/api/admin/movies', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log("Response Status:", res.status);
        console.log("Response Data:", data);
    } catch (err) {
        console.error("Test error:", err);
    }
}
run();
