import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spinner, VStack } from '@chakra-ui/react';

// 動的インポートでページを遅延読み込み
const Home = lazy(() => import('./pages/home'));
const Start = lazy(() => import('./pages/start'));
const Config = lazy(() => import('./pages/config'));
const Play = lazy(() => import('./pages/play'));
const Sessions = lazy(() => import('./pages/sessions'));

// ローディングコンポーネント
const LoadingSpinner = () => (
  <VStack justify="center" align="center" height="100vh">
    <Spinner size="lg" />
  </VStack>
);

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<Start />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/config" element={<Config />} />
        <Route path="/play" element={<Play />} />
      </Routes>
    </Suspense>
  );
}

export default App;