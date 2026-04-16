import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import "./Index.css";

const SplashScreen: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('/onboarding'); 
        }, 5000);

        return () => clearTimeout(timer); 
    }, [navigate]);

    return (
        <div className='splash-header'>
            <h1>EchoChat</h1>
            <h4>Your conversations, simplified.</h4>
        </div>
    );
};

export default SplashScreen;
