import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DevGalleryPage } from './pages/DevGalleryPage';
import { HostGamePage } from './pages/HostGamePage';
import { JoinPage } from './pages/JoinPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlayerGamePage } from './pages/PlayerGamePage';
import { QuizEditorPage } from './pages/QuizEditorPage';
import { QuizListPage } from './pages/QuizListPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/play/:pin" element={<PlayerGamePage />} />
        <Route path="/quizzes" element={<QuizListPage />} />
        <Route path="/quizzes/new" element={<QuizEditorPage />} />
        <Route path="/quizzes/:quizId" element={<QuizEditorPage />} />
        <Route path="/host/:pin" element={<HostGamePage />} />
        <Route path="/dev" element={<DevGalleryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
