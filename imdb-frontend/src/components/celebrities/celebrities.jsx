import React, { useEffect } from "react";

function Celebrities() {
    useEffect(() => {
        const fetchCelebs = async () => {
            try {
                const response = await fetch("http://localhost:5000/api/celebrities");
                if (response.ok) {
                    const data = await response.json();
                    console.log("ashche", data);
                }
            } catch (e) {
                console.error("ashenai:", e);
            }
        };
        fetchCelebs();
    }, []);
    return (
        <div style={{ color: 'white', padding: '100px', textAlign: 'center' }}>
            <h1>Stars & Celebrities</h1>
            <p>Coming soon: Track your favorite actors and directors!</p>
        </div>
    );
}

export default Celebrities;