import { useState, useEffect } from "react";


export function ProvincesAdmin() {

    const [provinces, setProvinces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        fetch('/api/provinces')
            .then(response => response.json())
            .then(data => {
                setLoading(false);
                setProvinces(data);
                console.log('Fetched provinces:', data);
            })
            .catch(error => {
                setLoading(false);
                setError(error.message);
                console.error('Error fetching provinces:', error);
            });
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }
    
    
    return (
        <div className="admin-home">
            <h1>Provinces Admin Page</h1>
            <p>This is where you can manage provinces.</p>
        </div>
            
    );
}