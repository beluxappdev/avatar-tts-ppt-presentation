import React from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
    const { login, loading } = useAuth();

    const handleLogin = async () => {
        try {
            await login();
        } catch (error) {
            console.error('Login error:', error);
        }
    };

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            backgroundColor: '#f5f5f5'
        }}>
            <div style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                textAlign: 'center',
                maxWidth: '400px',
                width: '100%'
            }}>
                <h1 style={{ marginBottom: '1rem', color: '#333' }}>
                    PowerPoint Avatar Generator
                </h1>
                <p style={{ marginBottom: '2rem', color: '#666' }}>
                    Sign in with your Microsoft account to get started
                </p>
                <button 
                    onClick={handleLogin}
                    disabled={loading}
                    style={{
                        backgroundColor: '#0078d4',
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '4px',
                        fontSize: '16px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        width: '100%'
                    }}
                >
                    {loading ? 'Signing in...' : 'Sign in with Microsoft'}
                </button>
            </div>
        </div>
    );
};