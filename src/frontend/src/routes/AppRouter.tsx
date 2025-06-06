import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { UploadStatusPage } from '../pages/UploadStatusPage';
import { CustomizationPage } from '../pages/CustomizationPage';
import { VideoStatusPage } from '../pages/VideoStatusPage';
import { VideoPlayerPage } from '../pages/VideoPlayerPage';
import { PowerPointsPage } from '../pages/PowerPointsPage';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout/Layout';

export const AppRouter = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/" 
          element={isAuthenticated ? <Layout><HomePage /></Layout> : <Navigate to="/login" />}
        />
        <Route 
          path="/powerpoints" 
          element={isAuthenticated ? <Layout><PowerPointsPage /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/status/:id" 
          element={isAuthenticated ? <Layout><UploadStatusPage /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/powerpoint/:pptId" 
          element={isAuthenticated ? <Layout><CustomizationPage /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/status/powerpoint/:pptId/video/:videoId" 
          element={isAuthenticated ? <Layout><VideoStatusPage /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/powerpoint/:pptId/video/:videoId" 
          element={isAuthenticated ? <Layout><VideoPlayerPage /></Layout> : <Navigate to="/login" />} 
        />
        {/* Catch all route - redirect to home or login */}
        <Route 
          path="*" 
          element={<Navigate to={isAuthenticated ? "/" : "/login"} />} 
        />
      </Routes>
    </Router>
  );
};