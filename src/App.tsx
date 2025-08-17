import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spinner, VStack } from '@chakra-ui/react';

// 動的インポートでページを遅延読み込み
const Home = lazy(() => import('./pages/home'));
const Start = lazy(() => import('./pages/start'));
const Config = lazy(() => import('./pages/config'));
const Play = lazy(() => import('./pages/play'));
const Sessions = lazy(() => import('./pages/sessions'));
// const Database = lazy(() => import('./pages/database'));

/**
 * 遅延読み込み中に表示するローディングコンポーネント。
 * @returns 全画面中央にスピナーを表示するVStack
 */
const LoadingSpinner = () => (
  <VStack justify="center" align="center" height="100vh">
    <Spinner size="lg" />
  </VStack>
);

/**
 * メインアプリケーションコンポーネント。
 * React Router によるルーティングと Suspense による遅延読み込みを提供します。
 * @returns ルートコンポーネント
 */
function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<Start />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/config" element={<Config />} />
        <Route path="/play" element={<Play />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;