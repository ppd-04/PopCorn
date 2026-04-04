import React, { useEffect } from 'react';

function SeriesPage() {
  
  useEffect(() => {
    // Define the async fetch inside the useEffect
    const fetchTopSeries = async () => {
      try {
        console.log("📡 Attempting to fetch from backend...");
        const response = await fetch('http://localhost:5000/api/series/top');
        if (response.ok) {
          const data = await response.json();
          // Log the data to the console!
          console.log("🔥 Booyah! Successfully fetched Top Series:", data);
        } else {
          console.error("❌ Failed to fetch top series (Status:", response.status, ")");
        }
      } catch (error) {
        console.error("🚨 Error making the request:", error);
      }
    };

    // Call the function
    fetchTopSeries();
  }, []); // The empty array ensures this only runs ONCE when the component mounts

  return (
    <div style={{ color: 'white', padding: '100px', textAlign: 'center' }}>
      <h1>Series Page banailam</h1>
      <p>Open your browser's Developer Tools (F12) and check the Console tab!</p>
    </div>
  );
}

export default SeriesPage;
